import { Inject, Injectable } from '@nestjs/common';
import type { CreatePatientInput, UpdatePatientInput } from '@nutri/schemas';
import { and, asc, eq, isNull } from 'drizzle-orm';
import type { Database } from '../../database/client';
import { DATABASE } from '../../database/database.tokens';
import { patients } from '../../database/schema';

export type PatientRow = typeof patients.$inferSelect;

/**
 * Data access for patients. Every query is scoped to a clinic and excludes
 * soft-deleted rows; there is intentionally no method without `clinicId`.
 */
@Injectable()
export class PatientsRepository {
  constructor(@Inject(DATABASE) private readonly db: Database) {}

  findAll(clinicId: string): Promise<PatientRow[]> {
    return this.db
      .select()
      .from(patients)
      .where(activeInClinic(clinicId))
      .orderBy(asc(patients.lastName), asc(patients.firstName));
  }

  async findById(
    clinicId: string,
    patientId: string,
  ): Promise<PatientRow | undefined> {
    const [row] = await this.db
      .select()
      .from(patients)
      .where(and(activeInClinic(clinicId), eq(patients.id, patientId)))
      .limit(1);
    return row;
  }

  async create(
    clinicId: string,
    input: CreatePatientInput,
  ): Promise<PatientRow> {
    const [row] = await this.db
      .insert(patients)
      .values({ ...input, clinicId })
      .returning();
    return row;
  }

  async update(
    clinicId: string,
    patientId: string,
    input: UpdatePatientInput,
  ): Promise<PatientRow | undefined> {
    const [row] = await this.db
      .update(patients)
      .set(input)
      .where(and(activeInClinic(clinicId), eq(patients.id, patientId)))
      .returning();
    return row;
  }
}

function activeInClinic(clinicId: string) {
  return and(eq(patients.clinicId, clinicId), isNull(patients.deletedAt));
}
