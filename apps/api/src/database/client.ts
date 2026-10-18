import type { PgDatabase, PgQueryResultHKT } from 'drizzle-orm/pg-core';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from './schema';

/**
 * Driver-agnostic database type. Production uses node-postgres; repository
 * tests use PGlite (in-process Postgres). Repositories depend on this type
 * only.
 */
export type Database = PgDatabase<PgQueryResultHKT, typeof schema>;

export interface DatabaseConnection {
  db: Database;
  close: () => Promise<void>;
}

// `casing: 'snake_case'` must match drizzle.config.ts so camelCase keys in
// TypeScript map to snake_case columns at runtime as well as in migrations.
export function createDatabase(databaseUrl: string): DatabaseConnection {
  const pool = new Pool({ connectionString: databaseUrl });
  const db = drizzle({ client: pool, schema, casing: 'snake_case' });

  return { db, close: () => pool.end() };
}
