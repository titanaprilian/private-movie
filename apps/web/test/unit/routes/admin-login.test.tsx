import { renderWithProviders, screen } from '../../utils';
import { describe, expect, it, vi } from 'vitest';
import { AdminLoginPageRoute } from '@/routes/admin.login';

vi.mock('@tanstack/react-router', () => ({
  createFileRoute: () => (config: unknown) => config,
  useNavigate: () => vi.fn(),
}));

describe('AdminLoginPageRoute (/admin/login)', () => {
  it('renders the purple gatekeeper split layout with the admin form', () => {
    renderWithProviders(<AdminLoginPageRoute />);

    expect(screen.getByTestId('admin-login-page')).toBeInTheDocument();
    expect(screen.getByTestId('admin-login-showcase')).toBeInTheDocument();
    expect(screen.getByTestId('admin-login-card')).toBeInTheDocument();
    expect(screen.getByText('Admin console')).toBeInTheDocument();
    expect(screen.getByLabelText('Admin identity')).toBeInTheDocument();
    expect(screen.getByLabelText('Password')).toBeInTheDocument();
  });
});
