/**
 * Centralised environment access for the API. Keeps `process.env` lookups in one
 * place and documents the keys the API depends on (mirrors README/.env.example).
 */
export const env = {
  get port(): number {
    return Number(process.env['PORT'] ?? 3334);
  },
  get webOrigin(): string {
    return process.env['WEB_ORIGIN'] ?? 'http://localhost:3000';
  },
  get jwksUri(): string | undefined {
    return process.env['AUTH_JWKS_URI'];
  },
  get jwtIssuer(): string | undefined {
    return process.env['AUTH_JWT_ISSUER'];
  },
  get jwtAudience(): string | undefined {
    return process.env['AUTH_JWT_AUDIENCE'];
  },
  get resetSecret(): string {
    return process.env['AUTH_RESET_SECRET'] ?? 'dev-reset-secret-change-me';
  },
} as const;
