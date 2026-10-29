import * as argon2 from 'argon2';

/**
 * argon2id cost parameters: the OWASP Password Storage Cheat Sheet baseline
 * (19 MiB of memory, 2 iterations, 1 degree of parallelism), checked in
 * October 2026. Raising them later is safe: `PasswordHasher.needsRehash`
 * flags old hashes and sign-in rehashes them.
 *
 * In its own file (no Nest decorators) so the seed script can use it.
 */
export const PASSWORD_HASH_OPTIONS = {
  type: argon2.argon2id,
  memoryCost: 19456,
  timeCost: 2,
  parallelism: 1,
} as const;
