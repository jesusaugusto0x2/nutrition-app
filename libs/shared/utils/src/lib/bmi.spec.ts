import { calculateBmi, classifyBmi } from './bmi.js';

describe('calculateBmi', () => {
  it('divides weight by height squared, rounded to one decimal', () => {
    expect(calculateBmi(70, 1.75)).toBe(22.9);
    expect(calculateBmi(78.4, 1.62)).toBe(29.9);
  });

  it('handles boundary values used for classification', () => {
    // 18.5 and 25 are WHO cut-offs; exact inputs must not drift.
    expect(calculateBmi(18.5, 1)).toBe(18.5);
    expect(calculateBmi(25, 1)).toBe(25);
  });

  it.each([
    [0, 1.7],
    [-70, 1.7],
    [70, 0],
    [70, -1.7],
    [Number.NaN, 1.7],
    [70, Number.POSITIVE_INFINITY],
  ])('rejects invalid input (%s kg, %s m)', (weightKg, heightM) => {
    expect(() => calculateBmi(weightKg, heightM)).toThrow(RangeError);
  });
});

describe('classifyBmi', () => {
  it.each([
    [18.4, 'underweight'],
    [18.5, 'normal'],
    [24.9, 'normal'],
    [25, 'overweight'],
    [29.9, 'overweight'],
    [30, 'obesity1'],
    [35, 'obesity2'],
    [40, 'obesity3'],
  ] as const)('classifies %s as %s', (bmi, category) => {
    expect(classifyBmi(bmi)).toBe(category);
  });

  it('rejects invalid values', () => {
    expect(() => classifyBmi(0)).toThrow(RangeError);
  });
});
