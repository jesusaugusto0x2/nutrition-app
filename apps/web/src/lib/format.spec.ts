import {
  changeDirection,
  formatChange,
  formatDate,
  formatDecimal,
  formatMeasurement,
  formatQuantity,
  formatQuantityChange,
  formatQuantityWithUnit,
  formatShortDate,
  formatSignedQuantity,
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

describe('formatShortDate', () => {
  it('formats calendar dates as dd/mm', () => {
    expect(formatShortDate('2026-03-10')).toBe('10/03');
  });
});

describe('formatDecimal', () => {
  it('uses a decimal comma and fixed fraction digits', () => {
    expect(formatDecimal(74.9)).toBe('74,9');
    expect(formatDecimal(70)).toBe('70,0');
    expect(formatDecimal(1.755, 2)).toBe('1,76');
  });

  it('uses the typographic minus for negative values', () => {
    expect(formatDecimal(-2)).toBe('−2,0');
  });
});

describe('formatChange', () => {
  it('shows the sign of gains and losses', () => {
    expect(formatChange(1.2)).toBe('+1,2');
    expect(formatChange(-0.9)).toBe('−0,9');
    expect(formatChange(0)).toBe('0,0');
  });

  it('treats values that round to zero as no change', () => {
    expect(formatChange(-0.04)).toBe('0,0');
  });
});

describe('formatMeasurement', () => {
  it('appends the unit', () => {
    expect(formatMeasurement(81.5, 'cm')).toBe('81,5 cm');
    expect(formatMeasurement(1.62, 'm', 2)).toBe('1,62 m');
  });
});

describe('formatQuantity', () => {
  it('shows weight and BMI with one decimal', () => {
    expect(formatQuantity(66, 'weight')).toBe('66,0');
    expect(formatQuantity(25.46, 'bmi')).toBe('25,5');
  });

  it('shows height with two decimals', () => {
    expect(formatQuantity(1.6, 'height')).toBe('1,60');
  });

  it('drops decimals from whole lengths only', () => {
    expect(formatQuantity(85, 'length')).toBe('85');
    expect(formatQuantity(85.5, 'length')).toBe('85,5');
    expect(formatQuantity(85.000001, 'length')).toBe('85');
  });
});

describe('formatQuantityWithUnit', () => {
  it('appends the unit of each quantity', () => {
    expect(formatQuantityWithUnit(66.9, 'weight')).toBe('66,9 kg');
    expect(formatQuantityWithUnit(1.62, 'height')).toBe('1,62 m');
    expect(formatQuantityWithUnit(92, 'length')).toBe('92 cm');
    expect(formatQuantityWithUnit(27.6, 'bmi')).toBe('27,6 kg/m²');
  });
});

describe('formatQuantityChange', () => {
  it('formats losses with the typographic minus', () => {
    expect(formatQuantityChange(-2, 'weight')).toBe('−2,0 kg');
    expect(formatQuantityChange(-7, 'length')).toBe('−7 cm');
  });

  it('formats gains with a plus sign', () => {
    expect(formatQuantityChange(0.5, 'length')).toBe('+0,5 cm');
    expect(formatQuantityChange(0.8, 'weight')).toBe('+0,8 kg');
  });
});

describe('changeDirection', () => {
  it('reads losses and gains', () => {
    expect(changeDirection(-1.7, 'weight')).toBe('down');
    expect(changeDirection(0.8, 'length')).toBe('up');
  });

  it('treats changes that display as zero as no change', () => {
    expect(changeDirection(-0.04, 'weight')).toBe('none');
    expect(changeDirection(0.004, 'height')).toBe('none');
    expect(changeDirection(0.01, 'height')).toBe('up');
  });
});

describe('formatSignedQuantity', () => {
  it('formats the signed difference without unit', () => {
    expect(formatSignedQuantity(-2.3, 'weight')).toBe('\u22122,3');
    expect(formatSignedQuantity(1, 'length')).toBe('+1');
  });
});
