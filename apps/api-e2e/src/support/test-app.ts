/**
 * E2E test harness for the Nest API.
 *
 * The API verifies RS256 bearer tokens against a JWKS endpoint (the web BFF's
 * `/api/auth/jwks.json`). To keep the API e2e suite self-contained — no running
 * web app required — this harness:
 *   1. Generates an ephemeral RS256 keypair (jose).
 *   2. Stands up a tiny HTTP server that publishes the matching public JWK set,
 *      and points `AUTH_JWKS_URI` at it (so `jwks-rsa` in the API can fetch it).
 *   3. Boots the real `AppModule` in-process for supertest.
 *   4. Exposes `signToken(user)` to mint tokens the API will accept — the same
 *      claim shape the BFF's `signApiToken` produces (`sub`, `name`, `email`,
 *      `role`, `iss`, `aud`, header `kid`, 1h exp).
 *
 * These flows require a seeded Postgres. Provide `TEST_DATABASE_URL` (preferred)
 * or `DATABASE_URL`; call `requireDatabase()` from a test/`beforeAll` to skip the
 * suite cleanly when neither is set (kept "green by construction" — see README).
 */
import 'reflect-metadata';
import { ValidationPipe, type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import {
  SignJWT,
  exportJWK,
  generateKeyPair,
  type JWK,
  type KeyLike,
} from 'jose';
import { createHash, randomUUID } from 'node:crypto';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';

const ALG = 'RS256';
const ISSUER = 'pitchpredict-web-test';
const AUDIENCE = 'pitchpredict-api-test';

export interface TokenSubject {
  id: string | number;
  name?: string | null;
  email?: string | null;
  role?: 'player' | 'admin' | null;
}

export interface TestHarness {
  app: INestApplication;
  /** Mint a token the API will verify against the in-process JWKS server. */
  signToken(subject: TokenSubject): Promise<string>;
  close(): Promise<void>;
}

/**
 * Returns the configured test connection string, or `null` when none is set.
 * Use `requireDatabase()` to skip suites that need a live, seeded DB.
 */
export function databaseUrl(): string | null {
  return (
    process.env['TEST_DATABASE_URL'] ?? process.env['DATABASE_URL'] ?? null
  );
}

/**
 * Returns true if a DB is configured. When false, callers should `return` early
 * (and ideally log a skip notice) so the suite stays green without a seeded DB.
 */
export function hasDatabase(): boolean {
  return databaseUrl() !== null;
}

let keyPromise:
  | Promise<{ privateKey: KeyLike; publicJwk: JWK; kid: string }>
  | undefined;

async function getKeys() {
  if (!keyPromise) {
    keyPromise = (async () => {
      const { privateKey, publicKey } = await generateKeyPair(ALG, {
        extractable: true,
      });
      const jwk = await exportJWK(publicKey);
      const kid = createHash('sha256')
        .update(JSON.stringify({ kty: jwk.kty, n: jwk.n, e: jwk.e }))
        .digest('hex')
        .slice(0, 16);
      const publicJwk: JWK = { ...jwk, use: 'sig', alg: ALG, kid };
      return { privateKey, publicJwk, kid };
    })();
  }
  return keyPromise;
}

async function startJwksServer(): Promise<{ server: Server; uri: string }> {
  const { publicJwk } = await getKeys();
  const server = createServer((req, res) => {
    if (req.url && req.url.includes('jwks')) {
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ keys: [publicJwk] }));
      return;
    }
    res.writeHead(404).end();
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address() as AddressInfo;
  return { server, uri: `http://127.0.0.1:${port}/jwks.json` };
}

/**
 * Boot the API for e2e: configure auth env, start the JWKS server, create the
 * Nest app. The DB env must already be set (a singleton Drizzle client reads it
 * at import time) — call `databaseUrl()`/`hasDatabase()` before this.
 */
export async function createTestHarness(): Promise<TestHarness> {
  const { server, uri } = await startJwksServer();

  process.env['AUTH_JWKS_URI'] = uri;
  process.env['AUTH_JWT_ISSUER'] = ISSUER;
  process.env['AUTH_JWT_AUDIENCE'] = AUDIENCE;
  // The Drizzle singleton reads DATABASE_URL at first use; honour TEST_DATABASE_URL.
  const dbUrl = databaseUrl();
  if (dbUrl) {
    process.env['DATABASE_URL'] = dbUrl;
  }

  // Imported lazily so the auth env above is in place first.
  const { AppModule } = await import('../../../api/src/app/app.module');

  const moduleRef = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();

  const app = moduleRef.createNestApplication();
  app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true }));
  await app.init();

  async function signToken(subject: TokenSubject): Promise<string> {
    const { privateKey, kid } = await getKeys();
    return new SignJWT({
      name: subject.name ?? undefined,
      email: subject.email ?? undefined,
      role: subject.role ?? undefined,
      jti: randomUUID(),
    })
      .setProtectedHeader({ alg: ALG, kid })
      .setSubject(String(subject.id))
      .setIssuer(ISSUER)
      .setAudience(AUDIENCE)
      .setIssuedAt()
      .setExpirationTime('1h')
      .sign(privateKey);
  }

  async function close(): Promise<void> {
    await app.close();
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }

  return { app, signToken, close };
}
