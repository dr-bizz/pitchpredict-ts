import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

export { schema };

export type Db = ReturnType<typeof createDb>;

export function createDb(connectionString: string) {
  const client = postgres(connectionString);
  return drizzle(client, { schema });
}

function createSingletonDb(): Db {
  const connectionString = process.env['DATABASE_URL'];
  if (!connectionString) {
    throw new Error('DATABASE_URL is not set');
  }
  return createDb(connectionString);
}

let _db: Db | undefined;

export const db: Db = new Proxy({} as Db, {
  get(_target, prop, receiver) {
    if (!_db) {
      _db = createSingletonDb();
    }
    return Reflect.get(_db, prop, receiver);
  },
});
