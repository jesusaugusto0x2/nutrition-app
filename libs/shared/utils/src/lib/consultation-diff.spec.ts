import {
  type ConsultationMeasurements,
  diffConsultations,
} from './consultation-diff.js';

const previous: ConsultationMeasurements = {
  date: '2026-07-17',
  weightKg: 78.4,
  heightM: 1.62,
  armCm: 31,
  waistCm: 92,
  legCm: 60,
  hipCm: 108,
};

describe('diffConsultations', () => {
  it('returns current minus previous for every measurement', () => {
    const current = {
      ...previous,
      date: '2026-08-16',
      weightKg: 77.5,
      armCm: 30.7,
      waistCm: 90.5,
      legCm: 59.5,
      hipCm: 107,
    };

    expect(diffConsultations(previous, current)).toEqual({
      days: 30,
      weightKg: -0.9,
      heightM: 0,
      bmi: -0.4,
      armCm: -0.3,
      waistCm: -1.5,
      legCm: -0.5,
      hipCm: -1,
    });
  });

  it('reports gains as positive values', () => {
    const current = { ...previous, date: '2026-08-16', weightKg: 79.6 };

    expect(diffConsultations(previous, current).weightKg).toBe(1.2);
  });

  it('returns null for measurements missing in either consultation', () => {
    const current = {
      ...previous,
      date: '2026-08-16',
      heightM: null,
      waistCm: null,
    };

    const diff = diffConsultations(previous, current);

    expect(diff.heightM).toBeNull();
    expect(diff.bmi).toBeNull();
    expect(diff.waistCm).toBeNull();
    expect(diff.hipCm).toBe(0);
  });

  it('accepts two consultations on the same day', () => {
    expect(diffConsultations(previous, previous).days).toBe(0);
  });

  it('rejects consultations given in the wrong order', () => {
    const later = { ...previous, date: '2026-08-16' };

    expect(() => diffConsultations(later, previous)).toThrow(RangeError);
  });
});
