import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { sql } from 'drizzle-orm';
import { createDatabase, type Database } from '../client';
import {
  clinics,
  consultations,
  memberships,
  patients,
  users,
} from '../schema';
import { SEED_CLINIC_ID, SEED_OWNER_USER_ID } from './seed-ids';

// Fictional development data only. Dates are relative to the day the seed
// runs so ages and consultation history stay realistic.

interface MeasurementTrend {
  start: number;
  deltaPerVisit: number;
}

interface PatientProfile {
  firstName: string;
  lastName: string;
  birthDate: string;
  sex: 'female' | 'male';
  phone: string;
  address: string;
  visits: 3 | 4;
  weightKg: MeasurementTrend;
  heightM: MeasurementTrend;
  waistCm: MeasurementTrend;
  hipCm: MeasurementTrend;
  armCm: MeasurementTrend;
  legCm: MeasurementTrend;
  notes: string[];
}

const PATIENTS: PatientProfile[] = [
  {
    firstName: 'María Fernanda',
    lastName: 'López',
    birthDate: '1988-03-14',
    sex: 'female',
    phone: '+58 412 555 0101',
    address: 'Av. Principal, Edif. Sol, Apto 4B',
    visits: 4,
    weightKg: { start: 78.4, deltaPerVisit: -1.2 },
    heightM: { start: 1.62, deltaPerVisit: 0 },
    waistCm: { start: 92, deltaPerVisit: -1.5 },
    hipCm: { start: 108, deltaPerVisit: -1 },
    armCm: { start: 31, deltaPerVisit: -0.3 },
    legCm: { start: 60, deltaPerVisit: -0.5 },
    notes: ['Primera consulta. Objetivo: reducir peso.', 'Buena adherencia.'],
  },
  {
    firstName: 'Carlos Andrés',
    lastName: 'Pérez',
    birthDate: '1979-11-02',
    sex: 'male',
    phone: '+58 414 555 0102',
    address: 'Calle 5, Casa 12',
    visits: 4,
    weightKg: { start: 96, deltaPerVisit: -1.6 },
    heightM: { start: 1.76, deltaPerVisit: 0 },
    waistCm: { start: 104, deltaPerVisit: -2 },
    hipCm: { start: 106, deltaPerVisit: -1 },
    armCm: { start: 35, deltaPerVisit: -0.4 },
    legCm: { start: 62, deltaPerVisit: -0.5 },
    notes: ['Hipertensión controlada.', 'Aumentó actividad física.'],
  },
  {
    // Minor: weight and height increase with growth.
    firstName: 'Valentina',
    lastName: 'Rodríguez',
    birthDate: '2012-06-21',
    sex: 'female',
    phone: '+58 424 555 0103',
    address: 'Urb. Los Pinos, Calle 3',
    visits: 3,
    weightKg: { start: 46.2, deltaPerVisit: 0.5 },
    heightM: { start: 1.54, deltaPerVisit: 0.01 },
    waistCm: { start: 64, deltaPerVisit: 0.3 },
    hipCm: { start: 82, deltaPerVisit: 0.5 },
    armCm: { start: 22, deltaPerVisit: 0.2 },
    legCm: { start: 46, deltaPerVisit: 0.3 },
    notes: ['Acompañada por su madre.', 'Crecimiento acorde a la edad.'],
  },
  {
    firstName: 'José Gregorio',
    lastName: 'Martínez',
    birthDate: '1965-01-30',
    sex: 'male',
    phone: '+58 416 555 0104',
    address: 'Res. El Parque, Torre A, Piso 7',
    visits: 3,
    weightKg: { start: 88.5, deltaPerVisit: -0.9 },
    heightM: { start: 1.7, deltaPerVisit: 0 },
    waistCm: { start: 101, deltaPerVisit: -1.2 },
    hipCm: { start: 103, deltaPerVisit: -0.6 },
    armCm: { start: 32, deltaPerVisit: -0.2 },
    legCm: { start: 57, deltaPerVisit: -0.3 },
    notes: ['Glucemia en ayunas elevada.', 'Reducción de harinas refinadas.'],
  },
  {
    firstName: 'Daniela',
    lastName: 'Suárez',
    birthDate: '1995-09-08',
    sex: 'female',
    phone: '+58 412 555 0105',
    address: 'Av. Bolívar, Edif. Mar, Apto 2A',
    visits: 4,
    weightKg: { start: 58.2, deltaPerVisit: 0.5 },
    heightM: { start: 1.66, deltaPerVisit: 0 },
    waistCm: { start: 68, deltaPerVisit: 0 },
    hipCm: { start: 94, deltaPerVisit: 0.4 },
    armCm: { start: 26, deltaPerVisit: 0.3 },
    legCm: { start: 53, deltaPerVisit: 0.4 },
    notes: ['Objetivo: ganar masa muscular.', 'Entrena 4 veces por semana.'],
  },
  {
    // Minor: teenager with mild weight reduction.
    firstName: 'Luis Eduardo',
    lastName: 'Ramírez',
    birthDate: '2009-04-17',
    sex: 'male',
    phone: '+58 414 555 0106',
    address: 'Calle Real, Casa 45',
    visits: 3,
    weightKg: { start: 72.3, deltaPerVisit: -0.7 },
    heightM: { start: 1.73, deltaPerVisit: 0.005 },
    waistCm: { start: 86, deltaPerVisit: -1 },
    hipCm: { start: 96, deltaPerVisit: -0.5 },
    armCm: { start: 29, deltaPerVisit: 0 },
    legCm: { start: 55, deltaPerVisit: 0 },
    notes: ['Acompañado por su padre.', 'Menos bebidas azucaradas.'],
  },
];

