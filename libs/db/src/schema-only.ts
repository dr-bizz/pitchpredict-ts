/**
 * Schema-only entrypoint. Exports Drizzle table/enum definitions WITHOUT the
 * postgres-js client, so browser bundles (e.g. `@pitchpredict/contracts` used in
 * the Next.js web app) never pull in node-only modules (`net`, `tls`, `fs`).
 */
export * from './schema';
