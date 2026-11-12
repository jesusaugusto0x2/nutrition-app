import { z } from 'zod';

/** A `postgres://` or `postgresql://` connection string. */
export const databaseUrlSchema = z.url({ protocol: /^postgres(ql)?$/ });

/**
 * `sslmode` values a production connection string may state. `verify-full`
 * is the real one (Neon, docs/deployment.md "Database (Neon)"): pg 8 treats
 * `require` as `verify-full` with a warning, but pg 9 adopts libpq's meaning
 * and would stop checking the certificate, so `require` is rejected.
 * `disable` exists for the CI smoke test, which runs the production image
 * against a local Postgres without TLS; it is visible in review.
 */
const PRODUCTION_SSL_MODES = new Set(['verify-full', 'disable']);

/** Adds an issue on `key` unless `url` sets a production `sslmode`. */
export function checkProductionSslMode(
  url: string,
  key: string,
  ctx: z.core.$RefinementCtx,
): void {
  const sslMode = URL.canParse(url)
    ? new URL(url).searchParams.get('sslmode')
    : null;
  if (!sslMode || !PRODUCTION_SSL_MODES.has(sslMode)) {
    ctx.addIssue({
      code: 'custom',
      path: [key],
      message: 'Must set sslmode=verify-full in production',
    });
  }
}

/**
 * Validates environment variables against `schema`. The error names the
 * invalid variables only; values are never included because they may be
 * secrets.
 */
export function parseEnv<T extends z.ZodType>(
  schema: T,
  env: NodeJS.ProcessEnv,
): z.output<T> {
  const result = schema.safeParse(env);
  if (!result.success) {
    const problems = result.error.issues
      .map((issue) => `  - ${issue.path.join('.')}: ${issue.message}`)
      .join('\n');
    throw new Error(`Invalid environment configuration:\n${problems}`);
  }
  return result.data;
}
