import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from './schema';

export type Database = NodePgDatabase<typeof schema>;

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
