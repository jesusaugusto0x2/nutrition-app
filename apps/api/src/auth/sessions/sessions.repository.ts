import { Inject, Injectable } from '@nestjs/common';
import { and, eq, gt, lte, or } from 'drizzle-orm';
import type { Database } from '../../database/client';
import { DATABASE } from '../../database/database.tokens';
import { sessions, users } from '../../database/schema';

export type NewSession = Pick<
  typeof sessions.$inferInsert,
  'userId' | 'tokenHash' | 'expiresAt' | 'lastUsedAt' | 'userAgent'
>;

/** Expiry cutoffs computed by the service: a session is active when it
 * expires after `now` and was last used after `idleSince`. */
export interface ActiveSessionCutoffs {
  now: Date;
  idleSince: Date;
}

const activeSessionColumns = {
  id: sessions.id,
  lastUsedAt: sessions.lastUsedAt,
  user: {
    id: users.id,
    email: users.email,
    name: users.name,
    emailVerifiedAt: users.emailVerifiedAt,
  },
};

export interface ActiveSessionRow {
  id: string;
  lastUsedAt: Date;
  user: {
    id: string;
    email: string;
    name: string;
    emailVerifiedAt: Date | null;
  };
}

// Sessions are not clinic-scoped and are not clinical records: revoked and
// expired sessions are physically deleted (see docs/architecture.md).
@Injectable()
export class SessionsRepository {
  constructor(@Inject(DATABASE) private readonly db: Database) {}

  async create(values: NewSession): Promise<{ id: string }> {
    const [row] = await this.db
      .insert(sessions)
      .values(values)
      .returning({ id: sessions.id });
    return row;
  }

  async findActiveByTokenHash(
    tokenHash: string,
    { now, idleSince }: ActiveSessionCutoffs,
  ): Promise<ActiveSessionRow | undefined> {
    const [row] = await this.db
      .select(activeSessionColumns)
      .from(sessions)
      .innerJoin(users, eq(users.id, sessions.userId))
      .where(
        and(
          eq(sessions.tokenHash, tokenHash),
          gt(sessions.expiresAt, now),
          gt(sessions.lastUsedAt, idleSince),
        ),
      )
      .limit(1);
    return row;
  }

  async touch(sessionId: string, lastUsedAt: Date): Promise<void> {
    await this.db
      .update(sessions)
      .set({ lastUsedAt })
      .where(eq(sessions.id, sessionId));
  }

  async deleteByTokenHash(tokenHash: string): Promise<void> {
    await this.db.delete(sessions).where(eq(sessions.tokenHash, tokenHash));
  }

  async deleteById(sessionId: string): Promise<void> {
    await this.db.delete(sessions).where(eq(sessions.id, sessionId));
  }

  async deleteAllForUser(userId: string): Promise<void> {
    await this.db.delete(sessions).where(eq(sessions.userId, userId));
  }

  /**
   * Deletes every session `findActiveByTokenHash` would reject: the exact
   * opposite of its filter. Returns how many rows were deleted.
   */
  async deleteInactive({
    now,
    idleSince,
  }: ActiveSessionCutoffs): Promise<number> {
    const deleted = await this.db
      .delete(sessions)
      .where(
        or(lte(sessions.expiresAt, now), lte(sessions.lastUsedAt, idleSince)),
      )
      .returning({ id: sessions.id });
    return deleted.length;
  }
}
