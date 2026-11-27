import { createFileRoute } from '@tanstack/react-router';
import { RulerIcon } from 'lucide-react';
import { ComingSoonCard } from '@/components/ui/empty-state';
import { PatientShell } from '@/features/patients/components/patient-shell';
import { t } from '@/i18n';

export const Route = createFileRoute(
  '/_clinic/patients/$patientId/control-medidas',
)({
  component: MeasurementsPage,
});

/**
 * Control de medidas lands with its content in #83; until then the tab
 * shows a designed placeholder instead of a broken or blank screen.
 */
function MeasurementsPage() {
  const { patientId } = Route.useParams();
  return (
    <PatientShell patientId={patientId} active="measurements">
      <ComingSoonCard
        icon={RulerIcon}
        title={t.profileTabs.measurements}
        description={t.profileTabs.comingSoon.measurements}
      />
    </PatientShell>
  );
}
