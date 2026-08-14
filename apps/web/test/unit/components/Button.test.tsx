import { Button } from '@/components/ui/button';
import { renderWithProviders, screen } from '../../utils';
import { describe, expect, it, vi } from 'vitest';

describe('Button component', () => {
  it('renders children correctly', () => {
    renderWithProviders(<Button>Click me</Button>);
    expect(
      screen.getByRole('button', { name: 'Click me' })
    ).toBeInTheDocument();
  });

  it('applies default primary styling classes using CSS variables', () => {
    renderWithProviders(<Button>Primary</Button>);
    const button = screen.getByRole('button', { name: 'Primary' });
    expect(button).toHaveClass('bg-primary');
    expect(button).toHaveClass('text-primary-fg');
    expect(button).toHaveClass('focus-visible:ring-[var(--primary)]');
  });

  it('applies secondary variant styling classes', () => {
    renderWithProviders(<Button variant="secondary">Secondary</Button>);
    const button = screen.getByRole('button', { name: 'Secondary' });
    expect(button).toHaveClass('border-c');
  });

  it('handles click events', async () => {
    const handleClick = vi.fn();
    const { user } = renderWithProviders(
      <Button onClick={handleClick}>Submit</Button>
    );

    await user.click(screen.getByRole('button', { name: 'Submit' }));
    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  it('respects disabled state', async () => {
    const handleClick = vi.fn();
    const { user } = renderWithProviders(
      <Button disabled onClick={handleClick}>
        Disabled
      </Button>
    );

    const button = screen.getByRole('button', { name: 'Disabled' });
    expect(button).toBeDisabled();
    await user.click(button);
    expect(handleClick).not.toHaveBeenCalled();
  });
});
