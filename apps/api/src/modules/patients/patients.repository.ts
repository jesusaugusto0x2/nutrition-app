import { Inject, Injectable } from '@nestjs/common';
import type {
  CreatePatientInput,
  PatientListQuery,
  UpdatePatientInput,
} from '@nutri/schemas';
import { and, asc, eq, getTableColumns, isNull, sql } from 'drizzle-orm';
import type { Database } from '../../database/client';
import { DATABASE } from '../../database/database.tokens';
import { consultations, patients } from '../../database/schema';

export type PatientRow = typeof patients.$inferSelect;

export type PatientListRow = {
  patient: PatientRow;
  lastConsultationDate: string | null;
  currentWeight: number | null;
  previousWeight: number | null;
};

// Spanish accents folded to their base letters, applied in SQL with
// translate() so the search needs no extension and behaves identically on
// PGlite and Neon.
const ACCENTED = 'áàäâãéèëêíìïîóòöôõúùüûñç';
const UNACCENTED = 'aaaaaeeeeiiiiooooouuuunc';

/**
 * Data access for patients. Every query is scoped to a clinic and excludes
 * soft-deleted rows; there is intentionally no method without `clinicId`.
 */
@Injectable()
export class PatientsRepository {
  constructor(@Inject(DATABASE) private readonly db: Database) {}

  /**
   * The clinic's patients with the weight of their two latest consultations,
   * searched by name and sorted for the list. Soft-deleted consultations do
   * not count towards the summary.
   */
  async findList(
    clinicId: string,
    query: PatientListQuery,
  ): Promise<PatientListRow[]> {
    // Latest consultation weights, as correlated subqueries: ::text keeps the
    // calendar date a `YYYY-MM-DD` string and ::float8 a JS number, whatever
    // the driver does with date and numeric types. The correlation is written
    // with the qualified table name on purpose: drizzle renders a column
    // interpolated into a sql fragment unqualified ("id"), which the
    // subquery would resolve against consultations itself and never match.
    const latestWeight = (offset: number) => sql<number | null>`(
      select c.weight_kg::float8 from ${consultations} c
      where c.patient_id = patients.id and c.clinic_id = patients.clinic_id
        and c.deleted_at is null
      order by c.date desc, c.created_at desc
      limit 1 offset ${offset}
    )`;
    const enriched = this.db
      .select({
        ...getTableColumns(patients),
        lastConsultationDate: sql<
          string | null
        >`(select c.date::text from ${consultations} c
          where c.patient_id = patients.id and c.clinic_id = patients.clinic_id
            and c.deleted_at is null
          order by c.date desc, c.created_at desc limit 1)`.as(
          'last_consultation_date',
        ),
        currentWeight: latestWeight(0).as('current_weight'),
        previousWeight: latestWeight(1).as('previous_weight'),
      })
      .from(patients)
      .where(activeInClinic(clinicId))
      .as('enriched');

    const search = query.q
      ? sql`translate(lower(${enriched.firstName} || ' ' || ${enriched.lastName}), ${ACCENTED}, ${UNACCENTED})
          like '%' || translate(lower(${escapeLikePattern(query.q)}), ${ACCENTED}, ${UNACCENTED}) || '%'
          escape '\\'`
      : undefined;

    const rows = await this.db
      .select()
      .from(enriched)
      .where(search)
      .orderBy(
        ...(query.sort === 'name'
          ? [asc(enriched.lastName), asc(enriched.firstName)]
          : [
              sql`${enriched.lastConsultationDate} desc nulls last`,
              asc(enriched.lastName),
              asc(enriched.firstName),
            ]),
      );

    return rows.map(
      ({
        lastConsultationDate,
        currentWeight,
        previousWeight,
        ...patient
      }) => ({
        patient,
        lastConsultationDate,
        currentWeight,
        previousWeight,
      }),
    );
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

/** `%`, `_` and `\` in the search text match literally, not as wildcards. */
function escapeLikePattern(text: string): string {
  return text.replace(/[\\%_]/g, (char) => `\\${char}`);
}
