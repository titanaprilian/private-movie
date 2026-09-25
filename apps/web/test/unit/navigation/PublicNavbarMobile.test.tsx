import { renderWithProviders, screen, waitFor, fireEvent } from '../../utils';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createRouter, createMemoryHistory, RouterProvider } from '@tanstack/react-router';
import { routeTree } from '@/routeTree.gen';
import { setAccessToken } from '@/lib/api';

const mockGenres = [
  { id: 'g-2', name: 'Animation', slug: 'animation', isBigGenre: true, displayOrder: 1 },
  { id: 'g-3', name: 'Korean Drama', slug: 'korean-drama', isBigGenre: true, displayOrder: 2 },
];

describe('PublicNavbar mobile', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    setAccessToken('mock-access-token');
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const url =
        typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
      if (url.includes('/api/genres') || url.includes('/genres')) {
        return new Response(JSON.stringify({ data: mockGenres }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      if (url.includes('/api/series') || url.includes('/series')) {
        if (url.includes('/series/home-feed')) {
          return new Response(JSON.stringify({ data: { hero: null, rows: [] } }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          });
        }
        return new Response(
          JSON.stringify({ data: { series: [], meta: { total: 0, page: 1, limit: 10 } } }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      }
      return new Response(JSON.stringify({ data: [] }), { status: 200 });
    });
  });

  async function renderAt(path: string) {
    const history = createMemoryHistory({ initialEntries: [path] });
    const router = createRouter({ routeTree, history });
    renderWithProviders(<RouterProvider router={router} />);
    await waitFor(() => {
      expect(screen.getByTestId('public-navbar')).toBeInTheDocument();
    });
    await screen.findByTestId('mobile-menu-button');
    return router;
  }

  it('renders mobile menu + search triggers and hides desktop nav/search on small screens via responsive classes', async () => {
    await renderAt('/');
    expect(screen.getByTestId('mobile-menu-button')).toBeInTheDocument();
    expect(screen.getByTestId('mobile-search-button')).toBeInTheDocument();
    expect(screen.getByTestId('desktop-nav')).toHaveClass('hidden', 'md:flex');
    expect(screen.getByTestId('desktop-search')).toHaveClass('hidden', 'md:block');
    expect(screen.getByTestId('mobile-menu-button')).toHaveClass('md:hidden');
    expect(screen.getByTestId('mobile-search-button')).toHaveClass('md:hidden');
  });

  it('opens drawer with Home + Big Genre links and dismisses on link click and close button', async () => {
    const user = { click: async (el: Element) => fireEvent.click(el) };
    await renderAt('/');
    expect(screen.queryByTestId('mobile-drawer')).not.toBeInTheDocument();

    fireEvent.click(screen.getByTestId('mobile-menu-button'));
    const drawer = await screen.findByTestId('mobile-drawer');
    expect(drawer).toBeInTheDocument();
    expect(screen.getByRole('dialog', { name: 'Mobile navigation' })).toBeInTheDocument();

    const mobileNav = screen.getByRole('navigation', { name: 'Mobile Navigation' });
    const { getAllByRole } = await import('@testing-library/react');
    const links = getAllByRole(mobileNav as HTMLElement, 'link');
    expect(links.map((l) => l.textContent)).toEqual(['Home', 'Animation', 'Korean Drama']);

    // Dismiss via close button
    await user.click(screen.getByTestId('mobile-drawer-close'));
    await waitFor(() => {
      expect(screen.queryByTestId('mobile-drawer')).not.toBeInTheDocument();
    });

    // Reopen and dismiss via link selection
    fireEvent.click(screen.getByTestId('mobile-menu-button'));
    await screen.findByTestId('mobile-drawer');
    const nav2 = screen.getByRole('navigation', { name: 'Mobile Navigation' });
    const homeLink = getAllByRole(nav2 as HTMLElement, 'link', { name: 'Home' })[0];
    fireEvent.click(homeLink);
    await waitFor(() => {
      expect(screen.queryByTestId('mobile-drawer')).not.toBeInTheDocument();
    });
  });

  it('dismisses drawer when backdrop overlay is clicked', async () => {
    await renderAt('/');
    fireEvent.click(screen.getByTestId('mobile-menu-button'));
    await screen.findByTestId('mobile-drawer');
    fireEvent.click(screen.getByTestId('mobile-drawer-overlay'));
    await waitFor(() => {
      expect(screen.queryByTestId('mobile-drawer')).not.toBeInTheDocument();
    });
  });

  it('expands mobile search overlay with close action and dismisses it', async () => {
    await renderAt('/');
    expect(screen.queryByTestId('mobile-search-overlay')).not.toBeInTheDocument();

    fireEvent.click(screen.getByTestId('mobile-search-button'));
    const overlay = await screen.findByTestId('mobile-search-overlay');
    expect(overlay).toBeInTheDocument();
    expect(screen.getByTestId('mobile-search-close')).toBeInTheDocument();
    expect(
      overlay.querySelector('input[aria-label="Search series catalog"]')
    ).toBeInTheDocument();

    fireEvent.click(screen.getByTestId('mobile-search-close'));
    await waitFor(() => {
      expect(screen.queryByTestId('mobile-search-overlay')).not.toBeInTheDocument();
    });
    expect(screen.getByTestId('mobile-search-button')).toBeInTheDocument();
  });
});
