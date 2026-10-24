import type { Consultation } from '@nutri/schemas';
import { buildRecordRows, totalChanges } from './records';

function consultation(
  date: string,
  values: Partial<Consultation>,
): Consultation {
  return {
    id: `00000000-0000-4000-8000-0000000000${date.slice(5, 7)}`,
    patientId: '00000000-0000-4000-8000-000000000099',
    date,
    weightKg: 70,
    heightM: null,
    armCm: null,
    waistCm: null,
    legCm: null,
    hipCm: null,
    notes: null,
    createdAt: `${date}T10:00:00.000Z`,
    updatedAt: `${date}T10:00:00.000Z`,
    ...values,
  };
}

// Most recent first, as the API returns them.
const consultations = [
  consultation('2026-06-02', { weightKg: 66.9, waistCm: 85 }),
  consultation('2026-04-07', { weightKg: 70.1, waistCm: null }),
  consultation('2026-03-10', { weightKg: 72.4, heightM: 1.62, waistCm: 92 }),
];

const cell = (
  rows: ReturnType<typeof buildRecordRows>,
  row: number,
  key: string,
) => rows[row].cells.find((c) => c.column.key === key);

describe('buildRecordRows', () => {
  it('marks the latest and first consultations', () => {
    const rows = buildRecordRows(consultations);

    expect(rows.map((row) => [row.isLatest, row.isFirst])).toEqual([
      [true, false],
      [false, false],
      [false, true],
    ]);
  });

  it('compares each value with the consultation before it', () => {
    const rows = buildRecordRows(consultations);

    expect(cell(rows, 0, 'weightKg')?.change).toBeCloseTo(-3.2);
    expect(cell(rows, 2, 'weightKg')?.change).toBeNull();
  });

  it('has no change when either value is missing', () => {
    const rows = buildRecordRows(consultations);

    expect(cell(rows, 0, 'waistCm')).toMatchObject({ value: 85, change: null });
    expect(cell(rows, 1, 'waistCm')).toMatchObject({
      value: null,
      change: null,
    });
  });

  it('computes BMI with the latest known height', () => {
    const rows = buildRecordRows(consultations);

    expect(cell(rows, 0, 'bmi')?.value).toBe(25.5);
  });
});

describe('totalChanges', () => {
  it('goes from the first to the last recorded value of each column', () => {
    const totals = totalChanges(consultations);
    const of = (key: string) =>
      totals.find((t) => t.column.key === key)?.change;

    expect(of('weightKg')).toBeCloseTo(-5.5);
    expect(of('waistCm')).toBe(-7);
    expect(of('armCm')).toBeNull();
  });
});
