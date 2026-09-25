import { renderWithProviders, screen, waitFor, fireEvent, within } from '../../utils';
import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest';
import { CinematicHome } from '@/modules/home';
import { setAccessToken } from '@/lib/api';

const mockHeroWithLogo = {
  hero: {
    id: 'hero-aot',
    title: 'Attack on Titan: The Final Season',
    description: 'The truth outside the walls.',
    type: 'tv',
    posterUrl: 'https://example.com/poster.jpg',
    backdropUrl: 'https://example.com/banner.jpg',
    logoUrl: 'https://example.com/logo.png',
    rating: '8.5',
    tmdbId: 101,
    tmdbSyncStatus: 'SYNCED',
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-01'),
    genres: [{ id: 'g-1', name: 'Action', slug: 'action' }],
    tags: ['Dark Fantasy', 'Action', 'Adventure', 'Comedy'],
    seasonsCount: 1,
    episodesCount: 12,
  },
  rows: [{ title: 'Trending Now', items: [] }],
};

const mockHeroWithoutLogo = {
  hero: { ...mockHeroWithLogo.hero, logoUrl: null },
  rows: [{ title: 'Trending Now', items: [] }],
};

const mockMultiHero = {
  heroes: [
    mockHeroWithLogo.hero,
    {
      ...mockHeroWithLogo.hero,
      id: 'hero-jjk',
      title: 'Jujutsu Kaisen Season 2',
      posterUrl: 'https://example.com/jjk-poster.jpg',
      backdropUrl: 'https://example.com/jjk-banner.jpg',
      logoUrl: null,
    },
    {
      ...mockHeroWithLogo.hero,
      id: 'hero-frieren',
      title: "Frieren: Beyond Journey's End",
      posterUrl: 'https://example.com/frieren-poster.jpg',
      backdropUrl: 'https://example.com/frieren-banner.jpg',
      logoUrl: null,
    },
  ],
  rows: [{ title: 'Trending Now', items: [] }],
};

