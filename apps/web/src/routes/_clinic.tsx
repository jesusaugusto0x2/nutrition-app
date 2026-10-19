import { createFileRoute, Link, Outlet } from '@tanstack/react-router';
import { t } from '@/i18n';

/** Layout for clinic staff (owner, nutritionist, assistant). */
export const Route = createFileRoute('/_clinic')({
  component: ClinicLayout,
});

function ClinicLayout() {
  return (
    <div className="min-h-dvh">
      <header className="bg-background/95 sticky top-0 z-10 border-b backdrop-blur">
        <div className="mx-auto flex h-14 max-w-3xl items-center justify-between px-4">
          <Link to="/patients" className="font-semibold">
            {t.app.name}
          </Link>
          <nav>
            <Link
              to="/patients"
              className="text-muted-foreground text-sm [&.active]:text-foreground"
            >
              {t.nav.patients}
            </Link>
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-4 py-6">
        <Outlet />
      </main>
    </div>
  );
}
