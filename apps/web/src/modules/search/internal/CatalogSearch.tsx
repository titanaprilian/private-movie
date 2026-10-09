import { useState, useRef, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { Search, SearchX, Star, X } from 'lucide-react';
import { ChunkyInput } from '@/components/ui/chunky-input';
import { ChunkySkeleton } from '@/components/ui/chunky-skeleton';
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
        <div className="absolute left-3.5 pointer-events-none text-[var(--muted)]">
          <Search size={16} strokeWidth={2.5} aria-hidden="true" />
        </div>

        <ChunkyInput
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
          className="pl-10 pr-10"
        />

        {/* Clear Button (X) */}
        {query.length > 0 && (
          <button
            type="button"
            onClick={handleClear}
            aria-label="Clear search"
            className="absolute right-2 flex h-7 w-7 items-center justify-center rounded-xl border-2 border-[var(--border)] bg-[var(--surface-raised)] text-[var(--muted)] transition-all hover:border-[var(--border-strong)] hover:text-[var(--ink)] active:translate-y-[1px] cursor-pointer"
          >
            <X size={14} strokeWidth={2.5} aria-hidden="true" />
          </button>
        )}
      </div>

      {/* Floating Dropdown */}
      {showDropdown && (
        <div
          data-testid="search-dropdown"
          className="absolute top-full left-0 right-0 mt-1.5 z-50 rounded-2xl border-2 border-b-4 border-[var(--border)] bg-[var(--surface)] shadow-2xl overflow-hidden max-h-96 overflow-y-auto"
        >
          {/* Loading Skeleton State */}
          {isSearching ? (
            <div className="p-2 space-y-2" data-testid="search-skeleton">
              {[1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="flex items-center gap-3 rounded-2xl border-2 border-[var(--border)] bg-[var(--surface)] p-2"
                >
                  <ChunkySkeleton className="h-14 w-10 shrink-0 aspect-[3/4]" />
                  <div className="flex-1 space-y-1.5">
                    <ChunkySkeleton className="h-3.5 w-3/4" />
                    <ChunkySkeleton className="h-3 w-1/2" />
                    <ChunkySkeleton className="h-2.5 w-1/3" />
                  </div>
                </div>
              ))}
            </div>
          ) : seriesList.length === 0 ? (
            /* Empty State */
            <div
              className="m-2 rounded-2xl border-2 border-b-4 border-[var(--border)] bg-[var(--surface-raised)] p-8 text-center"
              data-testid="search-empty"
            >
              <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl border-2 border-b-4 border-[var(--border)] bg-[var(--surface)] text-[var(--muted)]">
                <SearchX size={22} strokeWidth={2.5} aria-hidden="true" />
              </div>
              <p className="font-display text-base font-extrabold text-[var(--ink)]">
                No series found
              </p>
              <p className="mt-1 font-sans text-xs font-semibold text-[var(--muted)]">
                Try a different title or keyword
              </p>
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
                  ? (!isNaN(Number(rawRating)) ? Number(rawRating).toFixed(1) : rawRating)
                  : (item.type === 'movie' ? 'PG-13' : 'TV-14');
                const genreNames = Array.isArray(item.genres)
                  ? item.genres.map((g) => (typeof g === 'string' ? g : g.name))
                  : [];

                const content = (
                  <div className="flex items-center gap-3 rounded-2xl border-2 border-transparent bg-transparent p-2 transition-all cursor-pointer hover:-translate-y-[1px] hover:border-[var(--border-strong)] hover:bg-[var(--surface-raised)] hover:shadow-md group">
                    {/* Poster Thumbnail */}
                    <div className="flex h-14 w-10 shrink-0 aspect-[3/4] items-center justify-center overflow-hidden rounded-xl border-2 border-[var(--border)] bg-[var(--surface-raised)]">
                      {item.posterUrl ? (
                        <img
                          src={item.posterUrl}
                          alt={item.title}
                          className="h-full w-full object-cover"
                          loading="lazy"
                        />
                      ) : (
                        <span className="font-display text-sm font-extrabold text-[var(--muted)]">
                          {item.title.charAt(0).toUpperCase()}
                        </span>
                      )}
                    </div>

                    {/* Series Info */}
                    <div className="flex-1 min-w-0">
                      <h4 className="font-display text-sm font-extrabold text-[var(--ink)] line-clamp-1 transition-colors group-hover:text-[var(--blue-dark)]">
                        {item.title}
                      </h4>

                      <div className="mt-1 flex flex-wrap items-center gap-1.5 font-sans text-[11px] font-bold text-[var(--muted)]">
                        {year && <span>{year}</span>}
                        {year && <span aria-hidden="true">•</span>}
                        <span className="rounded-lg border-2 border-[var(--border)] bg-[var(--surface-raised)] px-1.5 py-px font-sans text-[10px] font-extrabold uppercase tracking-wide text-[var(--ink)]">
                          {item.type === 'movie' ? 'Movie' : 'TV'}
                        </span>
                        <span aria-hidden="true">•</span>
                        <span className="inline-flex items-center gap-1 rounded-lg border-2 border-[var(--gold-dark)] bg-[var(--gold)]/15 px-1.5 py-px font-sans text-[10px] font-extrabold text-[var(--ink)]" data-testid="rating-badge">
                          <Star size={10} strokeWidth={2.5} aria-hidden="true" className="text-[var(--gold-dark)]" />
                          {ratingText}
                        </span>
                        <span aria-hidden="true">•</span>
                        <span>
                          {seasonsCount}{' '}
                          {seasonsCount === 1 ? 'Season' : 'Seasons'}
                        </span>
                      </div>

                      {/* Genre Tags */}
                      {genreNames.length > 0 && (
                        <div className="mt-1.5 flex flex-wrap items-center gap-1">
                          {genreNames.slice(0, 3).map((genreName) => (
                            <span
                              key={genreName}
                              className="rounded-lg border-2 border-[var(--border)] bg-[var(--blue)]/10 px-1.5 py-px font-sans text-[10px] font-extrabold text-[var(--blue-dark)]"
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
