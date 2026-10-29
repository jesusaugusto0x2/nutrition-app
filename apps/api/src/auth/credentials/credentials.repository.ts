import { Inject, Injectable } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import type { Database } from '../../database/client';
import { DATABASE } from '../../database/database.tokens';
import { users } from '../../database/schema';

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
}
