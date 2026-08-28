import { renderWithProviders, screen } from '../../utils';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { ProfilePage } from '@/routes/admin/profile';
import { useAuthStore } from '@/modules/auth';

vi.mock('@tanstack/react-router', () => ({
  createFileRoute: () => (config: unknown) => config,
  useNavigate: () => vi.fn(),
}));

describe('ProfilePage route component', () => {
  beforeEach(() => {
    useAuthStore.setState({
      user: {
        id: '1',
        email: 'test@example.com',
        name: 'Test User',
        createdAt: new Date('2025-01-01T12:00:00.000Z'),
      },
      isAuthenticated: true,
      isLoading: false,
      error: null,
    });
  });

  it('renders the ProfileView component inside route', () => {
    renderWithProviders(<ProfilePage />);

    expect(screen.getByText('Profile')).toBeInTheDocument();
    expect(screen.getByText('Test User')).toBeInTheDocument();
  });
});
