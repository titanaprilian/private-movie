import { renderWithProviders, screen, waitFor } from '../../utils';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { Shell } from '@/modules/shell';
import { useUIStore } from '@/store/uiStore';

let mockCurrentPath = '/admin';

vi.mock('@tanstack/react-router', () => ({
  Link: ({
    children,
    to,
    className,
    activeProps,
    inactiveProps,
    activeOptions,
    onClick,
    title,
    ...rest
  }: {
    children: React.ReactNode;
    to: string;
    className?: string;
    activeProps?: { className?: string };
    inactiveProps?: { className?: string };
    activeOptions?: { exact?: boolean };
    onClick?: () => void;
    title?: string;
  }) => {
    const isExact = activeOptions?.exact ?? false;
    const isActive = isExact
      ? mockCurrentPath === to
      : mockCurrentPath === to || mockCurrentPath.startsWith(to + '/');

    const dynamicClass = isActive
      ? activeProps?.className ?? className
      : inactiveProps?.className ?? className;

    return (
      <a href={to} className={dynamicClass} onClick={onClick} title={title} {...rest}>
        {children}
      </a>
    );
  },
  useNavigate: () => vi.fn(),
}));

describe('Shell layout component', () => {
  beforeEach(() => {
    mockCurrentPath = '/admin';
    useUIStore.setState({ theme: 'light', sidebarCollapsed: false });
  });

  it('renders children content within Shell layout and displays the full brand logo', () => {
    useUIStore.setState({ theme: 'dark' });
    renderWithProviders(
      <Shell>
        <div data-testid="test-child">Hello Dashboard</div>
      </Shell>
    );

    expect(screen.getByTestId('test-child')).toBeInTheDocument();
    expect(screen.getByText('Hello Dashboard')).toBeInTheDocument();
    const logos = screen.getAllByAltText('Private Movie');
    expect(logos.length).toBeGreaterThan(0);
    expect(logos[0].tagName).toBe('IMG');
    expect(logos[0].getAttribute('src')).toContain('/assets/logo-full.png');
    expect(screen.queryByText('monoRepo')).not.toBeInTheDocument();
    expect(screen.queryByText(/workspace/i)).not.toBeInTheDocument();
    expect(screen.getAllByText('Series').length).toBeGreaterThan(0);
  });

  it('uses the dark logo variants in light mode', async () => {
    useUIStore.setState({ theme: 'light', sidebarCollapsed: false });
    renderWithProviders(
      <Shell>
        <div>Content</div>
      </Shell>
    );

    const sidebar = screen.getByTestId('desktop-sidebar');
    expect(sidebar.querySelector('img[alt="Private Movie"]')?.getAttribute('src')).toContain(
      '/assets/logo-full-dark.png'
    );

    useUIStore.setState({ sidebarCollapsed: true });
    await waitFor(() => {
      expect(
        sidebar.querySelector('img[alt="Private Movie collapsed logo"]')?.getAttribute('src')
      ).toContain('/assets/logo-collapsed-dark.png');
    });
  });

  it('renders primary navigation links and omits deprecated template links', () => {
    renderWithProviders(
      <Shell>
        <div>Content</div>
      </Shell>
    );

    const seriesLinks = screen.getAllByRole('link', { name: /series/i });
    expect(seriesLinks.length).toBeGreaterThan(0);
    expect(seriesLinks[0]).toHaveAttribute('href', '/admin/videos');

    const genresLinks = screen.getAllByRole('link', { name: /genres/i });
    expect(genresLinks.length).toBeGreaterThan(0);
    expect(genresLinks[0]).toHaveAttribute('href', '/admin/genres');

    const storageLinks = screen.getAllByRole('link', { name: /storage/i });
    expect(storageLinks.length).toBeGreaterThan(0);
    expect(storageLinks[0]).toHaveAttribute('href', '/admin/storage');

    expect(screen.queryByText('Analytics')).not.toBeInTheDocument();
    expect(screen.queryByText('Customers')).not.toBeInTheDocument();
    expect(screen.queryByText('Orders')).not.toBeInTheDocument();
    expect(screen.queryByText('Settings')).not.toBeInTheDocument();
  });

  it('dynamically applies active link styling based on route matches', () => {
    // 1. Series route
    mockCurrentPath = '/admin/videos';
    const { unmount } = renderWithProviders(
      <Shell>
        <div>Content</div>
      </Shell>
    );

    const desktopSeriesLink = screen.getAllByRole('link', {
      name: /series/i,
    })[0];
    const desktopGenresLink = screen.getAllByRole('link', {
      name: /genres/i,
    })[0];

    expect(desktopSeriesLink.className).toContain('border-[var(--green)]');
    expect(desktopSeriesLink.className).toContain('text-[var(--green)]');
    expect(desktopGenresLink.className).not.toContain('border-[var(--green)]');
    expect(desktopGenresLink.className).toContain('text-[var(--muted)]');

    unmount();

    // 2. Nested route under series (/admin/videos/series-123)
    mockCurrentPath = '/admin/videos/series-123';
    renderWithProviders(
      <Shell>
        <div>Content</div>
      </Shell>
    );

    const nestedSeriesLink = screen.getAllByRole('link', {
      name: /series/i,
    })[0];
    const nestedGenresLink = screen.getAllByRole('link', {
      name: /genres/i,
    })[0];

    expect(nestedSeriesLink.className).toContain('border-[var(--green)]');
    expect(nestedSeriesLink.className).toContain('text-[var(--green)]');
    expect(nestedGenresLink.className).not.toContain('border-[var(--green)]');
    expect(nestedGenresLink.className).toContain('text-[var(--muted)]');
  });

  it('toggles sidebar collapse state, resizing between 224px and 92px and swapping the logo', async () => {
    useUIStore.setState({ theme: 'dark', sidebarCollapsed: false });
    const { user } = renderWithProviders(
      <Shell>
        <div>Content</div>
      </Shell>
    );

    const toggleBtn = screen.getByRole('button', { name: /toggle sidebar/i });
    const sidebar = screen.getByTestId('desktop-sidebar');
    const desktopLogo = () =>
      sidebar.querySelector('img[alt="Private Movie"], img[alt="Private Movie collapsed logo"]');
    expect(useUIStore.getState().sidebarCollapsed).toBe(false);
    expect(sidebar.className).toContain('w-[224px]');
    expect(desktopLogo()?.getAttribute('src')).toContain('/assets/logo-full.png');
    expect(desktopLogo()?.getAttribute('alt')).toBe('Private Movie');

    await user.click(toggleBtn);
    expect(useUIStore.getState().sidebarCollapsed).toBe(true);
    expect(sidebar.className).toContain('w-[92px]');
    expect(sidebar.className).not.toContain('w-[224px]');
    expect(desktopLogo()?.getAttribute('src')).toContain('/assets/logo-collapsed.png');
    expect(desktopLogo()?.getAttribute('alt')).toBe('Private Movie collapsed logo');

    // Collapsed nav items render icon-only with title tooltips
    const collapsedSeriesLink = screen.getAllByRole('link', { name: /series/i })[0];
    expect(collapsedSeriesLink).toHaveAttribute('title', 'Series');

    await user.click(toggleBtn);
    expect(useUIStore.getState().sidebarCollapsed).toBe(false);
    expect(sidebar.className).toContain('w-[224px]');
    expect(desktopLogo()?.getAttribute('src')).toContain('/assets/logo-full.png');
  });

  it('renders anonymous user profile avatar in the sidebar and omits external pravatar placeholder', () => {
    renderWithProviders(
      <Shell>
        <div>Content</div>
      </Shell>
    );

    const avatars = screen.getAllByLabelText('User avatar');
    expect(avatars.length).toBeGreaterThan(0);
    expect(screen.queryByRole('img', { name: /user avatar/i })).not.toBeInTheDocument();
    expect(
      screen.getAllByText(/user@email.com|User Name/).length
    ).toBeGreaterThan(0);
  });

  it('highlights the profile card with a green border on the /admin/profile route', () => {
    useUIStore.setState({ theme: 'dark', sidebarCollapsed: false });

    mockCurrentPath = '/admin/videos';
    const { unmount } = renderWithProviders(
      <Shell>
        <div>Content</div>
      </Shell>
    );
    // Desktop sidebar renders first; the mobile slide-over duplicates the card.
    const inactiveProfileLink = screen.getAllByRole('link', { name: /user name/i })[0];
    expect(inactiveProfileLink).toHaveAttribute('href', '/admin/profile');
    expect(inactiveProfileLink.className).toContain('border-[var(--border)]');
    expect(inactiveProfileLink.className).not.toContain('border-[var(--green)]');
    unmount();

    mockCurrentPath = '/admin/profile';
    renderWithProviders(
      <Shell>
        <div>Content</div>
      </Shell>
    );
    const profileLink = screen.getAllByRole('link', { name: /user name/i })[0];
    expect(profileLink).toHaveAttribute('href', '/admin/profile');
    expect(profileLink.className).toContain('border-[var(--green)]');
    expect(profileLink.className).toContain('bg-[var(--green-soft)]');
  });

  it('renders an 80px navbar with chunky buttons and no search bar', () => {
    renderWithProviders(
      <Shell>
        <div>Content</div>
      </Shell>
    );

    const header = screen.getByRole('banner');
    expect(header.className).toContain('h-20');

    expect(screen.queryByPlaceholderText(/search/i)).not.toBeInTheDocument();
    expect(screen.queryByRole('searchbox')).not.toBeInTheDocument();

    const notificationsBtn = screen.getByRole('button', { name: 'Notifications' });
    expect(notificationsBtn.className).toContain('border-b-4');
    expect(screen.getByLabelText('3 unread notifications')).toBeInTheDocument();

    expect(screen.getByRole('button', { name: 'Toggle theme' })).toBeInTheDocument();
    const logoutBtn = screen.getByRole('button', { name: 'Logout' });
    expect(logoutBtn.className).toContain('border-b-4');
  });

  it('toggles theme when theme button in header is clicked', async () => {
    const { user } = renderWithProviders(
      <Shell>
        <div>Content</div>
      </Shell>
    );

    const themeButton = screen.getByRole('button', { name: /toggle theme/i });
    expect(useUIStore.getState().theme).toBe('light');

    await user.click(themeButton);
    expect(useUIStore.getState().theme).toBe('dark');

    await user.click(themeButton);
    expect(useUIStore.getState().theme).toBe('light');
  });

  it('toggles mobile slideover when hamburger button is clicked and closes on overlay click', async () => {
    const { user } = renderWithProviders(
      <Shell>
        <div>Content</div>
      </Shell>
    );

    const overlay = screen.getByTestId('mobile-overlay');
    expect(overlay.className).toContain('opacity-0');
    expect(overlay.className).toContain('pointer-events-none');
    const mobileSidebar = screen.getByTestId('mobile-sidebar');
    expect(mobileSidebar.className).toContain('-translate-x-full');
    expect(mobileSidebar.className).toContain('transition-transform');
    expect(mobileSidebar.className).toContain('duration-300');
    expect(mobileSidebar).toHaveAttribute('role', 'dialog');
    expect(mobileSidebar).toHaveAttribute('aria-modal', 'true');
    expect(mobileSidebar).toHaveAttribute('aria-label', 'Admin navigation');

    const openMenuBtn = screen.getByRole('button', { name: /open menu/i });
    await user.click(openMenuBtn);

    const closeMenuBtn = screen.getByRole('button', { name: /close menu/i });
    expect(closeMenuBtn).toBeInTheDocument();
    expect(overlay.className).toContain('opacity-100');
    expect(overlay.className).toContain('pointer-events-auto');
    expect(mobileSidebar.className).toContain('translate-x-0');

    await user.click(overlay);
    expect(overlay.className).toContain('opacity-0');
    expect(overlay.className).toContain('pointer-events-none');
    expect(mobileSidebar.className).toContain('-translate-x-full');
  });
});
