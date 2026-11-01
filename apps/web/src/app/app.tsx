import { QueryClientProvider } from '@tanstack/react-query';
import { RouterProvider } from '@tanstack/react-router';
import { handleUnauthorized } from '@/features/auth/api';
import { createQueryClient } from './query-client';
import { createAppRouter } from './router';

const queryClient = createQueryClient(() => {
  void handleUnauthorized(queryClient, router);
});
const router = createAppRouter(queryClient);

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  );
}