function mockFetch(data: unknown) {
  vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
    const url =
      typeof input === 'string'
        ? input
        : input instanceof URL
          ? input.toString()
          : (input as Request).url;
    if (url.includes('/auth/refresh')) {
      return new Response(
        JSON.stringify({ data: { tokens: { accessToken: 'mock-token' } } }),
        { status: 200 },
      );
    }
    if (url.includes('/series/home-feed')) {
      return new Response(JSON.stringify({ data }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    return new Response(JSON.stringify({ data: null }), { status: 200 });
  });
}

async function renderHero(data: unknown) {
  mockFetch(data);
  renderWithProviders(<CinematicHome />);
  await waitFor(() => {
    expect(screen.getByTestId('hero-slider')).toBeInTheDocument();
  });
}

describe('CinematicHome mobile-optimized hero', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    setAccessToken('mock-access-token');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders portrait poster full-bleed on mobile and wide banner on desktop with crossfade', async () => {    await renderHero(mockHeroWithoutLogo);

    const mobileBgs = screen.getAllByTestId('hero-bg-mobile');
    const desktopBgs = screen.getAllByTestId('hero-bg-desktop');
    expect(mobileBgs.length).toBeGreaterThan(0);
    expect(desktopBgs.length).toBeGreaterThan(0);

    const mobileBg = mobileBgs[0];
    expect(mobileBg).toHaveClass('md:hidden');
    expect(mobileBg.getAttribute('style')).toContain('https://example.com/poster.jpg');
    expect(mobileBg.className).toMatch(/transition-opacity duration-1000/);

    const desktopBg = desktopBgs[0];
    expect(desktopBg).toHaveClass('hidden', 'md:block');
    expect(desktopBg.getAttribute('style')).toContain('https://example.com/banner.jpg');
    expect(desktopBg.className).toMatch(/transition-opacity duration-1000/);

    // Active slide is opaque
    expect(mobileBg).toHaveClass('opacity-100');
  });

  it('fills the full mobile viewport height while keeping the desktop banner height', async () => {
    await renderHero(mockHeroWithoutLogo);

    const slider = screen.getByTestId('hero-slider');
    expect(slider).toHaveClass('h-[100dvh]', 'md:h-[85vh]');
  });

  it('uses a bottom-up gradient on mobile and restricts the left-originating overlay to desktop', async () => {
    await renderHero(mockHeroWithoutLogo);

    // No full-image dim layer: upper/left of the image stays visible on mobile
    expect(screen.queryByTestId('hero-gradient-dim')).not.toBeInTheDocument();

    const bottom = screen.getByTestId('hero-gradient-bottom');
    expect(bottom.className).toMatch(/bg-gradient-to-t/);
    // solid black across the bottom half, fading out toward the top
    expect(bottom.className).toContain('via-black');
    expect(bottom.className).toContain('via-[45%]');
    // desktop uses slightly lighter stops
    expect(bottom.className).toContain('md:via-black/60');
    expect(bottom.className).toContain('md:from-black/90');
    expect(bottom.className).not.toMatch(/hidden/);

    const left = screen.getByTestId('hero-gradient-left');
    expect(left.className).toMatch(/bg-gradient-to-r/);
    expect(left).toHaveClass('hidden', 'md:block');
  });

  it('renders logo image when logoUrl is present and falls back to title text when absent', async () => {
    await renderHero(mockHeroWithLogo);

    const logo = screen.getByTestId('hero-logo');
    expect(logo).toBeInTheDocument();
    expect(logo.getAttribute('src')).toBe('https://example.com/logo.png');
    expect(logo.getAttribute('alt')).toMatch(/Attack on Titan/i);
    expect(screen.queryByTestId('hero-title-text')).not.toBeInTheDocument();
  });

  it('falls back to title text when the logo image fails to load', async () => {
    await renderHero(mockHeroWithLogo);

    fireEvent.error(screen.getByTestId('hero-logo'));

    await waitFor(() => {
      expect(screen.getByTestId('hero-title-text')).toBeInTheDocument();
    });
    expect(screen.getByTestId('hero-title-text')).toHaveTextContent(
      'Attack on Titan: The Final Season',
    );
    expect(screen.queryByTestId('hero-logo')).not.toBeInTheDocument();
  });

  it('renders title text directly when logoUrl is absent', async () => {
    await renderHero(mockHeroWithoutLogo);

    expect(screen.queryByTestId('hero-logo')).not.toBeInTheDocument();
    expect(screen.getByTestId('hero-title-text')).toHaveTextContent(
      'Attack on Titan: The Final Season',
    );
    expect(
      screen.getByRole('heading', { level: 1, name: /Attack on Titan/i }),
    ).toBeInTheDocument();
  });

  it('shows season/episode counts without match percentage or sub/dub indicators', async () => {
    await renderHero(mockHeroWithoutLogo);

    const meta = screen.getByTestId('hero-meta');
    expect(meta).toBeInTheDocument();
    expect(screen.getByTestId('hero-seasons-episodes')).toHaveTextContent('1 Season 12 Episodes');
    expect(meta.textContent).not.toMatch(/%.*[Mm]atch/);
    expect(meta.textContent).not.toMatch(/SUB/);
    expect(meta.textContent).not.toMatch(/DUB/);
  });

  it('renders rating as unboxed yellow star text', async () => {
    await renderHero(mockHeroWithoutLogo);

    const rating = screen.getByTestId('hero-rating');
    expect(rating).toHaveTextContent('8.5');
    expect(rating).toHaveClass('text-yellow-400');
    expect(rating.className).not.toMatch(/bg-/);
    expect(rating.className).not.toMatch(/border/);
  });

  it('hides synopsis on mobile and shows truncated overview on desktop', async () => {
    await renderHero(mockHeroWithoutLogo);

    const synopsis = screen.getByTestId('hero-synopsis');
    expect(synopsis).toHaveTextContent(/truth outside the walls/i);
    expect(synopsis).toHaveClass('hidden', 'md:line-clamp-3');
    // md:block would override line-clamp's display:-webkit-box and disable truncation
    expect(synopsis.className).not.toMatch(/(^|\s)md:block($|\s)/);
  });

  it('expands the Play button full width on mobile with standard width on desktop', async () => {
    await renderHero(mockHeroWithoutLogo);

    const play = screen.getByTestId('hero-play');
    expect(play).toHaveClass('w-full', 'md:w-auto');
  });

  it('centers logo and info below it on mobile, left-aligned on desktop', async () => {
    await renderHero(mockHeroWithLogo);

    const content = screen.getByTestId('hero-content');
    expect(content).toHaveClass('items-center', 'text-center', 'md:items-start', 'md:text-left');

    const logo = screen.getByTestId('hero-logo');
    expect(logo.className).toMatch(/mx-auto/);
  });

  it('renders genres inline in the metadata row as plain dot-separated text', async () => {
    await renderHero(mockHeroWithLogo);

    const meta = screen.getByTestId('hero-meta');
    const genres = screen.getByTestId('hero-genres');
    expect(meta).toContainElement(genres);
    // Genre text shares the metadata row's text style
    expect(genres).toHaveClass('text-sm', 'text-zinc-300');
    expect(genres.className).not.toMatch(/font-mono/);
    expect(genres.textContent).toMatch(/Dark Fantasy/);
    expect(genres.textContent).toMatch(/Action/);
    expect(genres.textContent).toMatch(/•/);
    expect(genres.className).not.toMatch(/bg-/);
    expect(genres.className).not.toMatch(/border/);
    for (const child of Array.from(genres.querySelectorAll('span'))) {
      expect(child.className).not.toMatch(/bg-/);
      expect(child.className).not.toMatch(/border/);
      expect(child.className).not.toMatch(/rounded/);
    }
  });

  it('orders rating first and shows only the top 3 genres', async () => {
    await renderHero(mockHeroWithLogo);

    const metaText = screen.getByTestId('hero-meta').textContent ?? '';
    expect(metaText.indexOf('8.5')).toBeLessThan(metaText.indexOf('2026'));
    expect(metaText.indexOf('2026')).toBeLessThan(metaText.indexOf('1 Season'));

    const genres = screen.getByTestId('hero-genres');
    expect(genres.textContent).toMatch(/Dark Fantasy/);
    expect(genres.textContent).toMatch(/Action/);
    expect(genres.textContent).toMatch(/Adventure/);
    expect(genres.textContent).not.toMatch(/Comedy/);
  });

  it('hides the episode count on mobile and shows it on desktop', async () => {
    await renderHero(mockHeroWithoutLogo);

    const episodes = screen.getByTestId('hero-episodes');
    expect(episodes).toHaveTextContent('12 Episodes');
    expect(episodes).toHaveClass('hidden', 'md:inline');
    // Season count stays visible on all viewports
    expect(screen.getByTestId('hero-seasons-episodes').textContent).toMatch(/1 Season/);
  });

  it('renders mobile pagination dots in-flow above the Play button', async () => {
    await renderHero(mockMultiHero);

    const mobilePag = screen.getByTestId('hero-pagination-mobile');
    expect(mobilePag).toHaveClass('md:hidden');

    const dots = within(mobilePag).getAllByRole('button', { name: /go to slide/i });
    expect(dots).toHaveLength(3);

    // Dots sit above the Play button in layout order with spacing between them
    const play = screen.getByTestId('hero-play');
    expect(mobilePag.compareDocumentPosition(play)).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING,
    );
  });

  it('keeps desktop pagination in the bottom-right corner, hidden on mobile', async () => {
    await renderHero(mockMultiHero);

    const desktopPag = screen.getByTestId('hero-pagination-desktop');
    expect(desktopPag).toHaveClass('hidden', 'md:flex');
    expect(desktopPag.className).toMatch(/absolute/);
    expect(desktopPag.className).toMatch(/bottom-6/);

    const dots = within(desktopPag).getAllByRole('button', { name: /go to slide/i });
    expect(dots).toHaveLength(3);
  });

  it('jumps slides when tapping a mobile pagination dot', async () => {
    await renderHero(mockMultiHero);

    const mobilePag = screen.getByTestId('hero-pagination-mobile');
    const dots = within(mobilePag).getAllByRole('button', { name: /go to slide/i });

    fireEvent.click(dots[1]);

    await waitFor(() => {
      expect(
        screen.getByRole('heading', { level: 1, name: /Jujutsu Kaisen/i }),
      ).toBeInTheDocument();
    });
  });
});
