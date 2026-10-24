import type { Patient } from '@nutri/schemas';
import { calculateAge } from '@nutri/utils';
import { Link } from '@tanstack/react-router';
import { ChevronRightIcon } from 'lucide-react';
import { InitialsAvatar } from '@/components/ui/avatar';
import { buttonVariants } from '@/components/ui/button';
import { TrendBadge } from '@/components/ui/trend-badge';
import { t } from '@/i18n';
import {
  changeDirection,
  formatDate,
  formatQuantityWithUnit,
} from '@/lib/format';
import { cn } from '@/lib/utils';
import { patientFullName } from '../patient-name';

/** What a patient row shows besides the patient itself. */
export interface PatientSummary {
  patient: Pick<Patient, 'id' | 'firstName' | 'lastName' | 'birthDate'>;
  /** Latest consultation, `null` before the first one. */
  lastConsultation: { date: string; weightKg: number } | null;
  /** Weight change against the consultation before the latest one. */
  weightChange: number | null;
}

type RowVariant = 'list' | 'recent' | 'today' | 'search';

interface PatientRowProps {
  summary: PatientSummary;
  /**
   * `list`: patients list on phones. `recent`: recently viewed on home.
   * `today`: today's consultations (needs `time`). `search`: search results.
   */
  variant: RowVariant;
  /** Consultation time for `today`, e.g. «09:15». */
  time?: string;
  className?: string;
}

const containers: Record<RowVariant, string> = {
  list: 'min-h-[76px] rounded-card-sm border bg-surface px-4 py-3.5',
  recent: 'min-h-[76px] rounded-card-sm border bg-surface px-4 py-3.5',
  today: 'min-h-[72px] rounded-card-sm border bg-surface px-4 py-3.5',
  search: 'min-h-16 border-b border-divider px-4 py-2.5 last:border-0',
};

/** «34 años · Última consulta 02/06/2026». */
function ageAndLastVisit({ patient, lastConsultation }: PatientSummary) {
  const age = t.patients.age(calculateAge(patient.birthDate));
  return lastConsultation
    ? `${age} · ${t.patients.lastConsultation(formatDate(lastConsultation.date))}`
    : `${age} · ${t.patients.noConsultations}`;
}

/** «58,4 kg · subió 1,3 kg». */
function weightAndChange({ lastConsultation, weightChange }: PatientSummary) {
  if (!lastConsultation) {
    return t.patients.noConsultations;
  }
  const weight = formatQuantityWithUnit(lastConsultation.weightKg, 'weight');
  if (weightChange === null) {
    return weight;
  }
  const direction = changeDirection(weightChange, 'weight');
  const amount = formatQuantityWithUnit(Math.abs(weightChange), 'weight');
  const change =
    direction === 'none'
      ? t.trendInline.none
      : t.trendInline[direction](amount);
  return `${weight} · ${change}`;
}

/**
 * Spec 22: a patient in a list. The whole row links to their profile; the
 * desktop table variant is `PatientTable`.
 */
export function PatientRow({
  summary,
  variant,
  time,
  className,
}: PatientRowProps) {
  const { patient, lastConsultation, weightChange } = summary;
  const name = patientFullName(patient);
  const showAvatar = variant === 'list' || variant === 'recent';
  const showChevron = variant !== 'recent';

  return (
    <Link
      to="/patients/$patientId"
      params={{ patientId: patient.id }}
      className={cn(
        'flex items-center gap-3.5 text-foreground no-underline transition-colors hover:border-primary hover:text-foreground',
        containers[variant],
        className,
      )}
    >
      {variant === 'today' && time && (
        <span className="w-12 shrink-0 font-bold text-primary">{time}</span>
      )}
      {showAvatar && (
        <InitialsAvatar
          firstName={patient.firstName}
          lastName={patient.lastName}
        />
      )}
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="font-bold">{name}</span>
        <span className="text-meta text-muted-foreground">
          {variant === 'today'
            ? weightAndChange(summary)
            : ageAndLastVisit(summary)}
        </span>
      </span>
      {variant === 'list' && lastConsultation && (
        <span className="flex shrink-0 flex-col items-end gap-1">
          <span className="font-bold">
            {formatQuantityWithUnit(lastConsultation.weightKg, 'weight')}
          </span>
          {weightChange !== null && (
            <TrendBadge change={weightChange} quantity="weight" size="sm" />
          )}
        </span>
      )}
      {showChevron && (
        <ChevronRightIcon
          aria-hidden
          className="size-5 shrink-0 text-muted-foreground"
        />
      )}
    </Link>
  );
}

/** Spec 22 (`tabla`): the patients list on desktop. */
export function PatientTable({
  summaries,
  className,
}: {
  summaries: readonly PatientSummary[];
  className?: string;
}) {
  const { columns } = t.patients;

  return (
    <div
      className={cn(
        'overflow-x-auto rounded-card border bg-surface',
        className,
      )}
    >
      <table className="w-full min-w-[760px] border-collapse">
        <thead>
          <tr className="border-b bg-surface-muted text-left text-sm font-bold tracking-wide text-muted-foreground uppercase [&>th]:px-4 [&>th]:py-3 [&>th:first-child]:pl-6">
            <th scope="col">{columns.patient}</th>
            <th scope="col">{columns.age}</th>
            <th scope="col">{columns.lastConsultation}</th>
            <th scope="col">{columns.currentWeight}</th>
            <th scope="col">{columns.trend}</th>
            <td />
          </tr>
        </thead>
        <tbody>
          {summaries.map(({ patient, lastConsultation, weightChange }) => {
            const name = patientFullName(patient);
            return (
              <tr
                key={patient.id}
                className="h-[76px] border-b border-divider last:border-0 [&>*]:px-4 [&>:first-child]:pl-6 [&>:last-child]:pr-6"
              >
                <th scope="row" className="text-left font-bold">
                  <span className="flex items-center gap-3.5">
                    <InitialsAvatar
                      firstName={patient.firstName}
                      lastName={patient.lastName}
                      className="size-[42px]"
                    />
                    {name}
                  </span>
                </th>
                <td>{t.patients.age(calculateAge(patient.birthDate))}</td>
                <td>
                  {lastConsultation
                    ? formatDate(lastConsultation.date)
                    : t.common.notAvailable}
                </td>
                <td className="font-bold">
                  {lastConsultation
                    ? formatQuantityWithUnit(
                        lastConsultation.weightKg,
                        'weight',
                      )
                    : t.common.notAvailable}
                </td>
                <td>
                  {weightChange === null ? (
                    t.common.notAvailable
                  ) : (
                    <TrendBadge
                      change={weightChange}
                      quantity="weight"
                      size="sm"
                    />
                  )}
                </td>
                <td className="text-right">
                  <Link
                    to="/patients/$patientId"
                    params={{ patientId: patient.id }}
                    aria-label={t.patients.viewProfileOf(name)}
                    className={buttonVariants({ variant: 'text' })}
                  >
                    {t.patients.viewProfile}
                  </Link>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
