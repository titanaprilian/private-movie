import { renderWithProviders, screen } from '../../utils';
import { describe, expect, it, vi } from 'vitest';
import { LoginPage } from '@/routes/login';

vi.mock('@tanstack/react-router', () => ({
  createFileRoute: () => (config: unknown) => config,
  useNavigate: () => vi.fn(),
}));

describe('LoginPage route component', () => {
  it('renders centered authentication card with login form', () => {
    renderWithProviders(<LoginPage />);

    // Login Form fields
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/password/i)).toBeInTheDocument();

    // Placeholder branding & social links are absent
    expect(screen.queryByText('monoRepo')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('GitHub')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('LinkedIn')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Instagram')).not.toBeInTheDocument();
  });
});
