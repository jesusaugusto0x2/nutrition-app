import type { Database } from '../client';
import { clinics, consultations, patients, sessions, users } from '../schema';

// Minimal fictional records for repository tests. Test-only.

export async function insertClinic(db: Database, name = 'Test clinic') {
  const [clinic] = await db.insert(clinics).values({ name }).returning();
  return clinic;
}

let userCount = 0;

export async function insertUser(
  db: Database,
  overrides: Partial<typeof users.$inferInsert> = {},
) {
  userCount += 1;
  const [user] = await db
    .insert(users)
    .values({
      email: `user${userCount}@example.com`,
      name: 'Test User',
      ...overrides,
    })
    .returning();
  return user;
}

export async function insertPatient(
  db: Database,
  clinicId: string,
  overrides: Partial<typeof patients.$inferInsert> = {},
) {
  const [patient] = await db
    .insert(patients)
    .values({
      clinicId,
      firstName: 'Test',
      lastName: 'Patient',
      birthDate: '1990-01-01',
      sex: 'female',
      ...overrides,
    })
    .returning();
  return patient;
}

export async function insertConsultation(
  db: Database,
  clinicId: string,
  patientId: string,
  overrides: Partial<typeof consultations.$inferInsert> = {},
) {
  const [consultation] = await db
    .insert(consultations)
    .values({
      clinicId,
      patientId,
      date: '2026-01-15',
      weightKg: 70,
      ...overrides,
    })
    .returning();
  return consultation;
}

let sessionCount = 0;

// `tokenHash` is a placeholder unless the test passes a real hash.
export async function insertSession(
  db: Database,
  userId: string,
  overrides: Partial<typeof sessions.$inferInsert> = {},
) {
  sessionCount += 1;
  const [session] = await db
    .insert(sessions)
    .values({
      userId,
      tokenHash: `test-token-hash-${sessionCount}`,
      expiresAt: new Date('2026-02-01T00:00:00.000Z'),
      lastUsedAt: new Date('2026-01-01T00:00:00.000Z'),
      ...overrides,
    })
    .returning();
  return session;
}
