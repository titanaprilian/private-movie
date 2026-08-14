import { renderWithProviders, screen } from '../../utils';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { LoginPage } from '@/routes/login';
import { useThemeStore } from '@/store/themeStore';

vi.mock('@tanstack/react-router', () => ({
  createFileRoute: () => (config: unknown) => config,
  useNavigate: () => vi.fn(),
}));

describe('LoginPage route component', () => {
  beforeEach(() => {
    useThemeStore.setState({ theme: 'light' });
  });

  it('renders split screen layout with branding and login form', () => {
    renderWithProviders(<LoginPage />);

    // Left panel branding
    expect(screen.getAllByText('monoRepo').length).toBeGreaterThan(0);
    expect(
      screen.getByText('// monorepo starter, deep modules pattern')
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        /"One workspace. Every app shares the same contracts, the same components, the same rules."/i
      )
    ).toBeInTheDocument();

    // Social links
    expect(screen.getByLabelText('GitHub')).toBeInTheDocument();
    expect(screen.getByLabelText('LinkedIn')).toBeInTheDocument();
    expect(screen.getByLabelText('Instagram')).toBeInTheDocument();

    // Login Form fields
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/password/i)).toBeInTheDocument();
  });

  it('toggles theme when theme button is clicked', async () => {
    const { user } = renderWithProviders(<LoginPage />);

    const themeButton = screen.getByRole('button', { name: /theme/i });
    expect(themeButton).toBeInTheDocument();

    expect(useThemeStore.getState().theme).toBe('light');
    await user.click(themeButton);
    expect(useThemeStore.getState().theme).toBe('dark');
  });
});
