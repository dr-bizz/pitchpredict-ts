import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  dialect: 'postgresql',
  schema: './libs/db/src/schema.ts',
  out: './libs/db/migrations',
  dbCredentials: {
    url: process.env.DATABASE_URL ?? '',
  },
});
