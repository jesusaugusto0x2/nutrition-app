import { useNavigate } from '@tanstack/react-router';
import { SectionTabs } from '@/components/ui/section-tabs';
import { t } from '@/i18n';

export type ProfileTab = 'summary' | 'history' | 'measurements' | 'notes';

const tabRoutes = {
  summary: '/patients/$patientId',
  history: '/patients/$patientId/historia',
  measurements: '/patients/$patientId/control-medidas',
  notes: '/patients/$patientId/notas',
} as const;

const tabItems: readonly { value: ProfileTab; label: string }[] = [
  { value: 'summary', label: t.profileTabs.summary },
  { value: 'history', label: t.profileTabs.history },
  { value: 'measurements', label: t.profileTabs.measurements },
  { value: 'notes', label: t.profileTabs.notes },
];

/**
 * Spec 5 tab bar of the patient profile. The active tab always derives
 * from the route that renders it (deep-linking works), and picking a tab
 * navigates — the tabs are routes, not local state.
 */
export function PatientTabs({
  patientId,
  active,
}: {
  patientId: string;
  active: ProfileTab;
}) {
  const navigate = useNavigate();
  return (
    <SectionTabs
      label={t.profileTabs.label}
      items={tabItems}
      value={active}
      onChange={(tab) => {
        void navigate({ to: tabRoutes[tab], params: { patientId } });
      }}
    />
  );
}
