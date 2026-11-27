import { createFileRoute } from '@tanstack/react-router';
import { HistoryIcon } from 'lucide-react';
import { ComingSoonCard } from '@/components/ui/empty-state';
import { PatientShell } from '@/features/patients/components/patient-shell';
import { t } from '@/i18n';

export const Route = createFileRoute('/_clinic/patients/$patientId/historia')({
  component: HistoryPage,
});

/**
 * Historia nutricional lands with its content in #87; until then the tab
 * shows a designed placeholder instead of a broken or blank screen.
 */
function HistoryPage() {
  const { patientId } = Route.useParams();
  return (
    <PatientShell patientId={patientId} active="history">
      <ComingSoonCard
        icon={HistoryIcon}
        title={t.profileTabs.history}
        description={t.profileTabs.comingSoon.history}
      />
    </PatientShell>
  );
}
