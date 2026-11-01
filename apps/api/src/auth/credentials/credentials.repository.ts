import { Inject, Injectable } from '@nestjs/common';
import { and, eq, gt, isNull, sql } from 'drizzle-orm';
import type { Database } from '../../database/client';
import { DATABASE } from '../../database/database.tokens';
import { authTokens, sessions, users } from '../../database/schema';
import type { Transaction } from '../../database/transaction-runner';
import type { AuthTokenPurpose } from '../tokens/auth-tokens.repository';

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

export interface NewUser {
  /** Must already be normalized (`normalizeEmail`). */
  email: string;
  name: string;
  passwordHash: string;
}

/** What a service needs to email a user. */
export interface UserRecipientRow {
  id: string;
  email: string;
  name: string;
}

const userRecipientColumns = {
  id: users.id,
  email: users.email,
  name: users.name,
};

export interface EmailVerification {
  tokenHash: string;
  now: Date;
}

/** A user whose email was just verified. */
export type VerifiedUserRow = Omit<CredentialsRow, 'passwordHash'>;

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

  /**
   * Creates an unverified user. Returns `undefined`, changing nothing, when
   * the email already has an account; the unique constraint decides, so two
   * concurrent sign-ups cannot both succeed.
   */
  async createUnverified(
    user: NewUser,
    tx?: Transaction,
  ): Promise<UserRecipientRow | undefined> {
    const [created] = await (tx ?? this.db)
      .insert(users)
      .values(user)
      .onConflictDoNothing({ target: users.email })
      .returning(userRecipientColumns);
    return created;
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
   */
  async resetPassword({
    tokenHash,
    passwordHash,
    now,
  }: PasswordReset): Promise<UserRecipientRow | undefined> {
    return this.db.transaction(async (tx) => {
      const userId = await this.consumeToken(
        tx,
        tokenHash,
        'password_reset',
        now,
      );
      if (!userId) {
        return undefined;
      }

      const [user] = await tx
        .update(users)
        .set({
          passwordHash,
          emailVerifiedAt: sql`coalesce(${users.emailVerifiedAt}, ${now.toISOString()}::timestamptz)`,
        })
        .where(eq(users.id, userId))
        .returning(userRecipientColumns);
      await tx.delete(sessions).where(eq(sessions.userId, userId));
      return user;
    });
  }

  /**
   * In one transaction: consumes an unused, unexpired `email_verification`
   * token and marks the email verified. Returns `undefined` when the token is
   * not valid or the email is already verified: a verification link signs the
   * user in, so a leftover one must not do it after, say, a password reset
   * ended every session.
   */
  async verifyEmail({
    tokenHash,
    now,
  }: EmailVerification): Promise<VerifiedUserRow | undefined> {
    return this.db.transaction(async (tx) => {
      const userId = await this.consumeToken(
        tx,
        tokenHash,
        'email_verification',
        now,
      );
      if (!userId) {
        return undefined;
      }

      const [user] = await tx
        .update(users)
        .set({ emailVerifiedAt: now })
        .where(and(eq(users.id, userId), isNull(users.emailVerifiedAt)))
        .returning({
          ...userRecipientColumns,
          emailVerifiedAt: users.emailVerifiedAt,
        });
      return user;
    });
  }

  /**
   * Marks an unused, unexpired token as used and returns its user. A single
   * conditional UPDATE, so two concurrent requests cannot both succeed.
   */
  private async consumeToken(
    tx: Transaction,
    tokenHash: string,
    purpose: AuthTokenPurpose,
    now: Date,
  ): Promise<string | undefined> {
    const [token] = await tx
      .update(authTokens)
      .set({ usedAt: now })
      .where(
        and(
          eq(authTokens.tokenHash, tokenHash),
          eq(authTokens.purpose, purpose),
          isNull(authTokens.usedAt),
          gt(authTokens.expiresAt, now),
        ),
      )
      .returning({ userId: authTokens.userId });
    return token?.userId;
  }
}
