import type { ReactNode } from 'react';
import { TrendBadge } from '@/components/ui/trend-badge';
import { t } from '@/i18n';
import {
  formatQuantity,
  formatQuantityWithUnit,
  formatShortDate,
  type Quantity,
} from '@/lib/format';
import { cn } from '@/lib/utils';

export interface ChartPoint {
  /** Calendar date `YYYY-MM-DD`. */
  date: string;
  value: number;
}

/** Point position in percent of the drawing area (y grows downwards). */
export interface PlacedPoint extends ChartPoint {
  x: number;
  y: number;
}

/**
 * Places chronological points from the series minimum to maximum, with a
 * 25 % margin (at least 1 unit) so the line never touches the edges.
 */
export function placePoints(points: readonly ChartPoint[]): PlacedPoint[] {
  const values = points.map((point) => point.value);
  const pad = Math.max((Math.max(...values) - Math.min(...values)) * 0.25, 1);
  const low = Math.min(...values) - pad;
  const high = Math.max(...values) + pad;
  const last = points.length - 1;

  return points.map((point, index) => ({
    ...point,
    x: last > 0 ? (index / last) * 100 : 50,
    y: (1 - (point.value - low) / (high - low)) * 100,
  }));
}

const heights = {
  lg: 'h-60',
  md: 'h-[170px]',
  summary: 'h-[190px]',
};

interface EvolutionChartProps {
  /** Oldest first. */
  points: readonly ChartPoint[];
  quantity: Quantity;
  /** `lg`: weight in measurements; `md`: grid cells; `summary`: profile. */
  size?: keyof typeof heights;
  /** Section title, e.g. «Evolución del peso». */
  title: string;
  /** Link beside the title in the summary variant. */
  action?: ReactNode;
  className?: string;
}

/**
 * Spec 27. Values are written over each point instead of a vertical axis.
 * The drawing is hidden from assistive technology: the same values are in
 * the records table.
 */
export function EvolutionChart({
  points,
  quantity,
  size = 'md',
  title,
  action,
  className,
}: EvolutionChartProps) {
  const first = points[0];
  const last = points[points.length - 1];
  const showChange = size !== 'summary' && first && last && points.length > 1;
  const Heading = size === 'md' ? 'h3' : 'h2';

  return (
    <section
      className={cn(
        'flex flex-col gap-1.5 rounded-card border bg-surface p-5 md:p-6',
        className,
      )}
    >
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <Heading
          className={cn(
            'm-0 font-bold',
            size === 'md' ? 'text-[19px]' : 'text-section',
          )}
        >
          {title}
        </Heading>
        {action}
        {showChange && (
          <div className="flex flex-wrap items-baseline gap-x-3.5 gap-y-1">
            <span className="text-muted-foreground">
              {t.chart.range(
                formatQuantity(first.value, quantity),
                formatQuantityWithUnit(last.value, quantity),
              )}
            </span>
            <TrendBadge
              change={last.value - first.value}
              quantity={quantity}
              size={size === 'md' ? 'sm' : 'md'}
            />
          </div>
        )}
      </div>
      {points.length > 1 ? (
        <Drawing points={points} quantity={quantity} size={size} />
      ) : (
        <SinglePoint point={first} quantity={quantity} />
      )}
    </section>
  );
}

function Drawing({
  points,
  quantity,
  size,
}: {
  points: readonly ChartPoint[];
  quantity: Quantity;
  size: keyof typeof heights;
}) {
  const placed = placePoints(points);
  const large = size === 'lg';

  return (
    <div aria-hidden className="px-6 pt-9 pb-1 md:px-9">
      <div className={cn('relative', heights[size])}>
        <svg
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          className="absolute inset-0 size-full overflow-visible"
        >
          <line
            x1="0"
            y1="50"
            x2="100"
            y2="50"
            className="stroke-neutral-soft"
            vectorEffect="non-scaling-stroke"
          />
          <line
            x1="0"
            y1="100"
            x2="100"
            y2="100"
            className="stroke-border"
            vectorEffect="non-scaling-stroke"
          />
          <polyline
            points={placed
              .map((point) => `${point.x.toFixed(2)},${point.y.toFixed(2)}`)
              .join(' ')}
            fill="none"
            className="stroke-primary"
            strokeWidth={large ? 3.5 : 3}
            strokeLinejoin="round"
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
          />
        </svg>
        {placed.map((point) => (
          <div
            key={point.date}
            className="absolute size-0"
            style={{ left: `${point.x}%`, top: `${point.y}%` }}
          >
            <span
              className={cn(
                'absolute rounded-full border-primary bg-surface',
                large
                  ? '-top-2 -left-2 size-4 border-[3.5px]'
                  : '-top-1.75 -left-1.75 size-3.5 border-3',
              )}
            />
            <span
              className={cn(
                'absolute left-0 -translate-x-1/2 font-bold whitespace-nowrap',
                large ? 'bottom-3.5 text-body' : 'bottom-3 text-meta',
              )}
            >
              {formatQuantity(point.value, quantity)}
            </span>
          </div>
        ))}
      </div>
      <div className="relative mt-3 h-6">
        {placed.map((point) => (
          <span
            key={point.date}
            className="absolute top-0 -translate-x-1/2 text-sm whitespace-nowrap text-muted-foreground"
            style={{ left: `${point.x}%` }}
          >
            {formatShortDate(point.date)}
          </span>
        ))}
      </div>
    </div>
  );
}

function SinglePoint({
  point,
  quantity,
}: {
  point: ChartPoint | undefined;
  quantity: Quantity;
}) {
  return (
    <div className="flex flex-col items-center gap-2 py-8 text-center">
      {point && (
        <>
          <span aria-hidden className="text-meta font-bold">
            {formatQuantity(point.value, quantity)}
          </span>
          <span
            aria-hidden
            className="size-3.5 rounded-full border-3 border-primary bg-surface"
          />
        </>
      )}
      <p className="text-meta text-muted-foreground">{t.chart.singlePoint}</p>
    </div>
  );
}
