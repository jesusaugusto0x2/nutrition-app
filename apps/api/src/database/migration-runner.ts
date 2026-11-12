import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { sql } from 'drizzle-orm';
import type { Database } from './client';

/**
 * Where Drizzle records applied migrations (its defaults, which
 * drizzle-kit uses too): one row per migration, `created_at` being the
 * journal's `when`.
 */
const MIGRATIONS_TABLE = 'drizzle.__drizzle_migrations';

export interface MigrationLogger {
  log(message: string): void;
  error(message: string): void;
}

export interface RunMigrationsOptions {
  /** Used only to read the migrations table, before and after `apply`. */
  db: Database;
  /** Drizzle's migrator for the driver behind `db`. */
  apply: (migrationsFolder: string) => Promise<void>;
  migrationsFolder: string;
  logger: MigrationLogger;
}

interface JournalEntry {
  tag: string;
  when: number;
}

/**
 * Applies every pending migration (Drizzle runs them all in one transaction,
 * so a failure applies none) and logs only their names. It refuses to run
 * when a migration older than the last applied one was never applied, which
 * Drizzle would skip without a word. On failure it logs
 * the error code, never the message: it can carry SQL, values or connection
 * details (CLAUDE.md §6). Returns whether it succeeded.
 */
export async function runMigrations({
  db,
  apply,
  migrationsFolder,
  logger,
}: RunMigrationsOptions): Promise<boolean> {
  try {
    const journal = readJournal(migrationsFolder);
    const applied = await appliedMillis(db);
    const lastApplied = Math.max(0, ...applied);
    const pending = journal.filter((entry) => entry.when > lastApplied);
    // Drizzle would skip these silently: older than the last applied one.
    const skipped = journal.filter(
      (entry) => entry.when <= lastApplied && !applied.has(entry.when),
    );

    if (skipped.length > 0) {
      logger.error(
        `Migrations failed, none applied: ${skipped.map((entry) => entry.tag).join(', ')} ` +
          'is older than the last applied migration and would be skipped. ' +
          'Regenerate it (docs/deployment.md "Migrations").',
      );
      return false;
    }
    if (pending.length === 0) {
      logger.log(`No pending migrations (${journal.length} applied).`);
      return true;
    }
    logger.log(`Applying ${pending.length} migration(s)...`);
    await apply(migrationsFolder);
    for (const entry of pending) {
      logger.log(`Applied ${entry.tag}`);
    }
    logger.log('Migrations complete.');
    return true;
  } catch (error) {
    logger.error(
      `Migrations failed, none applied (code: ${errorCode(error)}).`,
    );
    return false;
  }
}

/** The migrations Drizzle knows about, in order (`meta/_journal.json`). */
function readJournal(migrationsFolder: string): JournalEntry[] {
  const journal = JSON.parse(
    readFileSync(join(migrationsFolder, 'meta', '_journal.json'), 'utf8'),
  ) as { entries: JournalEntry[] };
  return journal.entries.map(({ tag, when }) => ({ tag, when }));
}

/**
 * The journal `when` of every applied migration. Drizzle applies every
 * journal entry newer than the largest one, so the same comparison tells
 * which ones it will run. Empty when the table does not exist yet (an empty
 * database).
 */
async function appliedMillis(db: Database): Promise<Set<number>> {
  const [table] = rowsOf<{ exists: boolean }>(
    await db.execute(
      sql`select to_regclass(${MIGRATIONS_TABLE}) is not null as exists`,
    ),
  );
  if (!table?.exists) {
    return new Set();
  }
  const applied = rowsOf<{ created_at: string | number | null }>(
    await db.execute(sql`select created_at from ${sql.raw(MIGRATIONS_TABLE)}`),
  );
  return new Set(applied.map((row) => Number(row.created_at ?? 0)));
}

/**
 * `execute` results are driver-specific (`Database` covers node-postgres
 * and PGlite); both put the rows in `rows`.
 */
function rowsOf<T>(result: unknown): T[] {
  return (result as { rows: T[] }).rows;
}

/**
 * The first `code` along the error's `cause` chain: a Postgres SQLSTATE
 * (`42P01`), a Node network code (`ECONNREFUSED`) or a file-system code
 * (`ENOENT`). Falls back to the error's class name.
 */
export function errorCode(error: unknown): string {
  let current: unknown = error;
  for (let depth = 0; depth < 5 && current instanceof Object; depth += 1) {
    const code = (current as { code?: unknown }).code;
    if (typeof code === 'string' && code.length > 0) {
      return code;
    }
    current = (current as { cause?: unknown }).cause;
  }
  return error instanceof Error ? error.name : 'unknown';
}
