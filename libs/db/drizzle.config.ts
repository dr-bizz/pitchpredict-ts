import * as dotenv from 'dotenv';
import { defineConfig } from 'drizzle-kit';

// Local dev loads env from .env.local (Next convention), falling back to .env.
dotenv.config({ path: ['.env.local', '.env'] });

export default defineConfig({
  dialect: 'postgresql',
  schema: './libs/db/src/schema.ts',
  out: './libs/db/migrations',
  dbCredentials: {
    url: process.env.DATABASE_URL ?? '',
  },
});
