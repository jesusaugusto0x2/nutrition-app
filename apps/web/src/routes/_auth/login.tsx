import { createFileRoute } from '@tanstack/react-router';
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { t } from '@/i18n';

// TODO(auth): Replace with the real sign-in form once the API has auth.
export const Route = createFileRoute('/_auth/login')({
  component: () => (
    <Card className="w-full max-w-sm">
      <CardHeader>
        <CardTitle>{t.auth.title}</CardTitle>
        <CardDescription>{t.auth.comingSoon}</CardDescription>
      </CardHeader>
    </Card>
  ),
});
