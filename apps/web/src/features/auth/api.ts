import {
  type AuthMe,
  authMeSchema,
  authUserSchema,
  type ForgotPassword,
  type ResendVerification,
  type ResetPassword,
  type SignIn,
  type SignUp,
} from '@nutri/schemas';
import {
  type QueryClient,
  queryOptions,
  useMutation,
  useQueryClient,
} from '@tanstack/react-query';
import { type RegisteredRouter, useRouter } from '@tanstack/react-router';
import { ApiClientError, apiClient } from '@/lib/api-client';
import type { LoginSearch } from './redirect';

const LOGIN_PATH = '/login';

/*
 * A plain link until that page exists (#24): the router's `Link` only accepts
 * registered routes. That ticket should switch it to `Link`.
 */
export const FORGOT_PASSWORD_PATH = '/forgot-password';

export const authKeys = {
  me: ['auth', 'me'] as const,
};

/**
 * Who is signed in, or `null` for a signed-out visitor. A 401 is a normal
 * answer here, not an error: `/login` asks too, and the global 401 handler
 * must not fire for it.
 */
export function meQueryOptions() {
  return queryOptions({
    queryKey: authKeys.me,
    queryFn: async (): Promise<AuthMe | null> => {
      try {
        return await apiClient.get('/auth/me', authMeSchema);
      } catch (error) {
        if (error instanceof ApiClientError && error.status === 401) {
          return null;
        }
        throw error;
      }
    },
  });
}

/**
 * Drops everything cached, patient data and pending mutations included.
 * `me` stays as "signed out", so the guards do not need another request to
 * learn what is already known.
 */
export function clearSessionData(queryClient: QueryClient): void {
  queryClient.clear();
  queryClient.setQueryData(authKeys.me, null);
}

/**
 * Leaves the signed-in area. The order matters: the login page must see the
 * user as signed out, or it would send them back home; and the rest of the
 * cache goes only after the protected page unmounts, or that page would
 * refetch what was just removed.
 */
export async function endSession(
  queryClient: QueryClient,
  router: RegisteredRouter,
  search: LoginSearch = {},
): Promise<void> {
  queryClient.setQueryData(authKeys.me, null);
  await router.navigate({ to: LOGIN_PATH, search });
  clearSessionData(queryClient);
}

/** The API answered 401: the session expired or was revoked. */
export function handleUnauthorized(
  queryClient: QueryClient,
  router: RegisteredRouter,
): Promise<void> {
  const { pathname, href } = router.latestLocation;
  if (pathname === LOGIN_PATH) {
    // A late response. Going to /login again would replace its `redirect`.
    clearSessionData(queryClient);
    return Promise.resolve();
  }
  return endSession(queryClient, router, { redirect: href });
}

export function useSignIn() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: SignIn) =>
      apiClient.post('/auth/sign-in', body, authUserSchema),
    // Removed, not invalidated, so nothing can read the old "signed out".
    onSuccess: () => queryClient.removeQueries({ queryKey: authKeys.me }),
  });
}

/**
 * Clears only once the API confirmed: the cookie is `HttpOnly`, so on failure
 * the user is still signed in and must not be told otherwise.
 */
export function useSignOut() {
  const queryClient = useQueryClient();
  const router = useRouter();
  return useMutation({
    mutationFn: () => apiClient.postEmpty('/auth/sign-out'),
    onSuccess: () => endSession(queryClient, router),
  });
}

/**
 * Always 202 with no body: the API answers the same whether or not the email
 * already has an account, and never signs the user in.
 */
export function useSignUp() {
  return useMutation({
    mutationFn: (body: SignUp) => apiClient.postEmpty('/auth/sign-up', body),
  });
}

export function useForgotPassword() {
  return useMutation({
    mutationFn: (body: ForgotPassword) =>
      apiClient.postEmpty('/auth/forgot-password', body),
  });
}

export function useResendVerification() {
  return useMutation({
    mutationFn: (body: ResendVerification) =>
      apiClient.postEmpty('/auth/resend-verification', body),
  });
}

export function useResetPassword() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: ResetPassword) =>
      apiClient.postEmpty('/auth/reset-password', body),
    // The API ends every session of the user, including this one.
    onSuccess: () => clearSessionData(queryClient),
  });
}
