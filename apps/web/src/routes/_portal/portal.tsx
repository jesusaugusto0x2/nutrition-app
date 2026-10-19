import { createFileRoute } from '@tanstack/react-router';
import { t } from '@/i18n';

// TODO(portal): Read-only progress for patients and guardians, backed by
// /api/portal endpoints (see apps/api/src/modules/portal).
export const Route = createFileRoute('/_portal/portal')({
  component: () => (
    <section className="space-y-2">
      <h1 className="text-xl font-semibold">{t.portal.title}</h1>
      <p className="text-muted-foreground text-sm">{t.portal.comingSoon}</p>
    </section>
  ),
});
