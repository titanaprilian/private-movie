import { Label } from '@/components/ui/label';
import { renderWithProviders, screen } from '../../utils';
import { describe, expect, it } from 'vitest';

describe('Label component', () => {
  it('renders label text content correctly', () => {
    renderWithProviders(<Label htmlFor="email-input">Email address</Label>);
    const label = screen.getByText('Email address');
    expect(label).toBeInTheDocument();
    expect(label).toHaveAttribute('for', 'email-input');
  });

  it('applies custom classes when passed', () => {
    renderWithProviders(<Label className="mono uppercase">Password</Label>);
    const label = screen.getByText('Password');
    expect(label).toHaveClass('mono');
    expect(label).toHaveClass('uppercase');
  });
});
