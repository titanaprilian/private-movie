import { ChunkyChip } from '@/components/ui/chunky-chip';
import { renderWithProviders, screen } from '../../utils';
import { describe, expect, it, vi } from 'vitest';

describe('ChunkyChip component', () => {
  it('renders children correctly', () => {
    renderWithProviders(<ChunkyChip>Edit</ChunkyChip>);
    expect(screen.getByRole('button', { name: 'Edit' })).toBeInTheDocument();
  });

  it('uses 44px height for filter triggers and pagination controls', () => {
    renderWithProviders(<ChunkyChip>Chip</ChunkyChip>);
    const chip = screen.getByRole('button', { name: 'Chip' });
    expect(chip.className).toMatch('h-11');
    expect(chip.className).toMatch('min-h-11');
  });

  it('applies tactile press physics', () => {
    renderWithProviders(<ChunkyChip>Chip</ChunkyChip>);
    const chip = screen.getByRole('button', { name: 'Chip' });
    expect(chip.className).toMatch('border-b-4');
    expect(chip.className).toMatch('active:translate-y-[2px]');
    expect(chip.className).toMatch('active:border-b-2');
  });

  it('renders default outline styling', () => {
    renderWithProviders(<ChunkyChip>Default</ChunkyChip>);
    const chip = screen.getByRole('button', { name: 'Default' });
    expect(chip.className).toMatch('border-[var(--border)]');
  });

  it('renders active green-tint highlight', () => {
    renderWithProviders(<ChunkyChip variant="active">Active</ChunkyChip>);
    const chip = screen.getByRole('button', { name: 'Active' });
    expect(chip.className).toMatch('bg-[var(--green-soft)]');
    expect(chip.className).toMatch('border-[var(--green)]');
    expect(chip.className).toMatch('text-[var(--green)]');
  });

  it('reflects pressed state via aria-pressed', () => {
    renderWithProviders(<ChunkyChip pressed>Pressed</ChunkyChip>);
    expect(screen.getByRole('button', { name: 'Pressed' })).toHaveAttribute(
      'aria-pressed',
      'true'
    );
  });

  it('exposes visible keyboard focus ring', () => {
    renderWithProviders(<ChunkyChip>Focus</ChunkyChip>);
    const chip = screen.getByRole('button', { name: 'Focus' });
    expect(chip.className).toMatch('focus-visible:ring-2');
    expect(chip.className).toMatch('focus-visible:ring-[var(--blue)]');
  });

  it('handles click events', async () => {
    const handleClick = vi.fn();
    const { user } = renderWithProviders(
      <ChunkyChip onClick={handleClick}>Click</ChunkyChip>
    );

    await user.click(screen.getByRole('button', { name: 'Click' }));
    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  it('respects disabled state', async () => {
    const handleClick = vi.fn();
    const { user } = renderWithProviders(
      <ChunkyChip disabled onClick={handleClick}>
        Disabled
      </ChunkyChip>
    );

    const chip = screen.getByRole('button', { name: 'Disabled' });
    expect(chip).toBeDisabled();
    await user.click(chip);
    expect(handleClick).not.toHaveBeenCalled();
  });
});
