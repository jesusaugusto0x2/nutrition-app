import { createFileRoute } from '@tanstack/react-router';
import { LoginForm } from '@/features/auth/components/login-form';
import { validateLoginSearch } from '@/features/auth/redirect';

export const Route = createFileRoute('/_auth/login')({
  validateSearch: validateLoginSearch,
  component: LoginPage,
});

function LoginPage() {
  const { redirect, error } = Route.useSearch();
  return <LoginForm redirect={redirect} error={error} />;
}
