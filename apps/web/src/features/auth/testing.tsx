/*
 * Helpers for specs of the pages outside the app. Test-only: nothing in the
 * app imports this file.
 */
import { QueryClientProvider } from '@tanstack/react-query';
import { createMemoryHistory, RouterProvider } from '@tanstack/react-router';
import { render } from '@testing-library/react';
import { StrictMode } from 'react';
import { createQueryClient } from '@/app/query-client';
import { createAppRouter } from '@/app/router';

export function json(status: number, body: unknown, headers?: HeadersInit) {
  return new Response(JSON.stringify(body), { status, headers });
}

export function apiError(status: number, code: string) {
  return {
    statusCode: status,
    code,
    message: code,
    path: '/api/auth',
    timestamp: '2026-01-01T10:00:00.000Z',
  };
}

export const accepted = () => new Response(null, { status: 202 });
export const noContent = () => new Response(null, { status: 204 });
export const signedOut = () => json(401, apiError(401, 'UNAUTHORIZED'));
export const invalidToken = () => json(400, apiError(400, 'INVALID_TOKEN'));
export const serverError = () => json(500, apiError(500, 'INTERNAL_ERROR'));
export const throttled = (retryAfter?: string) =>
  json(
    429,
    apiError(429, 'TOO_MANY_REQUESTS'),
    retryAfter ? { 'Retry-After': retryAfter } : undefined,
  );

/**
 * Answers each API path with its handler, called on every request; `me`
 * answers "signed out" unless given. Any other path fails the request.
 */
export function stubApi(handlers: Record<string, () => Response>) {
  const routes: Record<string, () => Response> = {
    '/api/auth/me': signedOut,
    ...handlers,
  };
  const fetchMock = vi.fn((path: string) => {
    const handler = routes[path];
    return handler
      ? Promise.resolve(handler())
      : Promise.reject(new Error(`Unexpected request to ${path}`));
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

export type FetchMock = ReturnType<typeof stubApi>;

export function bodiesOf(fetchMock: FetchMock, path: string): unknown[] {
  return fetchMock.mock.calls
    .filter(([calledPath]) => calledPath === path)
    .map((call) => {
      const init = (call as unknown as [string, RequestInit])[1];
      return JSON.parse(init.body as string) as unknown;
    });
}

/** Renders the whole app at `url`, after `previous` in the history. */
export function openApp(url: string, previous: string[] = []) {
  const queryClient = createQueryClient(vi.fn());
  const history = createMemoryHistory({ initialEntries: [...previous, url] });
  const router = createAppRouter(queryClient, history);
  render(
    // Strict Mode runs effects twice, as in development.
    <StrictMode>
      <QueryClientProvider client={queryClient}>
        <RouterProvider router={router} />
      </QueryClientProvider>
    </StrictMode>,
  );
  return { router, history, queryClient };
}
