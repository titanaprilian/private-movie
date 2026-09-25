import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, useLocation } from '@tanstack/react-router';
import { genresQueryOptions } from '@/modules/genres';
import { CatalogSearch } from '@/modules/search';
import type { SeriesItem } from '@/modules/videos';

function useCurrentPath() {
  try {
    const location = useLocation();
    return location.pathname;
  } catch {
    return typeof window !== 'undefined' ? window.location.pathname : '/';
  }
}

function SafeLink({
  to,
  params,
  className,
  children,
  onClick,
}: {
  to: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  params?: any;
  className?: string;
  children: React.ReactNode;
  onClick?: () => void;
}) {
  try {
    useLocation();
    if (params && to.includes('$')) {
      return (
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        <Link to={to as any} params={params as any} className={className} onClick={onClick}>
          {children}
        </Link>
      );
    }
    return (
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      <Link to={to as any} className={className} onClick={onClick}>
        {children}
      </Link>
    );
  } catch {
    const href = params
      ? Object.entries(params).reduce((acc: string, [k, v]) => acc.replace(`$${k}`, String(v)), to)
      : to;
    return (
      <a href={href} className={className} onClick={onClick}>
        {children}
      </a>
    );
  }
}

export function PublicNavbar() {
  const { data: genres = [] } = useQuery(genresQueryOptions());
  const pathname = useCurrentPath();

  const [scrolled, setScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 20);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Filter active Big Genres and sort by displayOrder asc
  const bigGenres = genres
    .filter((g) => g.isBigGenre)
    .sort((a, b) => (a.displayOrder ?? 0) - (b.displayOrder ?? 0));

  // Extract genre slug if currently on a genre route (/genres/:slug)
  const genreMatch = pathname.match(/^\/genres\/([^/]+)/);
  const currentGenreSlug = genreMatch ? genreMatch[1] : undefined;

  const handleSelectSeries = (series: SeriesItem) => {
    setMobileSearchOpen(false);
    if (typeof window !== 'undefined') {
      window.location.href = `/watch/${series.id}`;
    }
  };

  const closeMobileMenu = () => setMobileMenuOpen(false);
  const closeMobileSearch = () => setMobileSearchOpen(false);

  const navLinkClass = (isActive: boolean) =>
    `text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-black rounded px-2 py-1 ${
      isActive
        ? 'text-white font-bold border-b-2 border-red-600 pb-0.5'
        : 'text-zinc-400 hover:text-zinc-200'
    }`;

  return (
    <>
      <header
        data-testid="public-navbar"
        className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
          scrolled
            ? 'bg-black/80 backdrop-blur-md border-b border-zinc-800/80 py-3'
            : 'bg-gradient-to-b from-black/90 via-black/50 to-transparent py-4'
        }`}
      >
        {/* Mobile search overlay spans the full header bar */}
        {mobileSearchOpen ? (
          <div
            data-testid="mobile-search-overlay"
            className="max-w-7xl mx-auto px-4 flex items-center gap-2"
          >
            <div className="flex-1 min-w-0">
              <CatalogSearch
                genre={currentGenreSlug}
                onSelectSeries={handleSelectSeries}
                className="w-full"
                autoFocus
              />
            </div>
            <button
              type="button"
              aria-label="Close search"
              data-testid="mobile-search-close"
              onClick={closeMobileSearch}
              className="shrink-0 p-2 rounded text-zinc-300 hover:text-white hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
            >
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>
        ) : (
          <div className="max-w-7xl mx-auto px-6 md:px-12 flex items-center justify-between gap-4">
            <div className="flex items-center gap-6 sm:gap-8 min-w-0">
              <SafeLink
                to="/"
                className="flex items-center gap-2 font-black tracking-wider text-red-600 text-lg sm:text-xl uppercase focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white rounded px-1 shrink-0"
              >
                <span>PRIVATE MOVIE</span>
              </SafeLink>

              <nav
                aria-label="Main Navigation"
                data-testid="desktop-nav"
                className="hidden md:flex items-center gap-4 sm:gap-6"
              >
                <SafeLink to="/" className={navLinkClass(pathname === '/')}>
                  Home
                </SafeLink>

                {bigGenres.map((genre) => {
                  const targetPath = `/genres/${genre.slug}`;
                  const isActive = pathname === targetPath;

                  return (
                    <SafeLink
                      key={genre.id}
                      to="/genres/$slug"
                      params={{ slug: genre.slug }}
                      className={navLinkClass(isActive)}
                    >
                      {genre.name}
                    </SafeLink>
                  );
                })}
              </nav>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              {/* Desktop search — hidden on mobile */}
              <div data-testid="desktop-search" className="hidden md:block">
                <CatalogSearch
                  genre={currentGenreSlug}
                  onSelectSeries={handleSelectSeries}
                  className="w-48 sm:w-64"
                />
              </div>

              {/* Mobile triggers — hidden on desktop */}
              <button
                type="button"
                aria-label="Open search"
                data-testid="mobile-search-button"
                onClick={() => setMobileSearchOpen(true)}
                className="md:hidden p-2 rounded text-zinc-300 hover:text-white hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
              >
                <svg
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <circle cx="11" cy="11" r="8" />
                  <line x1="21" y1="21" x2="16.65" y2="16.65" />
                </svg>
              </button>
              <button
                type="button"
                aria-label="Open menu"
                aria-expanded={mobileMenuOpen}
                data-testid="mobile-menu-button"
                onClick={() => setMobileMenuOpen(true)}
                className="md:hidden p-2 rounded text-zinc-300 hover:text-white hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
              >
                <svg
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <line x1="3" y1="6" x2="21" y2="6" />
                  <line x1="3" y1="12" x2="21" y2="12" />
                  <line x1="3" y1="18" x2="21" y2="18" />
                </svg>
              </button>
            </div>
          </div>
        )}
      </header>

      {/* Mobile drawer */}
      {mobileMenuOpen && (
        <div data-testid="mobile-drawer-backdrop" className="fixed inset-0 z-[60]">
          <div
            aria-hidden="true"
            data-testid="mobile-drawer-overlay"
            onClick={closeMobileMenu}
            className="absolute inset-0 bg-black/60"
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Mobile navigation"
            data-testid="mobile-drawer"
            className="absolute top-0 left-0 bottom-0 w-72 max-w-[80vw] bg-zinc-950 border-r border-zinc-800 p-4 flex flex-col gap-2 overflow-y-auto"
          >
            <div className="flex items-center justify-between mb-2">
              <span className="font-black tracking-wider text-red-600 text-base uppercase">
                Private Movie
              </span>
              <button
                type="button"
                aria-label="Close menu"
                data-testid="mobile-drawer-close"
                onClick={closeMobileMenu}
                className="p-2 rounded text-zinc-300 hover:text-white hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
              >
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>
            <nav aria-label="Mobile Navigation" className="flex flex-col gap-1">
              <SafeLink
                to="/"
                onClick={closeMobileMenu}
                className={`${navLinkClass(pathname === '/')} block px-3 py-2 text-base`}
              >
                Home
              </SafeLink>
              {bigGenres.map((genre) => {
                const targetPath = `/genres/${genre.slug}`;
                const isActive = pathname === targetPath;
                return (
                  <SafeLink
                    key={genre.id}
                    to="/genres/$slug"
                    params={{ slug: genre.slug }}
                    onClick={closeMobileMenu}
                    className={`${navLinkClass(isActive)} block px-3 py-2 text-base`}
                  >
                    {genre.name}
                  </SafeLink>
                );
              })}
            </nav>
          </div>
        </div>
      )}
    </>
  );
}
