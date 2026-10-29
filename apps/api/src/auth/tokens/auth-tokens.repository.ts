import { Inject, Injectable } from '@nestjs/common';
import { and, eq } from 'drizzle-orm';
import type { Database } from '../../database/client';
import { DATABASE } from '../../database/database.tokens';
import { authTokens } from '../../database/schema';

export type AuthTokenPurpose = (typeof authTokens.$inferSelect)['purpose'];

export type NewAuthToken = Pick<
  typeof authTokens.$inferInsert,
  'userId' | 'purpose' | 'tokenHash' | 'expiresAt'
>;

// One-time tokens are not clinic-scoped and are not clinical records:
// replaced tokens are physically deleted (see docs/architecture.md).
@Injectable()
export class AuthTokensRepository {
  constructor(@Inject(DATABASE) private readonly db: Database) {}

  /**
   * Stores a new token and deletes the user's other tokens of the same
   * purpose, so only the latest emailed link works.
   */
  async replace(token: NewAuthToken): Promise<void> {
    await this.db.transaction(async (tx) => {
      await tx
        .delete(authTokens)
        .where(
          and(
            eq(authTokens.userId, token.userId),
            eq(authTokens.purpose, token.purpose),
          ),
        );
      await tx.insert(authTokens).values(token);
    });
  }
}
