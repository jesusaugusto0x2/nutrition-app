import type { Consultation } from '@nutri/schemas';
import { todayIsoDate } from '@nutri/schemas';
import { formatDate } from '@/lib/format';
import {
  consultationFormDraftFrom,
  draftFrom,
  emptyConsultationFormDraft,
  readConsultationFormDraft,
  readConsultationFormMeasures,
  readDraft,
} from './record-draft';

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

describe('emptyConsultationFormDraft', () => {
  it('starts dated today with everything else blank', () => {
    const draft = emptyConsultationFormDraft();
    expect(draft.date).toBe(formatDate(todayIsoDate()));
    expect(draft.weightKg).toBe('');
    expect(draft.heightM).toBe('');
    expect(draft.notes).toBe('');
  });
});

describe('consultationFormDraftFrom', () => {
  it('adds height and notes to the record draft', () => {
    expect(
      consultationFormDraftFrom({ ...consultation, notes: 'Retuvo líquidos' }),
    ).toEqual({
      date: '02/06/2026',
      weightKg: '66,9',
      heightM: '1,62',
      armCm: '29',
      waistCm: '85,5',
      legCm: '',
      hipCm: '100',
      notes: 'Retuvo líquidos',
    });
  });
});

describe('readConsultationFormDraft', () => {
  it('reads back an unchanged draft', () => {
    expect(
      readConsultationFormDraft(
        consultationFormDraftFrom({
          ...consultation,
          notes: 'Retuvo líquidos',
        }),
      ),
    ).toEqual({
      date: '2026-06-02',
      weightKg: 66.9,
      heightM: 1.62,
      armCm: 29,
      waistCm: 85.5,
      legCm: null,
      hipCm: 100,
      notes: 'Retuvo líquidos',
    });
  });

  it('reads a height typed in centimeters and empty notes as null', () => {
    const draft = {
      ...emptyConsultationFormDraft(),
      date: '02/06/2026',
      weightKg: '66,9',
      heightM: '162',
    };
    const values = readConsultationFormDraft(draft);
    expect(values?.heightM).toBe(1.62);
    expect(values?.notes).toBeNull();
  });

  it('cannot be saved without weight or with an unreadable height', () => {
    const draft = consultationFormDraftFrom(consultation);
    expect(readConsultationFormDraft({ ...draft, weightKg: '' })).toBeNull();
    expect(readConsultationFormDraft({ ...draft, heightM: 'alta' })).toBeNull();
  });
});

describe('readConsultationFormMeasures', () => {
  it('parses each field on its own, without the save rule', () => {
    const draft = {
      ...emptyConsultationFormDraft(),
      weightKg: '68,5',
      waistCm: 'ochenta',
    };
    const measures = readConsultationFormMeasures(draft);
    expect(measures.date).toBe(todayIsoDate());
    expect(measures.weightKg).toBe(68.5);
    expect(measures.waistCm).toBeNull();
    expect(measures.heightM).toBeNull();
  });
});
