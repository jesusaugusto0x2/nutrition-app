import { pgTable, text } from 'drizzle-orm/pg-core';
import { baseColumns } from './columns';

export const clinics = pgTable('clinics', {
  ...baseColumns,
  name: text().notNull(),
});
