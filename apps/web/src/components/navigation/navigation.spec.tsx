import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  Outlet,
  RouterProvider,
} from '@tanstack/react-router';
import { render, screen } from '@testing-library/react';
import { t } from '@/i18n';
import { BottomNav } from './bottom-nav';
import { Sidebar } from './sidebar';

function renderAt(path: string) {
  const rootRoute = createRootRoute({
    component: () => (
      <>
        <Sidebar />
        <BottomNav />
        <Outlet />
      </>
    ),
  });
  const routes = ['/', '/patients', '/patients/$patientId'].map((routePath) =>
    createRoute({ getParentRoute: () => rootRoute, path: routePath }),
  );
  const router = createRouter({
    routeTree: rootRoute.addChildren(routes),
    history: createMemoryHistory({ initialEntries: [path] }),
  });
  return render(<RouterProvider router={router} />);
}

describe('Sidebar and BottomNav', () => {
  it('keep Pacientes active inside a patient profile', async () => {
    renderAt('/patients/00000000-0000-4000-8000-000000000001');

    const links = await screen.findAllByRole('link', { name: t.nav.patients });
    for (const link of links) {
      expect(link).toHaveAttribute('aria-current', 'page');
    }
    for (const link of screen.getAllByRole('link', { name: t.nav.home })) {
      expect(link).not.toHaveAttribute('aria-current');
    }
  });

  it('show coming-soon features as disabled', async () => {
    renderAt('/patients');

    expect(
      await screen.findByRole('button', {
        name: t.comingSoon.features.agenda.menu,
      }),
    ).toBeDisabled();
  });
});
