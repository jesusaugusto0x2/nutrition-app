import { createFileRoute } from '@tanstack/react-router';
import { AuthLayout } from '@/features/auth/components/auth-layout';

/**
 * Pages opened from an emailed link. Unlike `_auth`, they also work for a
 * signed-in user: sending them home first would drop the token unused (a
 * password reset requested from another device, a link for another account).
 */
export const Route = createFileRoute('/_link')({
  component: AuthLayout,
});
