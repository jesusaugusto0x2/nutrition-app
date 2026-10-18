import { createConsultationSchema } from './consultations.js';

describe('createConsultationSchema', () => {
  it('requires only date and weight', () => {
    expect(
      createConsultationSchema.safeParse({ date: '2026-01-15', weightKg: 70.5 })
        .success,
    ).toBe(true);
  });

  it.each([0, -1, 501])('rejects weight %s kg', (weightKg) => {
    expect(
      createConsultationSchema.safeParse({ date: '2026-01-15', weightKg })
        .success,
    ).toBe(false);
  });

  it('rejects height given in centimeters instead of meters', () => {
    expect(
      createConsultationSchema.safeParse({
        date: '2026-01-15',
        weightKg: 70,
        heightM: 170,
      }).success,
    ).toBe(false);
  });

  it('rejects a consultation dated in the future', () => {
    expect(
      createConsultationSchema.safeParse({ date: '2999-01-01', weightKg: 70 })
        .success,
    ).toBe(false);
  });
});
