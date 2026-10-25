import { sql } from 'drizzle-orm';
import { check, pgTable, text, timestamp } from 'drizzle-orm/pg-core';
import { baseColumns } from './columns';

export const users = pgTable(
  'users',
  {
    ...baseColumns,
    // Stored normalized with `normalizeEmail` from @nutri/schemas.
    email: text().notNull().unique(),
    name: text().notNull(),
    // argon2id hash; null for users who only sign in with Google.
    passwordHash: text(),
    emailVerifiedAt: timestamp({ withTimezone: true }),
  },
  (table) => [
    // Backs `normalizeEmail`: a case or whitespace variant of an email is
    // rejected, so the unique constraint above is effectively
    // case-insensitive.
    check(
      'users_email_normalized_check',
      sql`${table.email} = lower(btrim(${table.email}))`,
    ),
  ],
);
