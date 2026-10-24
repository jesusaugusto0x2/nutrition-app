import {
  matchesSearch,
  normalizeForSearch,
  parseDateInput,
  parseDecimalInput,
  parseHeightInput,
} from './parse';

describe('parseDecimalInput', () => {
  it('accepts a decimal comma or dot', () => {
    expect(parseDecimalInput('66,9')).toBe(66.9);
    expect(parseDecimalInput('66.9')).toBe(66.9);
    expect(parseDecimalInput(' 85 ')).toBe(85);
  });

  it('accepts a value still being typed', () => {
    expect(parseDecimalInput('66,')).toBe(66);
    expect(parseDecimalInput(',5')).toBe(0.5);
  });

  it('returns null for empty or unreadable input', () => {
    expect(parseDecimalInput('')).toBeNull();
    expect(parseDecimalInput('abc')).toBeNull();
    expect(parseDecimalInput('1,2,3')).toBeNull();
    expect(parseDecimalInput('-3')).toBeNull();
  });
});

describe('parseHeightInput', () => {
  it('reads meters as typed', () => {
    expect(parseHeightInput('1,62')).toBe(1.62);
  });

  it('reads values of 3 or more as centimeters', () => {
    expect(parseHeightInput('162')).toBe(1.62);
  });

  it('returns null for unreadable input', () => {
    expect(parseHeightInput('alto')).toBeNull();
  });
});

describe('parseDateInput', () => {
  it('converts dd/mm/aaaa to a calendar date', () => {
    expect(parseDateInput('04/10/2026')).toBe('2026-10-04');
    expect(parseDateInput('4/1/2026')).toBe('2026-01-04');
  });

  it('rejects dates that do not exist', () => {
    expect(parseDateInput('31/02/2026')).toBeNull();
    expect(parseDateInput('00/10/2026')).toBeNull();
  });

  it('rejects other formats', () => {
    expect(parseDateInput('2026-10-04')).toBeNull();
    expect(parseDateInput('')).toBeNull();
  });
});

describe('matchesSearch', () => {
  it('ignores case and accents', () => {
    expect(matchesSearch('Sofía Herrera', 'sofia')).toBe(true);
    expect(matchesSearch('José Gregorio Blanco', 'JOSE gre')).toBe(true);
    expect(matchesSearch('Laura Méndez', 'pérez')).toBe(false);
  });

  it('normalizes text for comparison', () => {
    expect(normalizeForSearch('  Ana Lucía ')).toBe('ana lucia');
  });
});
