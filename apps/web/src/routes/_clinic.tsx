import { createFileRoute, Outlet } from '@tanstack/react-router';
import { BottomNav } from '@/components/navigation/bottom-nav';
import { Sidebar } from '@/components/navigation/sidebar';

/**
 * Layout for clinic staff (owner, nutritionist, assistant). Sidebar from
 * `md`, wrapping above the content when both do not fit (~800 px); bottom
 * bar on phones.
 */
export const Route = createFileRoute('/_clinic')({
  component: ClinicLayout,
});

function ClinicLayout() {
  return (
    <div className="flex min-h-dvh flex-wrap">
      <Sidebar className="hidden md:flex md:flex-[1_1_var(--spacing-sidebar)]" />
      <div className="flex min-w-0 flex-[999_1_560px] flex-col">
        <main className="flex-1 px-5 py-6 md:px-12 md:py-7">
          <div className="mx-auto max-w-content">
            <Outlet />
          </div>
        </main>
        <BottomNav className="md:hidden" />
      </div>
    </div>
  );
}
