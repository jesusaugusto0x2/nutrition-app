import { createFileRoute, Outlet } from '@tanstack/react-router';
import { t } from '@/i18n';

/** Read-only layout for patients and guardians. Placeholder for now. */
export const Route = createFileRoute('/_portal')({
  component: () => (
    <div className="min-h-dvh">
      <header className="border-b">
        <div className="mx-auto flex h-14 max-w-3xl items-center px-4 font-semibold">
          {t.app.name}
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-4 py-6">
        <Outlet />
      </main>
    </div>
  ),
});
