import { resolve } from 'node:path';
import { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import { migrate } from 'drizzle-orm/pglite/migrator';
import type { DatabaseConnection } from '../client';
import * as schema from '../schema';

/**
 * In-process PostgreSQL (PGlite) with all migrations applied. Used by
 * repository tests so they run real SQL without Docker. Test-only.
 */
export async function createTestDatabase(): Promise<DatabaseConnection> {
  const client = new PGlite();
  const db = drizzle({ client, schema, casing: 'snake_case' });
  await migrate(db, { migrationsFolder: resolve(__dirname, '../migrations') });

  return { db, close: () => client.close() };
}
