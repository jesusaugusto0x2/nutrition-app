import { z } from 'zod';
import { checkProductionSslMode, databaseUrlSchema, parseEnv } from './env';

/**
 * Environment of the migration entry point (`database/migrate.ts`). It reads
 * only `DATABASE_MIGRATION_URL`, the owner role's direct connection, never
 * the app's `DATABASE_URL` (docs/deployment.md "Migrations").
 */
const migrationEnvSchema = z
  .object({
    NODE_ENV: z
      .enum(['development', 'test', 'production'])
      .default('development'),
    DATABASE_MIGRATION_URL: databaseUrlSchema,
  })
  .superRefine((env, ctx) => {
    if (env.NODE_ENV === 'production') {
      checkProductionSslMode(
        env.DATABASE_MIGRATION_URL,
        'DATABASE_MIGRATION_URL',
        ctx,
      );
    }
  });

export type MigrationConfig = z.infer<typeof migrationEnvSchema>;

/** Validates the migration environment; errors name variables, never values. */
export function loadMigrationConfig(
  env: NodeJS.ProcessEnv = process.env,
): MigrationConfig {
  return parseEnv(migrationEnvSchema, env);
}
