import { Inject, Injectable } from '@nestjs/common';
import type { AuthPatientAccess } from '@nutri/schemas';
import { and, asc, eq, isNull } from 'drizzle-orm';
import type { Database } from '../../database/client';
import { DATABASE } from '../../database/database.tokens';
import { patientAccess, patients } from '../../database/schema';
import type { Transaction } from '../../database/transaction-runner';

/**
 * Data access for portal grants. Lookups go by user, not by clinic: a guardian
 * can have patients in several clinics. Soft-deleted patients are excluded.
 */
@Injectable()
export class PatientAccessRepository {
  constructor(@Inject(DATABASE) private readonly db: Database) {}

  async findPatientIdsByUser(userId: string): Promise<string[]> {
    const rows = await this.db
      .select({ patientId: patientAccess.patientId })
      .from(patientAccess)
      .innerJoin(patients, eq(patients.id, patientAccess.patientId))
      .where(and(eq(patientAccess.userId, userId), isNull(patients.deletedAt)))
      .orderBy(asc(patientAccess.createdAt), asc(patientAccess.id));
    return rows.map((row) => row.patientId);
  }

  findAllByUser(
    userId: string,
    tx?: Transaction,
  ): Promise<AuthPatientAccess[]> {
    return (tx ?? this.db)
      .select({
        patientId: patientAccess.patientId,
        firstName: patients.firstName,
        lastName: patients.lastName,
        relationship: patientAccess.relationship,
      })
      .from(patientAccess)
      .innerJoin(patients, eq(patients.id, patientAccess.patientId))
      .where(and(eq(patientAccess.userId, userId), isNull(patients.deletedAt)))
      .orderBy(asc(patientAccess.createdAt), asc(patientAccess.id));
  }
}
