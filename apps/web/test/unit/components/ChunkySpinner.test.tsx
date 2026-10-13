import { describe, expect, it } from 'vitest';
import { ChunkySpinner } from '@/components/ui/chunky-spinner';
import { renderWithProviders, screen } from '../../utils';

describe('ChunkySpinner primitive', () => {
  it('renders a Loader2 spinner with default md sizing', () => {
    renderWithProviders(<ChunkySpinner />);
    const spinner = document.querySelector('svg');
    expect(spinner).toBeInTheDocument();
    expect(spinner).toHaveClass('animate-spin', 'h-5', 'w-5');
    expect(spinner).toHaveAttribute('aria-hidden', 'true');
  });

  it('renders each size variant with the expected classes', () => {
    const sizes = {
      xs: ['h-3', 'w-3'],
      sm: ['h-4', 'w-4'],
      md: ['h-5', 'w-5'],
      lg: ['h-8', 'w-8'],
    } as const;
    for (const [size, classes] of Object.entries(sizes)) {
      const { unmount } = renderWithProviders(
        <ChunkySpinner size={size as keyof typeof sizes} />
      );
      const spinner = document.querySelector('svg');
      expect(spinner).toHaveClass('animate-spin', ...classes);
      expect(spinner).toHaveAttribute('aria-hidden', 'true');
      unmount();
    }
  });

  it('merges custom class names', () => {
    renderWithProviders(<ChunkySpinner size="sm" className="text-[var(--gold)]" />);
    const spinner = document.querySelector('svg');
    expect(spinner).toHaveClass('animate-spin', 'h-4', 'w-4', 'text-[var(--gold)]');
  });

  it('is hidden from assistive technology', () => {
    renderWithProviders(
      <div>
        <ChunkySpinner />
        <span>Loading series…</span>
      </div>
    );
    expect(screen.getByText('Loading series…')).toBeInTheDocument();
    expect(document.querySelector('svg')).toHaveAttribute('aria-hidden', 'true');
  });
});
