import type { Consultation } from '@nutri/schemas';
import { formatDate, formatQuantityWithUnit } from '@/lib/format';
import { cn } from '@/lib/utils';

/**
 * Spec 30: the note of one consultation with its date and weight. Date and
 * weight sit on a row above the text on phones and in a 150 px column
 * beside it from `md`.
 */
export function ConsultationNote({
  consultation,
  className,
}: {
  consultation: Pick<Consultation, 'date' | 'weightKg' | 'notes'>;
  className?: string;
}) {
  return (
    <article
      className={cn(
        'flex flex-col gap-1.5 border-b border-divider py-4 last:border-0 md:flex-row md:gap-6',
        className,
      )}
    >
      <div className="flex items-baseline gap-3 md:w-[150px] md:shrink-0 md:flex-col md:gap-0.5">
        <h3 className="m-0 text-body font-bold">
          {formatDate(consultation.date)}
        </h3>
        <span className="text-meta text-muted-foreground">
          {formatQuantityWithUnit(consultation.weightKg, 'weight')}
        </span>
      </div>
      <p className="m-0 whitespace-pre-line">{consultation.notes}</p>
    </article>
  );
}
