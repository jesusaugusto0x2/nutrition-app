import { z } from 'zod';

export const APP_CONFIG = Symbol('APP_CONFIG');

const envSchema = z
  .object({
    NODE_ENV: z
      .enum(['development', 'test', 'production'])
      .default('development'),
    PORT: z.coerce.number().int().min(1).max(65535).default(3000),
    DATABASE_URL: z.url({ protocol: /^postgres(ql)?$/ }),
    // Absolute path to the built web app (apps/web/dist). Served by the API
    // in production only.
    WEB_DIST_DIR: z.string().min(1).optional(),
  })
  .superRefine((env, ctx) => {
    if (env.NODE_ENV === 'production' && !env.WEB_DIST_DIR) {
      ctx.addIssue({
        code: 'custom',
        path: ['WEB_DIST_DIR'],
        message: 'Required in production',
      });
    }
  });

export type AppConfig = z.infer<typeof envSchema>;

/**
 * Validates environment variables. Fails fast on startup with the names of
 * the invalid variables; values are never included because they may be
 * secrets.
 */
export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  const result = envSchema.safeParse(env);
  if (!result.success) {
    const problems = result.error.issues
      .map((issue) => `  - ${issue.path.join('.')}: ${issue.message}`)
      .join('\n');
    throw new Error(`Invalid environment configuration:\n${problems}`);
  }
  return result.data;
}
