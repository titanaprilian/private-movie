import { useState, useRef, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, useLocation } from '@tanstack/react-router';
import { genresQueryOptions } from '@/modules/genres';
import { CatalogSearch } from '@/modules/search';
import type { SeriesItem } from '@/modules/videos';
import { useUIStore } from '@/store/uiStore';

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
  ariaLabel,
}: {
  to: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  params?: any;
  className?: string;
  children: React.ReactNode;
  onClick?: () => void;
  ariaLabel?: string;
}) {
  try {
    useLocation();
    if (params && to.includes('$')) {
      return (
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        <Link to={to as any} params={params as any} className={className} onClick={onClick} aria-label={ariaLabel}>
          {children}
        </Link>
      );
    }
    return (
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      <Link to={to as any} className={className} onClick={onClick} aria-label={ariaLabel}>
        {children}
      </Link>
    );
  } catch {
    const href = params
      ? Object.entries(params).reduce((acc: string, [k, v]) => acc.replace(`$${k}`, String(v)), to)
      : to;
    return (
      <a href={href} className={className} onClick={onClick} aria-label={ariaLabel}>
        {children}
      </a>
    );
  }
}

export function PublicNavbar() {
  const { data: genres = [] } = useQuery(genresQueryOptions());
  const pathname = useCurrentPath();

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);

  // Dark logo variant keeps the wordmark readable on light backgrounds.
  const theme = useUIStore((s) => s.theme);
  const brandLogoSrc =
    theme === 'light' ? '/assets/logo-full-dark.png' : '/assets/logo-full.png';

  const searchContainerRef = useRef<HTMLDivElement>(null);
  const searchToggleRef = useRef<HTMLButtonElement>(null);

  // Close search on outside click / tap and on Escape key
  useEffect(() => {
    if (!searchOpen) return;

    const handlePointerDown = (event: PointerEvent | MouseEvent | TouchEvent) => {
      const target = event.target as Node | null;
      if (!target) return;

      const clickedInsideContainer = searchContainerRef.current?.contains(target);
      const clickedToggle = searchToggleRef.current?.contains(target);

      if (!clickedInsideContainer && !clickedToggle) {
        setSearchOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setSearchOpen(false);
        searchToggleRef.current?.focus();
      }
    };

    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [searchOpen]);

  // Filter active Big Genres and sort by displayOrder asc
  const bigGenres = genres
    .filter((g) => g.isBigGenre)
    .sort((a, b) => (a.displayOrder ?? 0) - (b.displayOrder ?? 0));

  // Extract genre slug if currently on a genre route (/genres/:slug)
  const genreMatch = pathname.match(/^\/genres\/([^/]+)/);
  const currentGenreSlug = genreMatch ? genreMatch[1] : undefined;

  const handleSelectSeries = (series: SeriesItem) => {
    setSearchOpen(false);
    setMobileMenuOpen(false);
    if (typeof window !== 'undefined') {
      window.location.href = `/watch/${series.id}`;
    }
  };

  const closeMobileMenu = () => setMobileMenuOpen(false);
  const closeSearch = () => setSearchOpen(false);

  const navLinkClass = (isActive: boolean) =>
    `rounded-full px-4 py-2 font-extrabold text-sm font-sans transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--blue)] ${
      isActive
        ? 'bg-[#1cb0f6]/15 text-[#1cb0f6]'
        : 'text-[var(--muted)] hover:text-[var(--ink)] hover:bg-[var(--surface-raised)]'
    }`;

  return (
    <>
      <header
        data-testid="public-navbar"
        className="sticky top-0 z-50 h-[76px] border-b-2 border-[var(--border)] bg-[var(--bg)]/90 backdrop-blur-md"
      >
        <div className="w-full px-8 md:px-16 h-full flex items-center justify-between gap-4">
          <div className="flex items-center gap-6 sm:gap-8 min-w-0">
            <SafeLink
              to="/"
              className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--blue)] rounded-full px-1 shrink-0"
              ariaLabel="Private Movie home"
            >
              <img src={brandLogoSrc} alt="Private Movie" className="h-10 w-auto" />
            </SafeLink>

            <nav
              aria-label="Main Navigation"
              data-testid="desktop-nav"
              className="hidden md:flex items-center gap-2"
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
            {/* Unified circular search toggle (desktop + mobile) */}
            <button
              ref={searchToggleRef}
              type="button"
              aria-label={searchOpen ? 'Close search' : 'Open search'}
              aria-expanded={searchOpen}
              data-testid="search-toggle"
              onClick={() => setSearchOpen((v) => !v)}
              className="w-11 h-11 rounded-full border-2 border-[var(--border)] bg-[var(--surface)] text-[var(--ink)] flex items-center justify-center font-extrabold shadow-[0_5px_0_var(--border)] active:translate-y-1 active:shadow-[0_1px_0_var(--border)] hover:bg-[var(--yellow)] hover:border-[var(--yellow-dark)] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--blue)]"
            >
              {searchOpen ? (
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
              ) : (
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
              )}
            </button>
            {/* Mobile menu trigger */}
            <button
              type="button"
              aria-label="Open menu"
              aria-expanded={mobileMenuOpen}
              data-testid="mobile-menu-button"
              onClick={() => setMobileMenuOpen(true)}
              className="md:hidden w-11 h-11 rounded-full border-2 border-[var(--border)] bg-[var(--surface)] text-[var(--ink)] flex items-center justify-center shadow-[0_5px_0_var(--border)] active:translate-y-1 active:shadow-[0_1px_0_var(--border)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--blue)]"
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

        {/* Search popover dialog card */}
        {searchOpen && (
          <div ref={searchContainerRef} className="absolute top-[76px] left-0 right-0 z-50 px-8 md:px-16">
            <div
              role="dialog"
              aria-label="Catalog search"
              data-testid="search-popover"
              className="w-full rounded-2xl border-2 border-[var(--border)] bg-[var(--surface)] p-4 shadow-2xl"
            >
              <CatalogSearch
                genre={currentGenreSlug}
                onSelectSeries={handleSelectSeries}
                className="w-full max-w-none"
                autoFocus
              />
              <button
                type="button"
                aria-label="Close search"
                data-testid="search-popover-close"
                onClick={closeSearch}
                className="sr-only"
              >
                Close search
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
            className="absolute top-4 left-4 bottom-4 w-72 max-w-[80vw] rounded-2xl border-2 border-[var(--border)] bg-[var(--surface)] p-4 flex flex-col gap-2 overflow-y-auto shadow-2xl"
          >
            <div className="flex items-center justify-between mb-2">
              <img src={brandLogoSrc} alt="Private Movie" className="h-9 w-auto" />
              <button
                type="button"
                aria-label="Close menu"
                data-testid="mobile-drawer-close"
                onClick={closeMobileMenu}
                className="w-11 h-11 rounded-full border-2 border-[var(--border)] bg-[var(--bg)] text-[var(--ink)] flex items-center justify-center shadow-[0_5px_0_var(--border)] active:translate-y-1 active:shadow-[0_1px_0_var(--border)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--blue)]"
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
            <nav aria-label="Mobile Navigation" className="flex flex-col gap-2">
              <SafeLink
                to="/"
                onClick={closeMobileMenu}
                className={`${navLinkClass(pathname === '/')} block px-4 py-2 text-base`}
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
                    className={`${navLinkClass(isActive)} block px-4 py-2 text-base`}
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
