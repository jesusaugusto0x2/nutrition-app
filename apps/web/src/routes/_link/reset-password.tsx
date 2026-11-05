import { createFileRoute } from '@tanstack/react-router';
import { ResetPasswordForm } from '@/features/auth/components/reset-password-form';
import { useLinkToken, validateLinkSearch } from '@/features/auth/link-token';

export const Route = createFileRoute('/_link/reset-password')({
  validateSearch: validateLinkSearch,
  component: ResetPasswordPage,
});

function ResetPasswordPage() {
  const token = useLinkToken(Route.useSearch().token);
  return <ResetPasswordForm token={token} />;
}
