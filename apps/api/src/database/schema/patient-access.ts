import { index, pgEnum, pgTable, unique, uuid } from 'drizzle-orm/pg-core';
import { baseColumns } from './columns';
import { patients } from './patients';
import { users } from './users';

export const patientAccessRelationship = pgEnum('patient_access_relationship', [
  'self',
  'guardian',
]);

// Grants a portal user read-only access to a patient: the patient themself or
// a guardian (for minors).
export const patientAccess = pgTable(
  'patient_access',
  {
    ...baseColumns,
    userId: uuid()
      .notNull()
      .references(() => users.id),
    patientId: uuid()
      .notNull()
      .references(() => patients.id),
    relationship: patientAccessRelationship().notNull(),
  },
  (table) => [
    unique('patient_access_user_id_patient_id_unique').on(
      table.userId,
      table.patientId,
    ),
    index().on(table.patientId),
  ],
);
