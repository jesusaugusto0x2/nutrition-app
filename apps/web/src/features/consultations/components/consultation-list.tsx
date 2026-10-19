import type { Consultation } from '@nutri/schemas';
import { calculateBmi, diffConsultations } from '@nutri/utils';
import { useSuspenseQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { t } from '@/i18n';
import {
  formatChange,
  formatDate,
  formatDecimal,
  formatMeasurement,
} from '@/lib/format';
import { consultationsQueryOptions } from '../api';

export function ConsultationList({ patientId }: { patientId: string }) {
  const { data: consultations } = useSuspenseQuery(
    consultationsQueryOptions(patientId),
  );

  return (
    <section className="space-y-3">
      <h2 className="text-lg font-semibold">{t.consultations.listTitle}</h2>
      {consultations.length === 0 ? (
        <p className="text-muted-foreground text-sm">{t.consultations.empty}</p>
      ) : (
        <ul className="space-y-3">
          {consultations.map((consultation, index) => (
            <li key={consultation.id}>
              <ConsultationCard
                consultation={consultation}
                // Sorted most recent first, so the previous one is next.
                previous={consultations[index + 1]}
              />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function ConsultationCard({
  consultation,
  previous,
}: {
  consultation: Consultation;
  previous?: Consultation;
}) {
  const diff = previous ? diffConsultations(previous, consultation) : null;
  const { kilograms, meters, centimeters } = t.units;

  const measurements = [
    [t.consultations.height, consultation.heightM, meters, 2],
    [t.consultations.waist, consultation.waistCm, centimeters, 1],
    [t.consultations.hip, consultation.hipCm, centimeters, 1],
    [t.consultations.arm, consultation.armCm, centimeters, 1],
    [t.consultations.leg, consultation.legCm, centimeters, 1],
  ] as const;

  return (
    <Card>
      <CardHeader>
        <CardTitle>{formatDate(consultation.date)}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <div className="flex flex-wrap items-baseline gap-x-6 gap-y-1">
          <p>
            <span className="text-muted-foreground">
              {t.consultations.weight}:{' '}
            </span>
            <span className="text-base font-semibold">
              {formatMeasurement(consultation.weightKg, kilograms)}
            </span>
            {diff && (
              <span className="text-muted-foreground">
                {' '}
                ({formatChange(diff.weightKg)} {kilograms}{' '}
                {t.consultations.sincePrevious(diff.days)})
              </span>
            )}
          </p>
          {consultation.heightM !== null && (
            <p>
              <span className="text-muted-foreground">
                {t.consultations.bmi}:{' '}
              </span>
              <span className="font-semibold">
                {formatDecimal(
                  calculateBmi(consultation.weightKg, consultation.heightM),
                )}
              </span>
            </p>
          )}
        </div>
        <dl className="grid grid-cols-2 gap-2 sm:grid-cols-5">
          {measurements.map(([label, value, unit, digits]) => (
            <div key={label}>
              <dt className="text-muted-foreground">{label}</dt>
              <dd>
                {value === null
                  ? t.common.notAvailable
                  : formatMeasurement(value, unit, digits)}
              </dd>
            </div>
          ))}
        </dl>
        {consultation.notes && (
          <p>
            <span className="text-muted-foreground">
              {t.consultations.notes}:{' '}
            </span>
            {consultation.notes}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
