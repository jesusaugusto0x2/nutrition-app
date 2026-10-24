import { t } from '@/i18n';
import { formatQuantity, formatQuantityWithUnit } from '@/lib/format';
import { cn } from '@/lib/utils';
import { BmiBadge } from './bmi-badge';

/**
 * Spec 16 (`resultado IMC`): BMI computed live from weight and height.
 * Without data it invites the user to type them; for minors it explains
 * that BMI is read by percentile.
 */
export function BmiResult({
  bmi,
  heightM,
  minor,
  htmlFor,
  className,
}: {
  bmi: number | null;
  /** Height used, shown as «con talla 1,62 m» when it was not typed here. */
  heightM?: number | null;
  minor: boolean;
  /** Ids of the weight and height fields the value comes from. */
  htmlFor?: string;
  className?: string;
}) {
  if (bmi === null) {
    return (
      <output
        htmlFor={htmlFor}
        className={cn(
          'flex min-h-24 items-center justify-center rounded-card-sm border border-dashed border-input px-5 text-center text-muted-foreground',
          className,
        )}
      >
        {t.bmi.prompt}
      </output>
    );
  }

  return (
    <output
      htmlFor={htmlFor}
      className={cn(
        'flex flex-col gap-2 rounded-card-sm bg-background px-5 py-4',
        className,
      )}
    >
      <span className="text-meta text-muted-foreground">{t.bmi.label}</span>
      <span className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
        <span className="text-value font-bold">
          {formatQuantity(bmi, 'bmi')}{' '}
          <span className="text-body font-normal text-muted-foreground">
            {t.units.bmi}
          </span>
        </span>
        <BmiBadge bmi={bmi} minor={minor} />
      </span>
      {heightM && (
        <span className="text-meta text-muted-foreground">
          {t.bmi.withHeight(formatQuantityWithUnit(heightM, 'height'))}
        </span>
      )}
      {minor && (
        <span className="text-meta text-info">{t.bmi.percentileNote}</span>
      )}
    </output>
  );
}
