import { render, screen } from '@testing-library/react';
import { t } from '@/i18n';
import { EvolutionChart, placePoints } from './evolution-chart';

const waist = [
  { date: '2026-03-10', value: 92 },
  { date: '2026-04-07', value: 89 },
  { date: '2026-06-02', value: 85 },
];

describe('placePoints', () => {
  it('spreads points evenly from left to right', () => {
    expect(placePoints(waist).map((point) => point.x)).toEqual([0, 50, 100]);
  });

  it('keeps a 25 % margin so the line does not touch the edges', () => {
    const [highest, , lowest] = placePoints(waist);
    // Range 7 cm, margin 1.75 cm on each side: 10.5 cm drawn.
    expect(highest.y).toBeCloseTo((1.75 / 10.5) * 100);
    expect(lowest.y).toBeCloseTo((8.75 / 10.5) * 100);
  });

  it('uses at least one unit of margin for flat series', () => {
    const placed = placePoints([
      { date: '2026-03-10', value: 70 },
      { date: '2026-04-07', value: 70 },
    ]);
    expect(placed.map((point) => point.y)).toEqual([50, 50]);
  });

  it('centers a single point', () => {
    expect(placePoints([waist[0]])[0]).toMatchObject({ x: 50, y: 50 });
  });
});

describe('EvolutionChart', () => {
  it('summarises the range and total change in words', () => {
    render(
      <EvolutionChart
        title="Cintura (cm)"
        points={waist}
        quantity="length"
        size="md"
      />,
    );

    expect(screen.getByText('De 92 a 85 cm')).toBeInTheDocument();
    expect(screen.getByText(t.trend.down('7 cm'))).toBeInTheDocument();
  });

  it('asks for one more consultation when there is a single point', () => {
    render(
      <EvolutionChart title="Peso" points={[waist[0]]} quantity="weight" />,
    );

    expect(screen.getByText(t.chart.singlePoint)).toBeInTheDocument();
  });
});
