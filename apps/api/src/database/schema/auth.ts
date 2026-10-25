import {
  index,
  pgEnum,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';
import { baseColumns } from './columns';
import { users } from './users';

// Auth tables are not clinic-scoped (a user can belong to several clinics)
// and are not clinical records: expired sessions and used or expired tokens
// may be physically deleted. Tokens are stored only as SHA-256 hashes, never
// raw. Constraint names are explicit: drizzle does not apply snake_case to
// generated ones. See "Authentication" in docs/architecture.md.

/** Longest `User-Agent` kept; longer values are truncated before insert. */
export const USER_AGENT_MAX_LENGTH = 512;

export const sessions = pgTable(
  'sessions',
  {
    ...baseColumns,
    userId: uuid()
      .notNull()
      .references(() => users.id),
    tokenHash: text().notNull(),
    expiresAt: timestamp({ withTimezone: true }).notNull(),
    lastUsedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    userAgent: varchar({ length: USER_AGENT_MAX_LENGTH }),
  },
  (table) => [
    unique('sessions_token_hash_unique').on(table.tokenHash),
    index().on(table.userId),
  ],
);

export const authProvider = pgEnum('auth_provider', ['google']);

// An external identity linked to a user. Users are matched by
// `provider_account_id` (Google `sub`), never by email, once linked.
export const authAccounts = pgTable(
  'auth_accounts',
  {
    ...baseColumns,
    userId: uuid()
      .notNull()
      .references(() => users.id),
    provider: authProvider().notNull(),
    providerAccountId: text().notNull(),
  },
  (table) => [
    unique('auth_accounts_provider_provider_account_id_unique').on(
      table.provider,
      table.providerAccountId,
    ),
    index().on(table.userId),
  ],
);

export const authTokenPurpose = pgEnum('auth_token_purpose', [
  'email_verification',
  'password_reset',
]);

// One-time tokens sent by email.
export const authTokens = pgTable(
  'auth_tokens',
  {
    ...baseColumns,
    userId: uuid()
      .notNull()
      .references(() => users.id),
    purpose: authTokenPurpose().notNull(),
    tokenHash: text().notNull(),
    expiresAt: timestamp({ withTimezone: true }).notNull(),
    usedAt: timestamp({ withTimezone: true }),
  },
  (table) => [
    unique('auth_tokens_token_hash_unique').on(table.tokenHash),
    index().on(table.userId),
  ],
);
