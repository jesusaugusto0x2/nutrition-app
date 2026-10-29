import { Inject, Injectable } from '@nestjs/common';
import { and, eq, gt, isNull, sql } from 'drizzle-orm';
import type { Database } from '../../database/client';
import { DATABASE } from '../../database/database.tokens';
import { authTokens, sessions, users } from '../../database/schema';

const credentialsColumns = {
  id: users.id,
  email: users.email,
  name: users.name,
  emailVerifiedAt: users.emailVerifiedAt,
  passwordHash: users.passwordHash,
};

/** A user with their password hash. Never leaves the auth module. */
export interface CredentialsRow {
  id: string;
  email: string;
  name: string;
  emailVerifiedAt: Date | null;
  /** null for users who only sign in with Google. */
  passwordHash: string | null;
}

export interface PasswordReset {
  tokenHash: string;
  passwordHash: string;
  now: Date;
}

/** The user whose password was reset, for the notification email. */
export interface ResetUserRow {
  id: string;
  email: string;
  name: string;
}

// Users are not clinic-scoped: a user can belong to several clinics.
@Injectable()
export class CredentialsRepository {
  constructor(@Inject(DATABASE) private readonly db: Database) {}

  /** `email` must already be normalized (`normalizeEmail`). */
  async findByEmail(email: string): Promise<CredentialsRow | undefined> {
    const [row] = await this.db
      .select(credentialsColumns)
      .from(users)
      .where(eq(users.email, email))
      .limit(1);
    return row;
  }

  async updatePasswordHash(
    userId: string,
    passwordHash: string,
  ): Promise<void> {
    await this.db
      .update(users)
      .set({ passwordHash })
      .where(eq(users.id, userId));
  }

  /**
   * In one transaction: consumes an unused, unexpired `password_reset`
   * token, stores the new hash, marks the email verified (the user proved
   * access to the inbox) and deletes every session of the user. Returns
   * `undefined`, changing nothing, when the token is not valid.
   *
   * Consuming is a single conditional UPDATE, so two concurrent requests
   * with the same token cannot both succeed.
   */
  async resetPassword({
    tokenHash,
    passwordHash,
    now,
  }: PasswordReset): Promise<ResetUserRow | undefined> {
    return this.db.transaction(async (tx) => {
      const [token] = await tx
        .update(authTokens)
        .set({ usedAt: now })
        .where(
          and(
            eq(authTokens.tokenHash, tokenHash),
            eq(authTokens.purpose, 'password_reset'),
            isNull(authTokens.usedAt),
            gt(authTokens.expiresAt, now),
          ),
        )
        .returning({ userId: authTokens.userId });
      if (!token) {
        return undefined;
      }

      const [user] = await tx
        .update(users)
        .set({
          passwordHash,
          emailVerifiedAt: sql`coalesce(${users.emailVerifiedAt}, ${now.toISOString()}::timestamptz)`,
        })
        .where(eq(users.id, token.userId))
        .returning({ id: users.id, email: users.email, name: users.name });
      await tx.delete(sessions).where(eq(sessions.userId, token.userId));
      return user;
    });
  }
}
