import { describe, expect, it } from 'vitest';
import { ErrorBanner } from '@/modules/videos/internal/catalog';
import { renderWithProviders, screen } from '../../utils';

describe('ErrorBanner', () => {
  it('renders the error message text', () => {
    renderWithProviders(<ErrorBanner message="Failed to load series" />);
    expect(screen.getByText('Failed to load series')).toBeInTheDocument();
  });

  it("renders Lucide's AlertCircle icon", () => {
    const { container } = renderWithProviders(
      <ErrorBanner message="Something went wrong" />
    );
    const icon = container.querySelector('svg');
    expect(icon).toBeInTheDocument();
    // Lucide icons carry the `lucide` class plus a per-icon class.
    expect(icon?.getAttribute('class')).toContain('lucide');
    expect(icon).toHaveClass('w-4', 'h-4', 'shrink-0');
    expect(icon).toHaveAttribute('aria-hidden', 'true');
  });

  it('keeps the chunky error styling', () => {
    const { container } = renderWithProviders(
      <ErrorBanner message="Boom" />
    );
    const banner = container.firstElementChild;
    expect(banner?.className).toContain('border-[var(--red)]');
    expect(banner?.className).toContain('rounded-2xl');
  });
});
