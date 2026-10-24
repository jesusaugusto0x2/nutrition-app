import { createFileRoute, notFound } from '@tanstack/react-router';
import { CatalogPage } from '@/features/catalog/components/catalog-page';

/**
 * Component catalog, development only. Production builds answer 404, and
 * the page is code-split so its chunk is never loaded there.
 */
export const Route = createFileRoute('/dev/components')({
  beforeLoad: () => {
    if (!import.meta.env.DEV) {
      throw notFound();
    }
  },
  component: CatalogPage,
});
