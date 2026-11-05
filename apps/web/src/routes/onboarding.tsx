import { createFileRoute } from '@tanstack/react-router';
import { AuthLayout } from '@/features/auth/components/auth-layout';
import { OnboardingForm } from '@/features/auth/components/onboarding-form';
import { requireNoAccount } from '@/features/auth/guards';

// Outside `_auth` on purpose: this user is signed in, and that layout would
// send them back here forever.
export const Route = createFileRoute('/onboarding')({
  beforeLoad: ({ context, location }) =>
    requireNoAccount(context.queryClient, location.href),
  component: () => (
    <AuthLayout>
      <OnboardingForm />
    </AuthLayout>
  ),
});
