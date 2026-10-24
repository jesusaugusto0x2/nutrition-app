import type { Consultation } from '@nutri/schemas';
import { draftFrom, readDraft } from './record-draft';

const consultation: Consultation = {
  id: '00000000-0000-4000-8000-000000000001',
  patientId: '00000000-0000-4000-8000-000000000002',
  date: '2026-06-02',
  weightKg: 66.9,
  heightM: 1.62,
  armCm: 29,
  waistCm: 85.5,
  legCm: null,
  hipCm: 100,
  notes: null,
  createdAt: '2026-06-02T10:00:00.000Z',
  updatedAt: '2026-06-02T10:00:00.000Z',
};

describe('draftFrom', () => {
  it('formats values as the user reads them', () => {
    expect(draftFrom(consultation)).toEqual({
      date: '02/06/2026',
      weightKg: '66,9',
      armCm: '29',
      waistCm: '85,5',
      legCm: '',
      hipCm: '100',
    });
  });
});

describe('readDraft', () => {
  it('reads back an unchanged draft', () => {
    expect(readDraft(draftFrom(consultation))).toEqual({
      date: '2026-06-02',
      weightKg: 66.9,
      armCm: 29,
      waistCm: 85.5,
      legCm: null,
      hipCm: 100,
    });
  });

  it('turns cleared measurements into null', () => {
    const draft = { ...draftFrom(consultation), armCm: ' ' };
    expect(readDraft(draft)?.armCm).toBeNull();
  });

  it('cannot be saved without a valid date and weight', () => {
    const draft = draftFrom(consultation);
    expect(readDraft({ ...draft, date: '31/02/2026' })).toBeNull();
    expect(readDraft({ ...draft, weightKg: '' })).toBeNull();
    expect(readDraft({ ...draft, weightKg: '0' })).toBeNull();
  });

  it('cannot be saved with an unreadable measurement', () => {
    expect(
      readDraft({ ...draftFrom(consultation), waistCm: 'ochenta' }),
    ).toBeNull();
  });
});
