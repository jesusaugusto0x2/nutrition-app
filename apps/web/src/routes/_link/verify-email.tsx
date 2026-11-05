import { createFileRoute } from '@tanstack/react-router';
import { VerifyEmail } from '@/features/auth/components/verify-email';
import { useLinkToken, validateLinkSearch } from '@/features/auth/link-token';

export const Route = createFileRoute('/_link/verify-email')({
  validateSearch: validateLinkSearch,
  component: VerifyEmailPage,
});

function VerifyEmailPage() {
  const token = useLinkToken(Route.useSearch().token);
  return <VerifyEmail token={token} />;
}
