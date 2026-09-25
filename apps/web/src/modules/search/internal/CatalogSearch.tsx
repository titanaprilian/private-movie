import { useState, useRef, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import type { SeriesItem } from '@/modules/videos';
import { useDebounce } from './useDebounce';
import { seriesSearchQueryOptions } from './api';

export interface CatalogSearchProps {
  placeholder?: string;
  genre?: string;
  limit?: number;
  onSelectSeries?: (series: SeriesItem) => void;
  className?: string;
  autoFocus?: boolean;
}

export function CatalogSearch({
  placeholder = 'Search series...',
  genre,
  limit = 5,
  onSelectSeries,
  className = '',
  autoFocus = false,
}: CatalogSearchProps) {
  const [query, setQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const debouncedQuery = useDebounce(query, 300);

  const { data, isLoading } = useQuery(
    seriesSearchQueryOptions(debouncedQuery, genre, limit)
  );

  const seriesList = data?.series ?? [];
  const isDebouncing = query.trim() !== debouncedQuery.trim();
  const isSearching = isDebouncing || (isLoading && seriesList.length === 0);
  const showDropdown = isOpen && query.trim().length > 0;

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  const handleClear = () => {
    setQuery('');
    setIsOpen(false);
  };

  const handleSelect = (item: SeriesItem) => {
    setIsOpen(false);
    if (onSelectSeries) {
      onSelectSeries(item);
    }
  };

  return (
    <div ref={containerRef} className={`relative w-full max-w-md ${className}`}>
      {/* Search Input Bar */}
      <div className="relative flex items-center">
        {/* Search Icon */}
        <div className="absolute left-3 pointer-events-none text-muted">
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
        </div>

        <input
          type="text"
          value={query}
          autoFocus={autoFocus}
          onChange={(e) => {
            setQuery(e.target.value);
            setIsOpen(true);
          }}
          onFocus={() => setIsOpen(true)}
          placeholder={placeholder}
          aria-label="Search series catalog"
          className="w-full pl-9 pr-8 py-1.5 rounded border border-c bg-card text-xs mono text-foreground placeholder:text-muted focus:outline-none focus:border-primary transition-colors"
        />

        {/* Clear Button (X) */}
        {query.length > 0 && (
          <button
            type="button"
            onClick={handleClear}
            aria-label="Clear search"
            className="absolute right-2.5 p-0.5 rounded text-muted hover:text-foreground cursor-pointer transition-colors"
          >
            <svg
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        )}
      </div>

      {/* Floating Dropdown */}
      {showDropdown && (
        <div
          data-testid="search-dropdown"
          className="absolute top-full left-0 right-0 mt-1.5 z-50 bg-card border border-c rounded-md shadow-lg overflow-hidden max-h-96 overflow-y-auto"
        >
          {/* Loading Skeleton State */}
          {isSearching ? (
            <div className="p-2 space-y-2" data-testid="search-skeleton">
              {[1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="flex items-center gap-3 p-2 rounded bg-muted/5 animate-pulse"
                >
                  <div className="w-10 h-14 bg-muted/20 rounded shrink-0 aspect-[3/4]" />
                  <div className="flex-1 space-y-1.5">
                    <div className="h-3.5 bg-muted/20 rounded w-3/4" />
                    <div className="h-3 bg-muted/20 rounded w-1/2" />
                    <div className="h-2.5 bg-muted/20 rounded w-1/3" />
                  </div>
                </div>
              ))}
            </div>
          ) : seriesList.length === 0 ? (
            /* Empty State */
            <div
              className="p-6 text-center text-xs text-muted mono"
              data-testid="search-empty"
            >
              No series found
            </div>
          ) : (
            /* Results List (Up to 5) */
            <div className="p-1.5 space-y-1" role="listbox">
              {seriesList.slice(0, limit).map((item) => {
                const year = item.createdAt
                  ? new Date(item.createdAt).getFullYear()
                  : null;
                const seasonsCount = item.seasons?.length ?? 1;
                const rawRating = (item as { rating?: string | null }).rating;
                const ratingText = rawRating
                  ? (!isNaN(Number(rawRating)) ? `★ ${Number(rawRating).toFixed(1)}` : rawRating)
                  : (item.type === 'movie' ? 'PG-13' : 'TV-14');
                const genreNames = Array.isArray(item.genres)
                  ? item.genres.map((g) => (typeof g === 'string' ? g : g.name))
                  : [];

                const content = (
                  <div className="flex items-center gap-3 p-2 rounded hover-bg cursor-pointer transition-colors group">
                    {/* Poster Thumbnail */}
                    <div className="w-10 h-14 rounded overflow-hidden bg-muted/20 shrink-0 aspect-[3/4] flex items-center justify-center border border-c">
                      {item.posterUrl ? (
                        <img
                          src={item.posterUrl}
                          alt={item.title}
                          className="w-full h-full object-cover"
                          loading="lazy"
                        />
                      ) : (
                        <span className="text-xs font-mono text-muted">
                          {item.title.charAt(0).toUpperCase()}
                        </span>
                      )}
                    </div>

                    {/* Series Info */}
                    <div className="flex-1 min-w-0">
                      <h4 className="text-xs font-medium text-foreground line-clamp-1 group-hover:text-primary transition-colors">
                        {item.title}
                      </h4>

                      <div className="flex items-center gap-1.5 mt-1 text-[10px] mono text-muted flex-wrap">
                        {year && <span>{year}</span>}
                        {year && <span>•</span>}
                        <span className="px-1 py-0.2 rounded border border-c bg-muted/10 text-foreground">
                          {item.type === 'movie' ? 'Movie' : 'TV'}
                        </span>
                        <span>•</span>
                        <span className="px-1 py-0.2 rounded border border-c bg-muted/10 text-foreground" data-testid="rating-badge">
                          {ratingText}
                        </span>
                        <span>•</span>
                        <span>
                          {seasonsCount}{' '}
                          {seasonsCount === 1 ? 'Season' : 'Seasons'}
                        </span>
                      </div>

                      {/* Genre Tags */}
                      {genreNames.length > 0 && (
                        <div className="flex items-center gap-1 mt-1 flex-wrap">
                          {genreNames.slice(0, 3).map((genreName) => (
                            <span
                              key={genreName}
                              className="text-[9px] mono px-1 py-0.2 rounded border border-c text-muted bg-muted/5"
                            >
                              {genreName}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                );

                if (onSelectSeries) {
                  return (
                    <div
                      key={item.id}
                      role="option"
                      aria-selected="false"
                      onClick={() => handleSelect(item)}
                    >
                      {content}
                    </div>
                  );
                }

                return (
                  <Link
                    key={item.id}
                    to="/admin/videos/$seriesId"
                    params={{ seriesId: item.id }}
                    onClick={() => setIsOpen(false)}
                    className="block"
                    role="option"
                    aria-selected="false"
                  >
                    {content}
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
