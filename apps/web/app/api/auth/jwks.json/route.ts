import { NextResponse } from 'next/server';
import { getJwks } from '../../../../src/server/jwt';

/**
 * Public JWKS endpoint. This is the URL the Nest API points `jwks-rsa` at
 * (`AUTH_JWKS_URI`) to verify RS256 tokens minted by the BFF.
 */
export async function GET() {
  const jwks = await getJwks();
  return NextResponse.json(jwks, {
    headers: { 'Cache-Control': 'public, max-age=300' },
  });
}
