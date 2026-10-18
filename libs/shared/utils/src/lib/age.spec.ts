import { calculateAge } from './age.js';

describe('calculateAge', () => {
  it('counts completed years', () => {
    expect(calculateAge('1990-05-10', '2026-10-18')).toBe(36);
  });

  it('turns a year older exactly on the birthday', () => {
    expect(calculateAge('2012-06-21', '2026-06-20')).toBe(13);
    expect(calculateAge('2012-06-21', '2026-06-21')).toBe(14);
  });

  it('returns 0 on the day of birth and before the first birthday', () => {
    expect(calculateAge('2026-01-15', '2026-01-15')).toBe(0);
    expect(calculateAge('2026-01-15', '2026-12-31')).toBe(0);
  });

  it('handles 29 February birthdays in non-leap years', () => {
    expect(calculateAge('2008-02-29', '2025-02-28')).toBe(16);
    expect(calculateAge('2008-02-29', '2025-03-01')).toBe(17);
    expect(calculateAge('2008-02-29', '2028-02-29')).toBe(20);
  });

  it('defaults the reference date to today', () => {
    expect(calculateAge('2000-01-01')).toBeGreaterThanOrEqual(26);
  });

  it('rejects a reference date before birth', () => {
    expect(() => calculateAge('2020-01-01', '2019-12-31')).toThrow(RangeError);
  });

  it.each(['1990-02-30', '1990-13-01', '10/05/1990', ''])(
    'rejects invalid date %j',
    (birthDate) => {
      expect(() => calculateAge(birthDate, '2026-01-01')).toThrow(RangeError);
    },
  );
});
