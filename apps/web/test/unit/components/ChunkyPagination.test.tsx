import { ChunkyPaginationBar } from '@/components/ui/chunky-pagination';
import { renderWithProviders, screen } from '../../utils';
import { describe, expect, it, vi } from 'vitest';

describe('ChunkyPaginationBar component', () => {
  it('renders previous and next chips with accessible page label when totalPages > 1', () => {
    renderWithProviders(
      <ChunkyPaginationBar
        currentPage={2}
        totalPages={5}
        onPageChange={() => {}}
      />
    );

    expect(
      screen.getByRole('navigation', { name: 'Pagination' })
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Previous page' })
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Next page' })
    ).toBeInTheDocument();

    const label = screen.getByText('Page 2 of 5');
    expect(label).toBeInTheDocument();
    expect(label).toHaveAttribute('aria-live', 'polite');
  });

  it('returns null when totalPages <= 1', () => {
    const { container: one } = renderWithProviders(
      <ChunkyPaginationBar currentPage={1} totalPages={1} onPageChange={() => {}} />
    );
    expect(one).toBeEmptyDOMElement();

    const { container: zero } = renderWithProviders(
      <ChunkyPaginationBar currentPage={1} totalPages={0} onPageChange={() => {}} />
    );
    expect(zero).toBeEmptyDOMElement();
  });

  it('calls onPageChange with currentPage - 1 on Previous and currentPage + 1 on Next', async () => {
    const handleChange = vi.fn();
    const { user } = renderWithProviders(
      <ChunkyPaginationBar
        currentPage={2}
        totalPages={5}
        onPageChange={handleChange}
      />
    );

    await user.click(screen.getByRole('button', { name: 'Previous page' }));
    expect(handleChange).toHaveBeenCalledWith(1);

    await user.click(screen.getByRole('button', { name: 'Next page' }));
    expect(handleChange).toHaveBeenCalledWith(3);
  });

  it('disables Previous on first page and Next on last page', () => {
    const { unmount } = renderWithProviders(
      <ChunkyPaginationBar currentPage={1} totalPages={4} onPageChange={() => {}} />
    );
    expect(screen.getByRole('button', { name: 'Previous page' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Next page' })).not.toBeDisabled();
    unmount();

    renderWithProviders(
      <ChunkyPaginationBar currentPage={4} totalPages={4} onPageChange={() => {}} />
    );
    expect(screen.getByRole('button', { name: 'Next page' })).toBeDisabled();
    expect(
      screen.getByRole('button', { name: 'Previous page' })
    ).not.toBeDisabled();
  });

  it('disables both buttons when disabled prop is true', () => {
    renderWithProviders(
      <ChunkyPaginationBar
        currentPage={2}
        totalPages={4}
        onPageChange={() => {}}
        disabled
      />
    );

    expect(screen.getByRole('button', { name: 'Previous page' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Next page' })).toBeDisabled();
  });
});
