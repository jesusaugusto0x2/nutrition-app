import { createFileRoute, Outlet } from '@tanstack/react-router';
import { redirectIfSignedIn } from '@/features/auth/guards';

/** Layout for pages meant for signed-out visitors. */
export const Route = createFileRoute('/_auth')({
  beforeLoad: ({ context }) => redirectIfSignedIn(context.queryClient),
  component: () => (
    <main className="flex min-h-dvh items-center justify-center p-4">
      <Outlet />
    </main>
  ),
});
