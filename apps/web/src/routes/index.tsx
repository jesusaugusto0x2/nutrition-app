import { createFileRoute } from '@tanstack/react-router';
import { redirectToHome } from '@/features/auth/guards';

export const Route = createFileRoute('/')({
  beforeLoad: ({ context }) => redirectToHome(context.queryClient),
});
