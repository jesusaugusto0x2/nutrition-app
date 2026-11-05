import { createFileRoute } from '@tanstack/react-router';
import { AuthLayout } from '@/features/auth/components/auth-layout';
import { redirectIfSignedIn } from '@/features/auth/guards';

/** Pages for signed-out visitors: a signed-in user goes home instead. */
export const Route = createFileRoute('/_auth')({
  beforeLoad: ({ context }) => redirectIfSignedIn(context.queryClient),
  component: AuthLayout,
});
