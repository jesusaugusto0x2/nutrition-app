import { z } from 'zod';
import { idSchema } from './common.js';

/**
 * The single way emails are normalized before they are stored or looked up:
 * trimmed and lowercased. The database backs it with a CHECK constraint
 * (`users_email_normalized_check`), so an email that skipped this helper is
 * rejected instead of creating a case-variant duplicate.
 */
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/** Email typed by a user, normalized before it is validated. */
export const emailSchema = z
  .string()
  .overwrite(normalizeEmail)
  .pipe(z.email().max(254));

/**
 * Signed-in user as returned by the auth API. Never add credentials here:
 * the password hash must not leave the API.
 */
export const authUserSchema = z.object({
  id: idSchema,
  email: z.string(),
  name: z.string(),
  emailVerified: z.boolean(),
});

export type AuthUser = z.infer<typeof authUserSchema>;

/**
 * Longest password accepted. Hashing cost grows with input length, so an
 * unbounded password would let one request burn CPU (denial of service).
 */
export const PASSWORD_MAX_LENGTH = 256;

/** Body of `POST /api/auth/sign-in`. The password is never trimmed. */
export const signInSchema = z.object({
  email: emailSchema,
  password: z.string().min(1).max(PASSWORD_MAX_LENGTH),
});

export type SignIn = z.infer<typeof signInSchema>;
