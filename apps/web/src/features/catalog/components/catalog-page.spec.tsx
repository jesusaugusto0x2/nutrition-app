import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  RouterProvider,
} from '@tanstack/react-router';
import { render, screen } from '@testing-library/react';
import { catalog } from '../samples';
import { CatalogPage } from './catalog-page';

function renderCatalog() {
  const rootRoute = createRootRoute();
  const catalogRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/',
    component: CatalogPage,
  });
  // Patient rows link to the profile.
  const patientRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/patients/$patientId',
  });
  const router = createRouter({
    routeTree: rootRoute.addChildren([catalogRoute, patientRoute]),
    history: createMemoryHistory({ initialEntries: ['/'] }),
  });
  return render(<RouterProvider router={router} />);
}

describe('CatalogPage', () => {
  it('renders a section for every catalogued component', async () => {
    renderCatalog();

    for (const title of Object.values(catalog.components)) {
      expect(
        await screen.findByRole('region', { name: title }),
      ).toBeInTheDocument();
    }
  });
});
