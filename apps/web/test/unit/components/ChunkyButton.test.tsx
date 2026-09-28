import { ChunkyButton } from '@/components/ui/chunky-button';
import { renderWithProviders, screen } from '../../utils';
import { describe, expect, it, vi } from 'vitest';

describe('ChunkyButton component', () => {
  it('renders children correctly', () => {
    renderWithProviders(<ChunkyButton>Click me</ChunkyButton>);
    expect(
      screen.getByRole('button', { name: 'Click me' })
    ).toBeInTheDocument();
  });

  it('applies primary green variant styling by default', () => {
    renderWithProviders(<ChunkyButton>Primary</ChunkyButton>);
    const button = screen.getByRole('button', { name: 'Primary' });
    expect(button.className).toMatch('bg-[var(--green)]');
    expect(button.className).toMatch('border-[var(--green-dark)]');
  });

  it('supports green alias variant', () => {
    renderWithProviders(<ChunkyButton variant="green">Green</ChunkyButton>);
    const button = screen.getByRole('button', { name: 'Green' });
    expect(button.className).toMatch('bg-[var(--green)]');
  });

  it('renders blue variant styling', () => {
    renderWithProviders(<ChunkyButton variant="blue">Blue</ChunkyButton>);
    const button = screen.getByRole('button', { name: 'Blue' });
    expect(button.className).toMatch('bg-[var(--blue)]');
    expect(button.className).toMatch('border-[var(--blue-dark)]');
  });

  it('renders danger variant styling', () => {
    renderWithProviders(<ChunkyButton variant="danger">Delete</ChunkyButton>);
    const button = screen.getByRole('button', { name: 'Delete' });
    expect(button.className).toMatch('bg-[var(--red)]');
    expect(button.className).toMatch('border-[var(--red-dark)]');
  });

  it('renders translucent variant styling', () => {
    renderWithProviders(
      <ChunkyButton variant="translucent">Info</ChunkyButton>
    );
    const button = screen.getByRole('button', { name: 'Info' });
    expect(button.className).toMatch('bg-white/20');
    expect(button.className).toMatch('backdrop-blur-sm');
  });

  it('renders outline variant styling', () => {
    renderWithProviders(
      <ChunkyButton variant="outline">Outline</ChunkyButton>
    );
    const button = screen.getByRole('button', { name: 'Outline' });
    expect(button.className).toMatch('bg-[var(--bg)]');
    expect(button.className).toMatch('border-[var(--border)]');
  });

  it('renders gold variant styling', () => {
    renderWithProviders(<ChunkyButton variant="gold">Star</ChunkyButton>);
    const button = screen.getByRole('button', { name: 'Star' });
    expect(button.className).toMatch('bg-[var(--gold)]');
    expect(button.className).toMatch('border-[var(--gold-dark)]');
  });

  it('applies tactile press physics (border-bottom depression and active translation)', () => {
    renderWithProviders(<ChunkyButton>Press</ChunkyButton>);
    const button = screen.getByRole('button', { name: 'Press' });
    expect(button.className).toMatch('border-b-4');
    expect(button.className).toMatch('active:translate-y-[2px]');
    expect(button.className).toMatch('active:border-b-2');
  });

  it('supports icon size for 44px circular buttons', () => {
    renderWithProviders(
      <ChunkyButton size="icon" aria-label="Search">
        S
      </ChunkyButton>
    );
    const button = screen.getByRole('button', { name: 'Search' });
    expect(button.className).toMatch('w-11');
    expect(button.className).toMatch('h-11');
    expect(button.className).toMatch('rounded-full');
  });

  it('exposes visible keyboard focus ring', () => {
    renderWithProviders(<ChunkyButton>Focus</ChunkyButton>);
    const button = screen.getByRole('button', { name: 'Focus' });
    expect(button.className).toMatch('focus-visible:ring-2');
    expect(button.className).toMatch('focus-visible:ring-[var(--blue)]');
  });

  it('handles click events', async () => {
    const handleClick = vi.fn();
    const { user } = renderWithProviders(
      <ChunkyButton onClick={handleClick}>Submit</ChunkyButton>
    );

    await user.click(screen.getByRole('button', { name: 'Submit' }));
    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  it('respects disabled state', async () => {
    const handleClick = vi.fn();
    const { user } = renderWithProviders(
      <ChunkyButton disabled onClick={handleClick}>
        Disabled
      </ChunkyButton>
    );

    const button = screen.getByRole('button', { name: 'Disabled' });
    expect(button).toBeDisabled();
    expect(button).toHaveClass('disabled:opacity-50');
    await user.click(button);
    expect(handleClick).not.toHaveBeenCalled();
  });

  it('is keyboard operable with Enter', async () => {
    const handleClick = vi.fn();
    const { user } = renderWithProviders(
      <ChunkyButton onClick={handleClick}>Keyboard</ChunkyButton>
    );

    const button = screen.getByRole('button', { name: 'Keyboard' });
    button.focus();
    expect(button).toHaveFocus();
    await user.keyboard('{Enter}');
    expect(handleClick).toHaveBeenCalledTimes(1);
  });
});
