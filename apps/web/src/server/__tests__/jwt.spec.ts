import {
  createLocalJWKSet,
  exportPKCS8,
  exportSPKI,
  generateKeyPair,
  jwtVerify,
} from 'jose';
import { beforeAll, describe, expect, it } from 'vitest';

/**
 * Verifies that a token minted by `signApiToken` validates against the public
 * JWK published by `getJwks()` — the exact contract the Nest `jwks-rsa` strategy
 * relies on. We generate an ephemeral RS256 keypair into env, then import the
 * module fresh so it reads those keys.
 */
describe('jwt server (signApiToken <-> getJwks)', () => {
  let signApiToken: typeof import('../jwt').signApiToken;
  let getJwks: typeof import('../jwt').getJwks;

  beforeAll(async () => {
    const { privateKey, publicKey } = await generateKeyPair('RS256');
    process.env['AUTH_JWT_PRIVATE_KEY'] = await exportPKCS8(privateKey);
    process.env['AUTH_JWT_PUBLIC_KEY'] = await exportSPKI(publicKey);
    process.env['AUTH_JWT_ISSUER'] = 'pitchpredict-web';
    process.env['AUTH_JWT_AUDIENCE'] = 'pitchpredict-api';

    const mod = await import('../jwt');
    signApiToken = mod.signApiToken;
    getJwks = mod.getJwks;
  });

  it('publishes a single RS256 sig JWK with a kid', async () => {
    const jwks = await getJwks();
    expect(jwks.keys).toHaveLength(1);
    const [jwk] = jwks.keys;
    expect(jwk.alg).toBe('RS256');
    expect(jwk.use).toBe('sig');
    expect(typeof jwk.kid).toBe('string');
    expect(jwk.kid).toBeTruthy();
  });

  it('signs a token that verifies against the published JWKS', async () => {
    const token = await signApiToken({
      id: 42,
      name: 'Demo Player',
      email: 'demo@pitchpredict.app',
      role: 'player',
    });

    const jwks = await getJwks();
    const keyStore = createLocalJWKSet(jwks);

    const { payload, protectedHeader } = await jwtVerify(token, keyStore, {
      issuer: 'pitchpredict-web',
      audience: 'pitchpredict-api',
    });

    expect(protectedHeader.alg).toBe('RS256');
    expect(protectedHeader.kid).toBe(jwks.keys[0].kid);
    expect(payload.sub).toBe('42');
    expect(payload.name).toBe('Demo Player');
    expect(payload.email).toBe('demo@pitchpredict.app');
    expect(payload.role).toBe('player');
  });

  it('rejects a tampered token', async () => {
    const token = await signApiToken({ id: 1, role: 'admin' });
    const tampered = token.slice(0, -3) + 'aaa';
    const keyStore = createLocalJWKSet(await getJwks());

    await expect(jwtVerify(tampered, keyStore)).rejects.toBeDefined();
  });
});
