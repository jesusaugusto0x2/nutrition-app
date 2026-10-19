import { calculateAge } from '@nutri/utils';
import { useSuspenseQuery } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { ChevronLeft } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ConsultationList } from '@/features/consultations/components/consultation-list';
import { t } from '@/i18n';
import { formatDate } from '@/lib/format';
import { patientQueryOptions } from '../api';
import { patientFullName } from '../patient-name';

export function PatientProfile({ patientId }: { patientId: string }) {
  const { data: patient } = useSuspenseQuery(patientQueryOptions(patientId));

  const details = [
    [t.patients.birthDate, formatDate(patient.birthDate)],
    [t.patients.phone, patient.phone ?? t.common.notAvailable],
    [t.patients.address, patient.address ?? t.common.notAvailable],
  ] as const;

  return (
    <div className="space-y-6">
      <Link
        to="/patients"
        className="text-muted-foreground inline-flex items-center gap-1 text-sm"
      >
        <ChevronLeft aria-hidden className="size-4" />
        {t.patients.backToList}
      </Link>

      <Card>
        <CardHeader>
          <CardTitle className="text-xl">{patientFullName(patient)}</CardTitle>
          <p className="text-muted-foreground text-sm">
            {t.patients.age(calculateAge(patient.birthDate))} ·{' '}
            {t.patients.sex[patient.sex]}
          </p>
        </CardHeader>
        <CardContent>
          <dl className="grid gap-3 text-sm sm:grid-cols-3">
            {details.map(([label, value]) => (
              <div key={label}>
                <dt className="text-muted-foreground">{label}</dt>
                <dd>{value}</dd>
              </div>
            ))}
          </dl>
        </CardContent>
      </Card>

      <ConsultationList patientId={patientId} />
    </div>
  );
}
