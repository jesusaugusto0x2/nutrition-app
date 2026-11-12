import { resolve } from 'node:path';
import { Logger } from '@nestjs/common';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { Pool } from 'pg';
import { loadMigrationConfig } from '../config/migration-config';
import { runMigrations } from './migration-runner';
import * as schema from './schema';

/**
 * Production migration entry point, built to `migrate.js` next to `main.js`
 * and run by Railway's pre-deploy command (`node migrate.js`). Exits 0 when
 * the database is up to date and 1 otherwise, which stops the deploy.
 * Local development keeps using `pnpm db:migrate` (drizzle-kit).
 *
 * The migrations folder sits next to this file both in the source tree
 * (`src/database/migrations`) and in the image (`/app/api/migrations`,
 * copied by the Dockerfile).
 */
const MIGRATIONS_FOLDER = resolve(__dirname, 'migrations');

/** Neon may need a few seconds to wake a suspended compute. */
const CONNECTION_TIMEOUT_MS = 30_000;

async function main(): Promise<number> {
  const logger = new Logger('Migrate');

  let databaseUrl: string;
  try {
    databaseUrl = loadMigrationConfig().DATABASE_MIGRATION_URL;
  } catch (error) {
    // Names the invalid variables only (`loadMigrationConfig`).
    logger.error((error as Error).message);
    return 1;
  }

  // One connection: Drizzle runs every pending migration in one transaction.
  const pool = new Pool({
    connectionString: databaseUrl,
    max: 1,
    connectionTimeoutMillis: CONNECTION_TIMEOUT_MS,
  });
  // An idle client that loses its connection emits on the pool; without a
  // listener Node would crash with the error (and its message) unhandled.
  pool.on('error', () => undefined);
  const db = drizzle({ client: pool, schema, casing: 'snake_case' });

  try {
    const ok = await runMigrations({
      db,
      apply: (migrationsFolder) => migrate(db, { migrationsFolder }),
      migrationsFolder: MIGRATIONS_FOLDER,
      logger,
    });
    return ok ? 0 : 1;
  } finally {
    await pool.end().catch(() => undefined);
  }
}

void main().then((code) => {
  process.exitCode = code;
});
