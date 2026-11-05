import type { AuthMe, Patient } from '@nutri/schemas';
import { QueryClientProvider } from '@tanstack/react-query';
import { createMemoryHistory, RouterProvider } from '@tanstack/react-router';
import { act, render, screen, waitFor, within } from '@testing-library/react';
import { createQueryClient } from '@/app/query-client';
import { createAppRouter } from '@/app/router';
import { t } from '@/i18n';
import { authKeys } from '../api';

const user = {
  id: '00000000-0000-4000-8000-000000000001',
  email: 'carmen.rojas@example.com',
  name: 'Carmen Rojas',
  emailVerified: true,
};
const staff: AuthMe = {
  user,
  memberships: [
    {
      clinicId: '00000000-0000-4000-8000-000000000002',
      clinicName: 'Nutrición Rojas',
      role: 'owner',
    },
  ],
  patientAccess: [],
};
const portalUser: AuthMe = {
  user,
  memberships: [],
  patientAccess: [
    {
      patientId: '00000000-0000-4000-8000-000000000003',
      firstName: 'Carmen',
      lastName: 'Rojas',
      relationship: 'self',
    },
  ],
};
const patient: Patient = {
  id: '00000000-0000-4000-8000-000000000003',
  firstName: 'Paciente',
  lastName: 'Secreto',
  birthDate: '1990-05-10',
  sex: 'female',
  phone: null,
  address: null,
  createdAt: '2026-01-01T10:00:00.000Z',
  updatedAt: '2026-01-01T10:00:00.000Z',
};

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), { status });
}

function renderApp(
  path: string,
  { me, signOutStatus = 204 }: { me: AuthMe; signOutStatus?: number },
) {
  vi.stubGlobal(
    'fetch',
    vi.fn((url: string) => {
      if (url === '/api/auth/me') return Promise.resolve(json(200, me));
      if (url === '/api/auth/sign-out') {
        return Promise.resolve(
          signOutStatus === 204
            ? new Response(null, { status: 204 })
            : json(signOutStatus, { message: 'boom' }),
        );
      }
      return Promise.resolve(json(200, [patient]));
    }),
  );
  const queryClient = createQueryClient(vi.fn());
  const router = createAppRouter(
    queryClient,
    createMemoryHistory({ initialEntries: [path] }),
  );
  render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
  return { queryClient, router };
}

async function click(element: HTMLElement | Promise<HTMLElement>) {
  const target = await element;
  act(() => target.click());
}

/** jsdom applies no CSS, so the sidebar and the bottom bar are both there. */
async function navigations() {
  const [sidebar, bottomNav] = await screen.findAllByRole('navigation', {
    name: t.nav.label,
  });
  return { sidebar, bottomNav };
}

describe('signed-in account', () => {
  beforeEach(() => {
    vi.stubGlobal('scrollTo', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('shows who is signed in at the foot of the sidebar', async () => {
    renderApp('/patients', { me: staff });
    const { sidebar } = await navigations();

    expect(await within(sidebar).findByText(user.name)).toBeInTheDocument();
    expect(within(sidebar).getByText(user.email)).toBeInTheDocument();
  });

  it('signs out from the sidebar, clearing cached data, and goes to the login page', async () => {
    const { queryClient, router } = renderApp('/patients', { me: staff });
    await screen.findByText(/Secreto/);
    const { sidebar } = await navigations();

    await click(
      within(sidebar).getByRole('button', { name: t.account.signOut }),
    );

    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/login');
    });
    await waitFor(() => {
      expect(queryClient.getQueryData(['patients'])).toBeUndefined();
    });
    expect(queryClient.getQueryData(authKeys.me)).toBeNull();
    expect(screen.queryByText(/Secreto/)).not.toBeInTheDocument();
  });

  it('signs out from the «Cuenta» menu of the bottom bar', async () => {
    const { router } = renderApp('/patients', { me: staff });
    const { bottomNav } = await navigations();

    await click(
      await within(bottomNav).findByRole('button', { name: t.account.menu }),
    );
    const menu = await screen.findByRole('dialog', { name: t.account.menu });
    expect(within(menu).getByText(user.email)).toBeInTheDocument();
    await click(within(menu).getByRole('button', { name: t.account.signOut }));

    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/login');
    });
  });

  it('keeps the session and says so when the API does not confirm', async () => {
    const { queryClient, router } = renderApp('/patients', {
      me: staff,
      signOutStatus: 500,
    });
    await screen.findByText(/Secreto/);
    const { sidebar } = await navigations();

    await click(
      within(sidebar).getByRole('button', { name: t.account.signOut }),
    );

    expect(await within(sidebar).findByRole('alert')).toHaveTextContent(
      t.account.signOutFailed,
    );
    expect(router.state.location.pathname).toBe('/patients');
    expect(queryClient.getQueryData(authKeys.me)).toEqual(staff);
  });

  it('signs out from the portal header', async () => {
    const { queryClient, router } = renderApp('/portal', { me: portalUser });

    await click(await screen.findByRole('button', { name: t.account.menu }));
    const menu = await screen.findByRole('dialog', { name: t.account.menu });
    expect(within(menu).getByText(user.name)).toBeInTheDocument();
    await click(within(menu).getByRole('button', { name: t.account.signOut }));

    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/login');
    });
    expect(queryClient.getQueryData(authKeys.me)).toBeNull();
  });
});
