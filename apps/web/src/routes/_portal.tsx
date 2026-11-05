import { createFileRoute, Outlet } from '@tanstack/react-router';
import { HeaderAccount } from '@/features/auth/components/signed-in-account';
import { requirePortalAccess } from '@/features/auth/guards';
import { t } from '@/i18n';

/**
 * Read-only layout for patients and guardians. Placeholder for now: the
 * portal sidebar and bottom bar (Inicio, Progreso, Mi cuenta) come with the
 * portal screens; until then the account menu sits in the header.
 */
export const Route = createFileRoute('/_portal')({
  beforeLoad: ({ context, location }) =>
    requirePortalAccess(context.queryClient, location.href),
  component: () => (
    <div className="min-h-dvh">
      <header className="border-b">
        <div className="mx-auto flex h-14 max-w-3xl items-center justify-between gap-4 px-4">
          <span className="font-semibold">{t.app.name}</span>
          <HeaderAccount />
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-4 py-6">
        <Outlet />
      </main>
    </div>
  ),
});
