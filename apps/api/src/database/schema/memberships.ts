import { index, pgEnum, pgTable, unique, uuid } from 'drizzle-orm/pg-core';
import { clinics } from './clinics';
import { baseColumns } from './columns';
import { users } from './users';

export const membershipRole = pgEnum('membership_role', [
  'owner',
  'nutritionist',
  'assistant',
]);

export const memberships = pgTable(
  'memberships',
  {
    ...baseColumns,
    userId: uuid()
      .notNull()
      .references(() => users.id),
    clinicId: uuid()
      .notNull()
      .references(() => clinics.id),
    role: membershipRole().notNull(),
  },
  (table) => [
    // Explicit name: drizzle does not apply snake_case to generated
    // constraint names.
    unique('memberships_user_id_clinic_id_unique').on(
      table.userId,
      table.clinicId,
    ),
    index().on(table.clinicId),
  ],
);
