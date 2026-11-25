import { createFileRoute, Link } from '@tanstack/react-router';
import { ChevronLeft } from 'lucide-react';
import { PatientForm } from '@/features/patients/components/patient-form';
import { t } from '@/i18n';

export const Route = createFileRoute('/_clinic/patients/new')({
  component: NewPatientPage,
});

function NewPatientPage() {
  return (
    <div className="space-y-6">
      <Link
        to="/patients"
        className="text-muted-foreground inline-flex items-center gap-1 text-sm"
      >
        <ChevronLeft aria-hidden className="size-4" />
        {t.patients.backToList}
      </Link>
      <h1 className="m-0 font-heading text-display font-medium">
        {t.patients.form.createTitle}
      </h1>
      <div className="max-w-[560px]">
        <PatientForm />
      </div>
    </div>
  );
}
