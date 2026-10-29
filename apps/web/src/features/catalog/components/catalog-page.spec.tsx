import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  RouterProvider,
} from '@tanstack/react-router';
import { render, screen, within } from '@testing-library/react';
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
    await screen.findByRole('navigation', { name: catalog.indexTitle });

    // A section labelled by its heading is a region named by that heading.
    // Read the names from the DOM: a role query per title walks the whole
    // accessibility tree each time and timed out on CI runners.
    const regionNames = Array.from(
      document.querySelectorAll('section[aria-labelledby]'),
      (section) =>
        document.getElementById(section.getAttribute('aria-labelledby') ?? '')
          ?.textContent,
    );
    for (const title of Object.values(catalog.components)) {
      expect(regionNames).toContain(title);
    }
  });

  it('links every index entry to an existing section', async () => {
    renderCatalog();
    const index = await screen.findByRole('navigation', {
      name: catalog.indexTitle,
    });

    const links = within(index).getAllByRole('link');
    expect(links).toHaveLength(Object.keys(catalog.components).length);
    for (const link of links) {
      const id = link.getAttribute('href')?.slice(1) ?? '';
      expect(document.getElementById(id)).not.toBeNull();
    }
  });
});
