import { fireEvent, render, screen } from '@testing-library/react';
import { t } from '@/i18n';
import { Pagination, pageWindow } from './pagination';

describe('pageWindow', () => {
  it('describes the items of a page', () => {
    expect(pageWindow(1, 3, 4)).toEqual({
      pageCount: 2,
      from: 1,
      to: 3,
      start: 0,
      end: 3,
    });
    expect(pageWindow(2, 3, 4)).toMatchObject({ from: 4, to: 4 });
  });

  it('clamps pages out of range', () => {
    expect(pageWindow(9, 3, 4)).toMatchObject({ from: 4, to: 4 });
    expect(pageWindow(0, 3, 4)).toMatchObject({ from: 1, to: 3 });
  });

  it('has a single empty page without items', () => {
    expect(pageWindow(1, 3, 0)).toMatchObject({ pageCount: 1, from: 0, to: 0 });
  });
});

describe('Pagination', () => {
  it('is hidden when everything fits in one page', () => {
    const { container } = render(
      <Pagination
        page={1}
        perPage={5}
        total={4}
        items="consultas"
        onPageChange={vi.fn()}
      />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('tells what is shown and marks the current page', () => {
    render(
      <Pagination
        page={1}
        perPage={3}
        total={4}
        items="consultas"
        onPageChange={vi.fn()}
      />,
    );

    expect(
      screen.getByText(t.pagination.showing(1, 3, 4, 'consultas')),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: t.pagination.page(1) }),
    ).toHaveAttribute('aria-current', 'page');
    expect(
      screen.getByRole('button', { name: t.pagination.newer }),
    ).toBeDisabled();
  });

  it('moves towards older items', () => {
    const onPageChange = vi.fn();
    render(
      <Pagination
        page={1}
        perPage={3}
        total={4}
        items="consultas"
        onPageChange={onPageChange}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: t.pagination.older }));

    expect(onPageChange).toHaveBeenCalledWith(2);
  });
});
