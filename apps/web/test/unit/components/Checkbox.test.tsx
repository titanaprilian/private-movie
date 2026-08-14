import { Checkbox } from '@/components/ui/checkbox';
import { renderWithProviders, screen } from '../../utils';
import { describe, expect, it, vi } from 'vitest';

describe('Checkbox component', () => {
  it('renders checkbox input', () => {
    renderWithProviders(<Checkbox aria-label="Remember this device" />);
    const checkbox = screen.getByRole('checkbox', {
      name: 'Remember this device',
    });
    expect(checkbox).toBeInTheDocument();
  });

  it('applies design token classes including focus ring', () => {
    renderWithProviders(<Checkbox aria-label="Test checkbox" />);
    const checkbox = screen.getByRole('checkbox', { name: 'Test checkbox' });
    expect(checkbox).toHaveClass('border-c');
    expect(checkbox).toHaveClass('focus-visible:ring-[var(--primary)]');
  });

  it('toggles checked state when clicked', async () => {
    const handleCheckedChange = vi.fn();
    const { user } = renderWithProviders(
      <Checkbox
        aria-label="Toggle test"
        onCheckedChange={handleCheckedChange}
      />
    );

    const checkbox = screen.getByRole('checkbox', { name: 'Toggle test' });
    expect(checkbox).not.toBeChecked();

    await user.click(checkbox);
    expect(checkbox).toBeChecked();
    expect(handleCheckedChange).toHaveBeenCalledWith(true);

    await user.click(checkbox);
    expect(checkbox).not.toBeChecked();
    expect(handleCheckedChange).toHaveBeenCalledWith(false);
  });

  it('supports disabled state', async () => {
    const handleCheckedChange = vi.fn();
    const { user } = renderWithProviders(
      <Checkbox
        aria-label="Disabled checkbox"
        disabled
        onCheckedChange={handleCheckedChange}
      />
    );

    const checkbox = screen.getByRole('checkbox', {
      name: 'Disabled checkbox',
    });
    expect(checkbox).toBeDisabled();

    await user.click(checkbox);
    expect(checkbox).not.toBeChecked();
    expect(handleCheckedChange).not.toHaveBeenCalled();
  });
});
