import type { QueryClient } from '@tanstack/react-query';
import { createRouter, type RouterHistory } from '@tanstack/react-router';
import { ErrorState } from '@/components/error-state';
import { LoadingState } from '@/components/loading-state';
import { routeTree } from '../routeTree.gen';

export interface RouterContext {
  queryClient: QueryClient;
}

export function createAppRouter(
  queryClient: QueryClient,
  history?: RouterHistory,
) {
  return createRouter({
    routeTree,
    history,
    context: { queryClient },
    // Data freshness is owned by TanStack Query.
    defaultPreload: 'intent',
    defaultPreloadStaleTime: 0,
    scrollRestoration: true,
    defaultPendingComponent: LoadingState,
    defaultErrorComponent: ErrorState,
  });
}

declare module '@tanstack/react-router' {
  interface Register {
    router: ReturnType<typeof createAppRouter>;
  }
}
