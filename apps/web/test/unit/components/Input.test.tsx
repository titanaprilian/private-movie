import { Input } from '@/components/ui/input';
import { renderWithProviders, screen } from '../../utils';
import { describe, expect, it, vi } from 'vitest';

describe('Input component', () => {
  it('renders input with correct type and placeholder', () => {
    renderWithProviders(<Input type="email" placeholder="you@company.com" />);
    const input = screen.getByPlaceholderText('you@company.com');
    expect(input).toBeInTheDocument();
    expect(input).toHaveAttribute('type', 'email');
  });

  it('applies design token classes including focus ring', () => {
    renderWithProviders(<Input placeholder="test" />);
    const input = screen.getByPlaceholderText('test');
    expect(input).toHaveClass('border-c');
    expect(input).toHaveClass('bg-transparent');
    expect(input).toHaveClass('focus-visible:ring-[var(--primary)]');
  });

  it('handles user input typing', async () => {
    const handleChange = vi.fn();
    const { user } = renderWithProviders(
      <Input placeholder="type here" onChange={handleChange} />
    );

    const input = screen.getByPlaceholderText('type here');
    await user.type(input, 'hello@example.com');

    expect(input).toHaveValue('hello@example.com');
    expect(handleChange).toHaveBeenCalled();
  });

  it('supports disabled state', () => {
    renderWithProviders(<Input placeholder="disabled" disabled />);
    const input = screen.getByPlaceholderText('disabled');
    expect(input).toBeDisabled();
  });
});
