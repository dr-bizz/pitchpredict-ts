import { Global, Module } from '@nestjs/common';
import { db, schema, type Db } from '@pitchpredict/db';

/** Injection token for the Drizzle database instance. */
export const DRIZZLE = 'DRIZZLE';

export type DrizzleDb = Db;

/**
 * Global module exposing the singleton Drizzle `db` (and the `schema` namespace)
 * to every other module via the `DRIZZLE` token.
 */
@Global()
@Module({
  providers: [
    { provide: DRIZZLE, useValue: db },
    { provide: 'SCHEMA', useValue: schema },
  ],
  exports: [DRIZZLE, 'SCHEMA'],
})
export class DbModule {}
