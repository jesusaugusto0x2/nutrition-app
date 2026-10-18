import type { Database } from '../client';
import { clinics, consultations, patients } from '../schema';

// Minimal fictional records for repository tests. Test-only.

export async function insertClinic(db: Database, name = 'Test clinic') {
  const [clinic] = await db.insert(clinics).values({ name }).returning();
  return clinic;
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
