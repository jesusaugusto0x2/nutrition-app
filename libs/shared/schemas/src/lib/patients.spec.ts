import {
  createPatientSchema,
  patientListItemSchema,
  patientListQuerySchema,
  updatePatientSchema,
} from './patients.js';

const validPatient = {
  firstName: 'Ana',
  lastName: 'Pérez',
  birthDate: '1990-05-10',
  sex: 'female',
};

describe('createPatientSchema', () => {
  it('accepts a minimal valid patient', () => {
    expect(createPatientSchema.safeParse(validPatient).success).toBe(true);
  });

  it('trims names and rejects blank ones', () => {
    expect(
      createPatientSchema.parse({ ...validPatient, firstName: '  Ana  ' })
        .firstName,
    ).toBe('Ana');
    expect(
      createPatientSchema.safeParse({ ...validPatient, lastName: '   ' })
        .success,
    ).toBe(false);
  });

  it('rejects a birth date in the future', () => {
    expect(
      createPatientSchema.safeParse({
        ...validPatient,
        birthDate: '2999-01-01',
      }).success,
    ).toBe(false);
  });

  it('rejects an invalid calendar date', () => {
    expect(
      createPatientSchema.safeParse({
        ...validPatient,
        birthDate: '1990-02-30',
      }).success,
    ).toBe(false);
  });

  it('stores blank optional text as null', () => {
    const parsed = createPatientSchema.parse({ ...validPatient, phone: '  ' });
    expect(parsed.phone).toBeNull();
  });
});

describe('updatePatientSchema', () => {
  it('accepts a partial update', () => {
    expect(updatePatientSchema.safeParse({ phone: '555' }).success).toBe(true);
  });

  it('rejects an empty update', () => {
    expect(updatePatientSchema.safeParse({}).success).toBe(false);
  });
});

describe('patientListQuerySchema', () => {
  it('defaults the sort to recent', () => {
    expect(patientListQuerySchema.parse({})).toEqual({ sort: 'recent' });
  });

  it('rejects an unknown sort and a blank search', () => {
    expect(patientListQuerySchema.safeParse({ sort: 'weight' }).success).toBe(
      false,
    );
    expect(patientListQuerySchema.safeParse({ q: '   ' }).success).toBe(false);
  });
});

describe('patientListItemSchema', () => {
  const patient = {
    id: '00000000-0000-4000-8000-00000000000b',
    firstName: 'Ana',
    lastName: 'Pérez',
    birthDate: '1990-05-10',
    sex: 'female',
    phone: null,
    address: null,
    createdAt: '2026-01-01T10:00:00.000Z',
    updatedAt: '2026-01-02T10:00:00.000Z',
  };

  it('accepts a patient without consultations', () => {
    const item = {
      ...patient,
      lastConsultation: null,
      currentWeight: null,
      trendWeightKg: null,
    };
    expect(patientListItemSchema.parse(item)).toEqual(item);
  });

  it('rejects a last consultation without weight', () => {
    expect(
      patientListItemSchema.safeParse({
        ...patient,
        lastConsultation: { date: '2026-01-15' },
        currentWeight: null,
        trendWeightKg: null,
      }).success,
    ).toBe(false);
  });
});
