import { calculateAge } from '@nutri/utils';
import { useSuspenseQuery } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { ChevronRight, PlusIcon } from 'lucide-react';
import { buttonVariants } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { t } from '@/i18n';
import { patientsQueryOptions } from '../api';
import { patientFullName } from '../patient-name';

export function PatientList() {
  const { data: patients } = useSuspenseQuery(patientsQueryOptions());

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="m-0 text-2xl font-semibold">{t.patients.listTitle}</h1>
        <Link to="/patients/new" className={buttonVariants({ size: 'sm' })}>
          <PlusIcon aria-hidden />
          {t.patients.newPatient}
        </Link>
      </div>
      {patients.length === 0 ? (
        <p className="text-muted-foreground text-sm">{t.patients.empty}</p>
      ) : (
        <ul className="space-y-2">
          {patients.map((patient) => (
            <li key={patient.id}>
              <Link
                to="/patients/$patientId"
                params={{ patientId: patient.id }}
                className="block"
              >
                <Card className="hover:bg-muted/50 flex-row items-center justify-between px-4 py-3 transition-colors">
                  <div>
                    <p className="font-medium">{patientFullName(patient)}</p>
                    <p className="text-muted-foreground text-sm">
                      {t.patients.age(calculateAge(patient.birthDate))} ·{' '}
                      {t.patients.sex[patient.sex]}
                    </p>
                  </div>
                  <ChevronRight
                    aria-hidden
                    className="text-muted-foreground size-4"
                  />
                </Card>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
