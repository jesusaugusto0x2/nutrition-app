import { createFileRoute, redirect } from '@tanstack/react-router';

// Until auth exists, the clinic area is the entry point.
export const Route = createFileRoute('/')({
  beforeLoad: () => {
    throw redirect({ to: '/patients' });
  },
});
