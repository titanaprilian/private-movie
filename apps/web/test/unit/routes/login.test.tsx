import { renderWithProviders, screen } from '../../utils';
import { describe, expect, it, vi } from 'vitest';
import { LoginPage } from '@/routes/login';

vi.mock('@tanstack/react-router', () => ({
  createFileRoute: () => (config: unknown) => config,
  useNavigate: () => vi.fn(),
}));

describe('LoginPage route component', () => {
  it('renders chunky viewer login with showcase layout and auth card', () => {
    renderWithProviders(<LoginPage />);

    // Two-column viewer layout: showcase + auth card
    expect(screen.getByTestId('viewer-login-page')).toBeInTheDocument();
    expect(screen.getByTestId('login-showcase')).toBeInTheDocument();
    expect(screen.getByTestId('viewer-login-card')).toBeInTheDocument();

    // Viewer login form fields
    expect(screen.getByLabelText('Email')).toBeInTheDocument();
    expect(screen.getByLabelText('Password')).toBeInTheDocument();

    // Placeholder branding & social links are absent
    expect(screen.queryByText('monoRepo')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('GitHub')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('LinkedIn')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Instagram')).not.toBeInTheDocument();
  });
});
