import { render, screen } from '@testing-library/react';
import { catalog } from '../samples';
import { CatalogPage } from './catalog-page';

describe('CatalogPage', () => {
  it('renders a section for every catalogued component', () => {
    render(<CatalogPage />);

    for (const title of Object.values(catalog.components)) {
      expect(screen.getByRole('region', { name: title })).toBeInTheDocument();
    }
  });
});
