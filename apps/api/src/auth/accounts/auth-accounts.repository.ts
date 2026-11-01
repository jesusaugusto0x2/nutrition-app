import { Injectable } from '@nestjs/common';
import { and, eq } from 'drizzle-orm';
import { authAccounts } from '../../database/schema';
import type { Transaction } from '../../database/transaction-runner';

export type AuthProvider = (typeof authAccounts.$inferInsert)['provider'];

export interface ExternalIdentity {
  provider: AuthProvider;
  /** The provider's stable id for the person (Google `sub`), never an email. */
  providerAccountId: string;
}

// Not clinic-scoped: an external identity belongs to a user, who can belong to
// several clinics. Both methods run inside the transaction that resolves the
// account, so no method here takes the plain connection.
@Injectable()
export class AuthAccountsRepository {
  async findUserId(
    { provider, providerAccountId }: ExternalIdentity,
    tx: Transaction,
  ): Promise<string | undefined> {
    const [account] = await tx
      .select({ userId: authAccounts.userId })
      .from(authAccounts)
      .where(
        and(
          eq(authAccounts.provider, provider),
          eq(authAccounts.providerAccountId, providerAccountId),
        ),
      )
      .limit(1);
    return account?.userId;
  }

  /**
   * Links the identity to the user. An identity that is already linked fails
   * on the unique constraint, rolling `tx` back: it must never move to another
   * user or be reported as linked to this one.
   */
  async link(
    userId: string,
    identity: ExternalIdentity,
    tx: Transaction,
  ): Promise<void> {
    await tx.insert(authAccounts).values({ userId, ...identity });
  }
}
