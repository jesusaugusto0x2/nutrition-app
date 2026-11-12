import {
  cpSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { PGlite } from '@electric-sql/pglite';
import { drizzle, type PgliteDatabase } from 'drizzle-orm/pglite';
import { migrate } from 'drizzle-orm/pglite/migrator';
import type { Mock } from 'vitest';
import { errorCode, runMigrations } from './migration-runner';
import * as schema from './schema';

const MIGRATIONS = resolve(__dirname, 'migrations');

interface Journal {
  entries: { idx: number; tag: string; when: number }[];
}

const journal = JSON.parse(
  readFileSync(join(MIGRATIONS, 'meta', '_journal.json'), 'utf8'),
) as Journal;
const allTags = journal.entries.map((entry) => entry.tag);

describe('runMigrations', () => {
  let client: PGlite;
  let db: PgliteDatabase<typeof schema>;
  let logger: {
    log: Mock<(message: string) => void>;
    error: Mock<(message: string) => void>;
  };
  let folders: string[];

  beforeEach(async () => {
    client = new PGlite();
    // Closing a PGlite that never started hangs (the missing-folder test
    // never queries it).
    await client.waitReady;
    db = drizzle({ client, schema, casing: 'snake_case' });
    logger = {
      log: vi.fn<(message: string) => void>(),
      error: vi.fn<(message: string) => void>(),
    };
    folders = [];
  });

  afterEach(async () => {
    await client.close();
    for (const folder of folders) {
      rmSync(folder, { recursive: true, force: true });
    }
  });

  function run(migrationsFolder = MIGRATIONS) {
    return runMigrations({
      db,
      apply: (folder) => migrate(db, { migrationsFolder: folder }),
      migrationsFolder,
      logger,
    });
  }

  /** A copy of the real migrations, changed by `edit`. */
  function migrationsCopy(edit: (folder: string, journal: Journal) => void) {
    const folder = mkdtempSync(join(tmpdir(), 'nutri-migrations-'));
    folders.push(folder);
    cpSync(MIGRATIONS, folder, { recursive: true });
    const copy = structuredClone(journal);
    edit(folder, copy);
    writeFileSync(join(folder, 'meta', '_journal.json'), JSON.stringify(copy));
    return folder;
  }

  async function appliedCount() {
    const result = await client.query<{ count: number }>(
      'select count(*)::int as count from drizzle.__drizzle_migrations',
    );
    return result.rows[0].count;
  }

  const logged = () => logger.log.mock.calls.map(([message]) => message);

  it('applies every migration to an empty database and logs their names', async () => {
    await expect(run()).resolves.toBe(true);

    expect(await appliedCount()).toBe(allTags.length);
    for (const tag of allTags) {
      expect(logged()).toContain(`Applied ${tag}`);
    }
    expect(logger.error).not.toHaveBeenCalled();
  });

  it('changes nothing on a second run', async () => {
    await run();
    logger.log.mockClear();

    await expect(run()).resolves.toBe(true);

    expect(await appliedCount()).toBe(allTags.length);
    expect(logged()).toEqual([
      `No pending migrations (${allTags.length} applied).`,
    ]);
  });

  it('applies only the migrations newer than the last one applied', async () => {
    const firstOnly = migrationsCopy((_, copy) => {
      copy.entries = copy.entries.slice(0, 1);
    });
    await run(firstOnly);
    logger.log.mockClear();

    await expect(run()).resolves.toBe(true);

    const applied = logged().filter((message) => message.startsWith('Applied'));
    expect(applied).toEqual(allTags.slice(1).map((tag) => `Applied ${tag}`));
    expect(await appliedCount()).toBe(allTags.length);
  });

  it('fails without applying anything and logs only the error code', async () => {
    const broken = migrationsCopy((folder, copy) => {
      const last = copy.entries[copy.entries.length - 1];
      copy.entries.push({
        ...last,
        idx: last.idx + 1,
        tag: '9999_broken',
        when: last.when + 1,
      });
      writeFileSync(
        join(folder, '9999_broken.sql'),
        'CREATE TABLE "partial" ("id" integer);\n--> statement-breakpoint\n' +
          'ALTER TABLE "secret_missing_table" ADD COLUMN "x" integer;',
      );
    });
    await run();

    await expect(run(broken)).resolves.toBe(false);

    expect(logger.error).toHaveBeenCalledExactlyOnceWith(
      'Migrations failed, none applied (code: 42P01).',
    );
    const output = [...logged(), ...logger.error.mock.calls.flat()].join('\n');
    expect(output).not.toMatch(/secret_missing_table|partial/);
    expect(await appliedCount()).toBe(allTags.length);
    const partial = await client.query<{ exists: boolean }>(
      "select to_regclass('public.partial') is not null as exists",
    );
    expect(partial.rows[0].exists).toBe(false);
  });

  it('refuses a migration older than the last one applied', async () => {
    const outOfOrder = migrationsCopy((folder, copy) => {
      const [first] = copy.entries;
      copy.entries.push({
        ...first,
        idx: copy.entries.length,
        tag: '9999_out_of_order',
        when: first.when + 1,
      });
      writeFileSync(
        join(folder, '9999_out_of_order.sql'),
        'CREATE TABLE "out_of_order" ("id" integer);',
      );
    });
    await run();

    await expect(run(outOfOrder)).resolves.toBe(false);

    expect(logger.error).toHaveBeenCalledExactlyOnceWith(
      expect.stringContaining('9999_out_of_order is older than the last'),
    );
    expect(await appliedCount()).toBe(allTags.length);
  });

  it('fails when the migrations folder is missing', async () => {
    await expect(run(join(tmpdir(), 'nutri-no-such-folder'))).resolves.toBe(
      false,
    );

    expect(logger.error).toHaveBeenCalledExactlyOnceWith(
      'Migrations failed, none applied (code: ENOENT).',
    );
  });
});

describe('errorCode', () => {
  it('finds the code along the cause chain', () => {
    const cause = Object.assign(new Error('relation "x" does not exist'), {
      code: '42P01',
    });

    expect(errorCode(new Error('Failed query', { cause }))).toBe('42P01');
  });

  it("falls back to the error's name", () => {
    expect(errorCode(new TypeError('boom'))).toBe('TypeError');
    expect(errorCode('boom')).toBe('unknown');
  });
});
