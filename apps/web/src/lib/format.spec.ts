import {
  formatChange,
  formatDate,
  formatDecimal,
  formatMeasurement,
} from './format';

describe('formatDate', () => {
  it('formats calendar dates as dd/mm/aaaa without time zone shifts', () => {
    expect(formatDate('2026-01-05')).toBe('05/01/2026');
    expect(formatDate('2026-12-31')).toBe('31/12/2026');
  });

  it('formats ISO date-times in local time', () => {
    const local = new Date(2026, 2, 9, 15, 30);
    expect(formatDate(local.toISOString())).toBe('09/03/2026');
  });

  it('rejects invalid input', () => {
    expect(() => formatDate('not a date')).toThrow(RangeError);
  });
});

describe('formatDecimal', () => {
  it('uses a decimal comma and fixed fraction digits', () => {
    expect(formatDecimal(74.9)).toBe('74,9');
    expect(formatDecimal(70)).toBe('70,0');
    expect(formatDecimal(1.755, 2)).toBe('1,76');
  });
});

describe('formatChange', () => {
  it('shows the sign of gains and losses', () => {
    expect(formatChange(1.2)).toBe('+1,2');
    expect(formatChange(-0.9)).toBe('-0,9');
    expect(formatChange(0)).toBe('0,0');
  });
});

describe('formatMeasurement', () => {
  it('appends the unit', () => {
    expect(formatMeasurement(81.5, 'cm')).toBe('81,5 cm');
    expect(formatMeasurement(1.62, 'm', 2)).toBe('1,62 m');
  });
});
