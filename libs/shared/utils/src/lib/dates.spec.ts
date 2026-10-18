import { daysBetween, parseIsoDate } from './dates.js';

describe('parseIsoDate', () => {
  it('parses a calendar date', () => {
    expect(parseIsoDate('2024-02-29')).toEqual({
      year: 2024,
      month: 2,
      day: 29,
    });
  });

  it('rejects dates that do not exist', () => {
    expect(() => parseIsoDate('2023-02-29')).toThrow(RangeError);
  });
});

describe('daysBetween', () => {
  it('counts calendar days, unaffected by daylight saving time', () => {
    expect(daysBetween('2026-03-01', '2026-04-01')).toBe(31);
    expect(daysBetween('2026-10-15', '2026-07-17')).toBe(-90);
  });

  it('crosses leap days', () => {
    expect(daysBetween('2024-02-28', '2024-03-01')).toBe(2);
  });
});
