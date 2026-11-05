import { Outlet } from '@tanstack/react-router';
import { Brand } from '@/components/navigation/brand';
import { BrandPanel } from '@/components/navigation/brand-panel';

/**
 * Pages outside the app (sign-in, sign-up, emailed links): one column on
 * phones, the brand panel beside the form on desktop.
 */
export function AuthLayout() {
  return (
    <div className="flex min-h-dvh">
      <BrandPanel className="hidden flex-1 lg:flex" />
      <main className="flex min-w-0 flex-1 flex-col items-center px-6 pt-9 pb-8 lg:justify-center lg:p-12">
        <div className="flex w-full max-w-[440px] flex-1 flex-col gap-6 lg:flex-none">
          <Brand variant="boxed" subtitle={null} className="lg:hidden" />
          <Outlet />
        </div>
      </main>
    </div>
  );
}
