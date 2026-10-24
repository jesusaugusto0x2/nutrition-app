import type { Patient } from '@nutri/schemas';
import { calculateAge, isMinor } from '@nutri/utils';
import { PhoneIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { InitialsAvatar } from '@/components/ui/avatar';
import { t } from '@/i18n';
import { formatQuantity } from '@/lib/format';
import { cn } from '@/lib/utils';
import { BmiBadge } from '@/features/consultations/components/bmi-badge';
import { patientFullName } from '../patient-name';

interface PatientHeaderProps {
  patient: Pick<
    Patient,
    'firstName' | 'lastName' | 'birthDate' | 'sex' | 'phone'
  >;
  /** BMI of the latest consultation, `null` without height or visits. */
  currentBmi?: number | null;
  /** Main action, usually a «Nueva consulta» link styled as a button. */
  action?: ReactNode;
  /** Name and data only, without BMI or action (control de medidas). */
  compact?: boolean;
  className?: string;
}

/**
 * Spec 21: identifies the patient on every profile screen. Stacked on
 * phones, one wrapping row from `md`. Minors get the percentile note
 * instead of an adult BMI category.
 */
export function PatientHeader({
  patient,
  currentBmi = null,
  action,
  compact = false,
  className,
}: PatientHeaderProps) {
  const minor = isMinor(patient.birthDate);

  return (
    <header
      className={cn(
        'flex flex-col gap-4 rounded-card border bg-surface p-5 md:flex-row md:flex-wrap md:items-center md:gap-7 md:px-8 md:py-7',
        className,
      )}
    >
      <div className="flex min-w-0 items-center gap-5 md:flex-[1_1_320px]">
        <InitialsAvatar
          firstName={patient.firstName}
          lastName={patient.lastName}
          size="lg"
          className="hidden md:flex"
        />
        <div className="flex min-w-0 flex-col gap-1">
          <h1 className="m-0 font-heading text-[32px] leading-tight font-medium md:text-[40px]">
            {patientFullName(patient)}
          </h1>
          <div className="flex flex-wrap items-center gap-x-4.5 gap-y-1.5 text-muted-foreground">
            <span>{t.patients.age(calculateAge(patient.birthDate))}</span>
            <span>{t.patients.sex[patient.sex]}</span>
            {patient.phone && (
              <a
                href={`tel:${patient.phone.replace(/[^\d+]/g, '')}`}
                className="flex min-h-touch items-center gap-1.5 font-bold no-underline"
              >
                <PhoneIcon aria-hidden className="size-4.5" />
                {patient.phone}
              </a>
            )}
          </div>
        </div>
      </div>
      {!compact && currentBmi !== null && (
        <div className="flex flex-col gap-2 rounded-card-sm bg-background px-5 py-3.5">
          <div className="flex items-center gap-4">
            <div className="flex flex-col">
              <span className="text-meta text-muted-foreground">
                {t.patients.currentBmi}
              </span>
              <span className="text-[30px] leading-tight font-bold">
                {formatQuantity(currentBmi, 'bmi')}
              </span>
            </div>
            <BmiBadge bmi={currentBmi} minor={minor} size="lg" />
          </div>
          {minor && (
            <p className="m-0 max-w-[320px] text-meta text-info">
              {t.bmi.percentileNote}
            </p>
          )}
        </div>
      )}
      {!compact && action}
    </header>
  );
}
