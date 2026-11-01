import { createFileRoute } from '@tanstack/react-router';
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { requireNoAccount } from '@/features/auth/guards';
import { t } from '@/i18n';

// TODO(#25): Replace with the clinic-name form once POST /api/auth/onboarding
// exists. Outside `_auth` on purpose: this user is signed in, and that layout
// would send them back here forever.
export const Route = createFileRoute('/onboarding')({
  beforeLoad: ({ context, location }) =>
    requireNoAccount(context.queryClient, location.href),
  component: () => (
    <main className="flex min-h-dvh items-center justify-center p-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>{t.onboarding.title}</CardTitle>
          <CardDescription>{t.onboarding.comingSoon}</CardDescription>
        </CardHeader>
      </Card>
    </main>
  ),
});
