import { describe, expect, it, vi, beforeEach } from 'vitest';
import { screen, fireEvent } from '../../utils';
import * as React from 'react';

const navigateMock = vi.fn();

vi.mock('@tanstack/react-router', () => ({
  useNavigate: () => navigateMock,
}));

import { renderWithProviders } from '../../utils';
import { BackButton } from '@/components/ui/back-button';

describe('BackButton primitive', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders default label with pill shape, surface background, green border, chevron icon, and bold typography', () => {
    renderWithProviders(<BackButton />);
    const button = screen.getByRole('button', { name: 'Back' });
    expect(button).toBeInTheDocument();
    expect(button).toHaveTextContent('Back');
    expect(button).toHaveClass('rounded-full');
    expect(button.className).toMatch('bg-[var(--surface)]');
    expect(button.className).toMatch('border-[#58cc02]/60');
    expect(button.className).toMatch('font-bold');
    expect(button.querySelector('svg')).toBeInTheDocument();
  });

  it('navigates to /admin/videos by default via TanStack Router', () => {
    renderWithProviders(<BackButton />);
    fireEvent.click(screen.getByRole('button', { name: 'Back' }));
    expect(navigateMock).toHaveBeenCalledWith({ to: '/admin/videos' });
  });

  it('invokes custom onClick instead of router navigation', () => {
    const handleClick = vi.fn();
    renderWithProviders(<BackButton onClick={handleClick} />);
    fireEvent.click(screen.getByRole('button', { name: 'Back' }));
    expect(handleClick).toHaveBeenCalledTimes(1);
    expect(navigateMock).not.toHaveBeenCalled();
  });

  it('supports custom labels and aria-labels', () => {
    renderWithProviders(
      <BackButton label="Back to Overview" aria-label="Back to series overview" />
    );
    const button = screen.getByRole('button', {
      name: 'Back to series overview',
    });
    expect(button).toHaveTextContent('Back to Overview');
  });

  it('forwards refs via backRef', () => {
    const ref = React.createRef<HTMLButtonElement>();
    renderWithProviders(<BackButton backRef={ref} />);
    expect(ref.current).toBeInstanceOf(HTMLButtonElement);
  });

  it('applies spatial focus ring when focused in spatial mode', () => {
    renderWithProviders(<BackButton isSpatialMode isFocused />);
    const button = screen.getByRole('button', { name: 'Back' });
    expect(button).toHaveClass('ring-2', 'ring-white');
  });

  it('omits spatial focus ring when not focused', () => {
    renderWithProviders(<BackButton isSpatialMode isFocused={false} />);
    const button = screen.getByRole('button', { name: 'Back' });
    expect(button).not.toHaveClass('ring-2');
  });

  it('merges custom className', () => {
    renderWithProviders(<BackButton className="custom-class" />);
    expect(screen.getByRole('button', { name: 'Back' })).toHaveClass(
      'custom-class'
    );
  });
});
