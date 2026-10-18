import { roundTo } from './rounding.js';

describe('roundTo', () => {
  it('removes floating point noise', () => {
    expect(roundTo(74.9 - 75.8, 2)).toBe(-0.9);
  });

  it('rounds half away from zero symmetrically', () => {
    expect(roundTo(0.25, 1)).toBe(0.3);
    expect(roundTo(-0.25, 1)).toBe(-0.3);
  });

  it('never returns negative zero', () => {
    expect(Object.is(roundTo(-0.001, 1), 0)).toBe(true);
  });
});
