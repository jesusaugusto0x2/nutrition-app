import { randomBytes } from 'node:crypto';
import { Injectable, type OnModuleInit } from '@nestjs/common';
import * as argon2 from 'argon2';
import { PASSWORD_HASH_OPTIONS } from './password-hash-options';

// `needsRehash` compares cost parameters only, not the variant.
const ARGON2ID_PREFIX = '$argon2id$';

/** Hashes and verifies passwords. Never logs or returns the plain value. */
@Injectable()
export class PasswordHasher implements OnModuleInit {
  private dummyHash: Promise<string> | undefined;

  async onModuleInit(): Promise<void> {
    // Created at startup so the first `verifyDummy` is not slower than later
    // ones (which would itself be a timing signal).
    await this.getDummyHash();
  }

  hash(password: string): Promise<string> {
    return argon2.hash(normalizePassword(password), PASSWORD_HASH_OPTIONS);
  }

  verify(hash: string, password: string): Promise<boolean> {
    return argon2.verify(hash, normalizePassword(password));
  }

  /** Whether a stored hash uses another variant or older parameters. */
  needsRehash(hash: string): boolean {
    return (
      !hash.startsWith(ARGON2ID_PREFIX) ||
      argon2.needsRehash(hash, PASSWORD_HASH_OPTIONS)
    );
  }

  /**
   * Spends the same time as `verify` against a throwaway hash, always
   * failing. Used when there is no hash to check (unknown email, Google-only
   * account), so response time does not reveal which emails exist.
   */
  async verifyDummy(password: string): Promise<false> {
    await this.verify(await this.getDummyHash(), password);
    return false;
  }

  // Hashed with the current parameters so it costs the same as a real
  // verification; the random input matches no password.
  private getDummyHash(): Promise<string> {
    this.dummyHash ??= this.hash(randomBytes(32).toString('base64url'));
    return this.dummyHash;
  }
}

/**
 * NFC, as NIST SP 800-63B-4 recommends: the same password typed on another
 * device (e.g. "ñ" as one code point or as "n" plus a combining tilde) must
 * hash the same.
 */
function normalizePassword(password: string): string {
  return password.normalize('NFC');
}
