import { createFileRoute, Outlet } from '@tanstack/react-router';
import { AuthLayout } from '@/features/auth/components/auth-layout';
import { redirectIfSignedIn } from '@/features/auth/guards';

/** Layout for pages meant for signed-out visitors. */
export const Route = createFileRoute('/_auth')({
  beforeLoad: ({ context }) => redirectIfSignedIn(context.queryClient),
  component: () => (
    <AuthLayout>
      <Outlet />
    </AuthLayout>
  ),
});
