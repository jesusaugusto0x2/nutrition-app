import { timestamp, uuid } from 'drizzle-orm/pg-core';

// Columns shared by every table. Keys are camelCase; the client and
// drizzle-kit both run with `casing: 'snake_case'`, so they map to
// id / created_at / updated_at in the database.
export const baseColumns = {
  id: uuid().primaryKey().defaultRandom(),
  createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp({ withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
};

// Clinical records are never physically deleted (see CLAUDE.md).
export const softDeleteColumn = {
  deletedAt: timestamp({ withTimezone: true }),
};
