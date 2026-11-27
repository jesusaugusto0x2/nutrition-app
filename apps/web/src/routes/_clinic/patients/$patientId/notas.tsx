import { createFileRoute } from '@tanstack/react-router';
import { NotebookPenIcon } from 'lucide-react';
import { ComingSoonCard } from '@/components/ui/empty-state';
import { PatientShell } from '@/features/patients/components/patient-shell';
import { t } from '@/i18n';

export const Route = createFileRoute('/_clinic/patients/$patientId/notas')({
  component: NotesPage,
});

/**
 * Notas lands with its content in #84; until then the tab shows a designed
 * placeholder instead of a broken or blank screen.
 */
function NotesPage() {
  const { patientId } = Route.useParams();
  return (
    <PatientShell patientId={patientId} active="notes">
      <ComingSoonCard
        icon={NotebookPenIcon}
        title={t.profileTabs.notes}
        description={t.profileTabs.comingSoon.notes}
      />
    </PatientShell>
  );
}
