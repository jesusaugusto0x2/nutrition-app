import { createFileRoute, Outlet } from '@tanstack/react-router';

/** Layout for unauthenticated pages. Placeholder until auth exists. */
export const Route = createFileRoute('/_auth')({
  component: () => (
    <main className="flex min-h-dvh items-center justify-center p-4">
      <Outlet />
    </main>
  ),
});
