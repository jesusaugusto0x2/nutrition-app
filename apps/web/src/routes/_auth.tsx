import { createFileRoute, Outlet } from '@tanstack/react-router';
import { authConfigQueryOptions } from '@/features/auth/api';
import { AuthLayout } from '@/features/auth/components/auth-layout';
import { redirectIfSignedIn } from '@/features/auth/guards';

/** Layout for pages meant for signed-out visitors. */
export const Route = createFileRoute('/_auth')({
  beforeLoad: ({ context }) => redirectIfSignedIn(context.queryClient),
  // Fills the TanStack Query cache only: the pages read the config with
  // `useQuery(authConfigQueryOptions())`, never from the loader result.
  loader: ({ context }) =>
    context.queryClient.ensureQueryData(authConfigQueryOptions()),
  component: () => (
    <AuthLayout>
      <Outlet />
    </AuthLayout>
  ),
});