// Small deterministic variation so trends do not look perfectly linear.
const NOISE = [0, 0.3, -0.2, 0.1];
const DAYS_BETWEEN_VISITS = 30;

function round(value: number, decimals: number): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

function measure(trend: MeasurementTrend, visit: number, decimals: number) {
  const noise = trend.deltaPerVisit === 0 ? 0 : (NOISE[visit] ?? 0);
  return round(trend.start + trend.deltaPerVisit * visit + noise, decimals);
}

function daysAgo(days: number): string {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() - days);
  return date.toISOString().slice(0, 10);
}

async function seed(db: Database): Promise<void> {
  await db.transaction(async (tx) => {
    await tx.execute(
      sql`TRUNCATE consultations, patient_access, patients, memberships, clinics, users`,
    );

    await tx.insert(clinics).values({
      id: SEED_CLINIC_ID,
      name: 'Consultorio Nutrición Integral',
    });
    await tx.insert(users).values({
      id: SEED_OWNER_USER_ID,
      email: 'owner@example.com',
      name: 'Ana Gabriela Torres',
    });
    await tx.insert(memberships).values({
      userId: SEED_OWNER_USER_ID,
      clinicId: SEED_CLINIC_ID,
      role: 'owner',
    });

    for (const profile of PATIENTS) {
      const [patient] = await tx
        .insert(patients)
        .values({
          clinicId: SEED_CLINIC_ID,
          firstName: profile.firstName,
          lastName: profile.lastName,
          birthDate: profile.birthDate,
          sex: profile.sex,
          phone: profile.phone,
          address: profile.address,
        })
        .returning({ id: patients.id });

      const rows = Array.from({ length: profile.visits }, (_, visit) => ({
        patientId: patient.id,
        clinicId: SEED_CLINIC_ID,
        date: daysAgo((profile.visits - 1 - visit) * DAYS_BETWEEN_VISITS + 3),
        weightKg: measure(profile.weightKg, visit, 1),
        heightM: measure(profile.heightM, visit, 2),
        waistCm: measure(profile.waistCm, visit, 1),
        hipCm: measure(profile.hipCm, visit, 1),
        armCm: measure(profile.armCm, visit, 1),
        legCm: measure(profile.legCm, visit, 1),
        notes: profile.notes[visit] ?? null,
      }));
      await tx.insert(consultations).values(rows);
    }
  });
}

async function main(): Promise<void> {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('Refusing to seed: NODE_ENV is production.');
  }

  const envFile = resolve(__dirname, '../../../../../.env');
  if (existsSync(envFile)) {
    process.loadEnvFile(envFile);
  }
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error('DATABASE_URL is not set. Copy .env.example to .env.');
  }

  const { db, close } = createDatabase(databaseUrl);
  try {
    await seed(db);
    console.log(
      `Seed complete: 1 clinic, 1 owner, ${PATIENTS.length} patients.`,
    );
  } finally {
    await close();
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
