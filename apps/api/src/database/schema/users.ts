import { pgTable, text } from 'drizzle-orm/pg-core';
import { baseColumns } from './columns';

export const users = pgTable('users', {
  ...baseColumns,
  email: text().notNull().unique(),
  name: text().notNull(),
});
