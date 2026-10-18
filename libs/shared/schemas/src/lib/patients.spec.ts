import { createPatientSchema, updatePatientSchema } from './patients.js';

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
