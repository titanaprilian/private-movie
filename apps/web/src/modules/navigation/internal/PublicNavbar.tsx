import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, useLocation } from '@tanstack/react-router';
import { genresQueryOptions } from '@/modules/genres';

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
}: {
  to: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  params?: any;
  className?: string;
  children: React.ReactNode;
}) {
  try {
    useLocation();
    if (params && to.includes('$')) {
      return (
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        <Link to={to as any} params={params as any} className={className}>
          {children}
        </Link>
      );
    }
    return (
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      <Link to={to as any} className={className}>
        {children}
      </Link>
    );
  } catch {
    const href = params
      ? Object.entries(params).reduce((acc: string, [k, v]) => acc.replace(`$${k}`, String(v)), to)
      : to;
    return (
      <a href={href} className={className}>
        {children}
      </a>
    );
  }
}

export function PublicNavbar() {
  const { data: genres = [] } = useQuery(genresQueryOptions());
  const pathname = useCurrentPath();

  const [scrolled, setScrolled] = useState(false);

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

  return (
    <header
      data-testid="public-navbar"
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        scrolled
          ? 'bg-black/80 backdrop-blur-md border-b border-zinc-800/80 py-3'
          : 'bg-gradient-to-b from-black/90 via-black/50 to-transparent py-4'
      }`}
    >
      <div className="max-w-7xl mx-auto px-6 md:px-12 flex items-center justify-between">
        <SafeLink
          to="/"
          className="flex items-center gap-2 font-black tracking-wider text-red-600 text-lg sm:text-xl uppercase focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white rounded px-1"
        >
          <span>PRIVATE MOVIE</span>
        </SafeLink>

        <nav aria-label="Main Navigation" className="flex items-center gap-4 sm:gap-6">
          <SafeLink
            to="/"
            className={`text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-black rounded px-2 py-1 ${
              pathname === '/'
                ? 'text-white font-bold border-b-2 border-red-600 pb-0.5'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
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
                className={`text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-black rounded px-2 py-1 ${
                  isActive
                    ? 'text-white font-bold border-b-2 border-red-600 pb-0.5'
                    : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                {genre.name}
              </SafeLink>
            );
          })}
        </nav>
      </div>
    </header>
  );
}

