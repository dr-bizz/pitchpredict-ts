import {
  SignJWT,
  exportJWK,
  importPKCS8,
  importSPKI,
  type JWK,
  type KeyLike,
} from 'jose';
import { createHash } from 'node:crypto';

/**
 * RS256 signing for the API token attached by the BFF proxy. The private key is
 * held only on the web server; the matching public key is published as a JWK at
 * `/api/auth/jwks.json` and consumed by the Nest `jwks-rsa` strategy.
 */

const ALG = 'RS256';
const TOKEN_TTL = '1h';

/** Minimal shape of the data we mint a token from (NextAuth session/user). */
export interface ApiTokenSubject {
  id: string | number;
  name?: string | null;
  email?: string | null;
  role?: string | null;
}

interface Keys {
  privateKey: KeyLike;
  publicKey: KeyLike;
  publicJwk: JWK;
  kid: string;
}

let cached: Promise<Keys> | undefined;

function readPem(name: string): string {
  const raw = process.env[name];
  if (!raw) {
    throw new Error(`Missing required env var ${name}`);
  }
  // Allow PEMs stored with literal "\n" escapes in env files.
  return raw.includes('\\n') ? raw.replace(/\\n/g, '\n') : raw;
}

async function loadKeys(): Promise<Keys> {
  const privatePem = readPem('AUTH_JWT_PRIVATE_KEY');
  const publicPem = readPem('AUTH_JWT_PUBLIC_KEY');

  const privateKey = await importPKCS8(privatePem, ALG);
  const publicKey = await importSPKI(publicPem, ALG);

  const jwk = await exportJWK(publicKey);
  // Stable key id derived from the public JWK material.
  const kid = createHash('sha256')
    .update(JSON.stringify({ kty: jwk.kty, n: jwk.n, e: jwk.e }))
    .digest('hex')
    .slice(0, 16);

  const publicJwk: JWK = {
    ...jwk,
    use: 'sig',
    alg: ALG,
    kid,
  };

  return { privateKey, publicKey, publicJwk, kid };
}

function getKeys(): Promise<Keys> {
  if (!cached) {
    cached = loadKeys();
  }
  return cached;
}

/**
 * Sign a short-lived RS256 JWT carrying the user's identity + role. Claims:
 * `sub`, `name`, `email`, `role`, `iss`, `aud`, header `kid`, exp 1h.
 */
export async function signApiToken(subject: ApiTokenSubject): Promise<string> {
  const { privateKey, kid } = await getKeys();
  const issuer = process.env['AUTH_JWT_ISSUER'];
  const audience = process.env['AUTH_JWT_AUDIENCE'];
  if (!issuer || !audience) {
    throw new Error('Missing AUTH_JWT_ISSUER / AUTH_JWT_AUDIENCE');
  }

  return new SignJWT({
    name: subject.name ?? undefined,
    email: subject.email ?? undefined,
    role: subject.role ?? undefined,
  })
    .setProtectedHeader({ alg: ALG, kid })
    .setSubject(String(subject.id))
    .setIssuer(issuer)
    .setAudience(audience)
    .setIssuedAt()
    .setExpirationTime(TOKEN_TTL)
    .sign(privateKey);
}

/** The public JWK set published for the API to verify tokens. */
export async function getJwks(): Promise<{ keys: JWK[] }> {
  const { publicJwk } = await getKeys();
  return { keys: [publicJwk] };
}
