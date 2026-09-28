import { describe, expect, it, vi } from 'vitest';
import { ChunkyCheckbox } from '@/components/ui/chunky-checkbox';
import { renderWithProviders, screen } from '../../utils';

describe('ChunkyCheckbox primitive', () => {
  it('renders an unchecked 24x24 custom checkbox with 3D bottom border', () => {
    renderWithProviders(<ChunkyCheckbox aria-label="Select episode" />);
    const box = screen.getByRole('checkbox', { name: 'Select episode' });
    expect(box).toBeInTheDocument();
    expect(box).toHaveAttribute('aria-checked', 'false');
    expect(box).toHaveAttribute('data-state', 'unchecked');
    expect(box).toHaveClass('h-6', 'w-6', 'rounded-[8px]', 'border-2', 'border-b-4');
  });

  it('renders checked state with green background', () => {
    renderWithProviders(<ChunkyCheckbox checked aria-label="Select episode" />);
    const box = screen.getByRole('checkbox', { name: 'Select episode' });
    expect(box).toHaveAttribute('aria-checked', 'true');
    expect(box).toHaveAttribute('data-state', 'checked');
    expect(box.className).toMatch('bg-[var(--green)]');
  });

  it('renders indeterminate state with mixed aria-checked', () => {
    renderWithProviders(<ChunkyCheckbox indeterminate aria-label="Select all" />);
    const box = screen.getByRole('checkbox', { name: 'Select all' });
    expect(box).toHaveAttribute('aria-checked', 'mixed');
    expect(box).toHaveAttribute('data-state', 'indeterminate');
  });

  it('calls onCheckedChange with toggled value on click', async () => {
    const handleChange = vi.fn();
    const { user } = renderWithProviders(
      <ChunkyCheckbox aria-label="Select episode" onCheckedChange={handleChange} />
    );
    await user.click(screen.getByRole('checkbox', { name: 'Select episode' }));
    expect(handleChange).toHaveBeenCalledWith(true);
  });

  it('toggles from checked to unchecked on click', async () => {
    const handleChange = vi.fn();
    const { user } = renderWithProviders(
      <ChunkyCheckbox checked aria-label="Select episode" onCheckedChange={handleChange} />
    );
    await user.click(screen.getByRole('checkbox', { name: 'Select episode' }));
    expect(handleChange).toHaveBeenCalledWith(false);
  });

  it('activates via spacebar when focused', async () => {
    const handleChange = vi.fn();
    const { user } = renderWithProviders(
      <ChunkyCheckbox aria-label="Select episode" onCheckedChange={handleChange} />
    );
    const box = screen.getByRole('checkbox', { name: 'Select episode' });
    box.focus();
    expect(box).toHaveFocus();
    await user.keyboard(' ');
    expect(handleChange).toHaveBeenCalledWith(true);
  });

  it('respects disabled state', async () => {
    const handleChange = vi.fn();
    const { user } = renderWithProviders(
      <ChunkyCheckbox disabled aria-label="Select episode" onCheckedChange={handleChange} />
    );
    const box = screen.getByRole('checkbox', { name: 'Select episode' });
    expect(box).toBeDisabled();
    await user.click(box);
    expect(handleChange).not.toHaveBeenCalled();
  });
});
