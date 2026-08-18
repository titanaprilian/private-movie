import { useEffect, useState } from 'react';
import { useSuspenseQuery } from '@tanstack/react-query';
import { Link, useNavigate, useSearch } from '@tanstack/react-router';
import { seriesListQueryOptions, type SeriesItem } from './api';
import { AddMediaDialog } from './AddMediaDialog';
import { useScrapeWorkerStore } from './store/useScrapeWorkerStore';

export function SeriesGrid() {
  const search = useSearch({ from: '/videos/' }) as { page?: number; q?: string };
  const navigate = useNavigate({ from: '/videos/' });
  const openDialog = useScrapeWorkerStore((state) => state.openDialog);

  const { data } = useSuspenseQuery(seriesListQueryOptions(search));

  const [inputValue, setInputValue] = useState(search.q ?? '');

  useEffect(() => {
    setInputValue(search.q ?? '');
  }, [search.q]);

  useEffect(() => {
    const handler = setTimeout(() => {
      const trimmed = inputValue.trim();
      const currentQ = search.q ?? '';
      if (trimmed !== currentQ) {
        navigate({
          search: (old: Record<string, unknown>) => ({
            ...old,
            q: trimmed || undefined,
            page: 1,
          }),
        });
      }
    }, 500);

    return () => {
      clearTimeout(handler);
    };
  }, [inputValue, search.q, navigate]);

  const seriesList = data?.series ?? [];
  const meta = data?.meta ?? { total: seriesList.length, page: 1, limit: 20 };
  const totalPages = Math.max(1, Math.ceil(meta.total / (meta.limit || 20)));

  return (
    <div className="space-y-4">
      {/* Header section */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-lg font-semibold">Videos</h1>
          <p className="text-xs text-muted">
            Manage and browse your video catalog.
          </p>
        </div>
        <button
          type="button"
          onClick={openDialog}
          className="px-3 py-1.5 rounded bg-primary text-primary-fg text-xs font-medium cursor-pointer hover:opacity-90 transition-opacity flex items-center gap-1.5"
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path d="M12 5v14M5 12h14" />
          </svg>
          Add Video
        </button>
      </div>

      {/* Filter bar */}
      <div className="bg-card border border-c rounded p-2.5 flex items-center justify-between gap-3">
        <input
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          placeholder="Filter series..."
          className="w-full max-w-xs px-3 py-1.5 rounded border border-c bg-transparent text-xs mono focus:outline-none focus:border-primary"
        />
        <span className="text-xs text-muted mono">
          {meta.total} {meta.total === 1 ? 'series' : 'series'}
        </span>
      </div>

      {/* Grid view */}
      {seriesList.length === 0 ? (
        <div className="bg-card border border-c rounded p-8 text-center text-xs text-muted mono">
          No series found matching filter.
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {seriesList.map((item: SeriesItem & { episodes?: unknown[]; episodeCount?: number }) => {
            const epCount = item.episodes?.length ?? item.episodeCount ?? 0;
            return (
              <Link
                key={item.id}
                to="/videos/$seriesId"
                params={{ seriesId: item.id }}
                className="group bg-card border border-c rounded overflow-hidden flex flex-col hover:border-primary transition-colors cursor-pointer"
              >
                {/* Poster / Thumbnail */}
                <div className="relative aspect-[16/10] overflow-hidden bg-black/10 dark:bg-white/5 flex items-center justify-center">
                  {item.posterUrl ? (
                    <img
                      src={item.posterUrl}
                      alt={item.title}
                      className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                      loading="lazy"
                    />
                  ) : (
                    <div className="w-12 h-12 rounded border border-c bg-muted/20 flex items-center justify-center text-sm font-mono text-muted">
                      {item.title.charAt(0).toUpperCase()}
                    </div>
                  )}
                </div>

                {/* Card Content */}
                <div className="p-3 flex flex-col flex-1 justify-between">
                  <div>
                    <h3 className="text-sm font-medium leading-snug line-clamp-1 group-hover:text-primary transition-colors">
                      {item.title}
                    </h3>
                    <p className="text-xs text-muted mt-1 line-clamp-2 leading-relaxed">
                      {item.description || 'No description available.'}
                    </p>
                  </div>

                  <div className="mt-3 pt-2 border-t border-c flex items-center justify-between text-xs">
                    <span className="mono text-muted">{item.source}</span>
                    <span className="text-[10px] mono px-1.5 py-0.5 rounded border border-c bg-sidebar text-muted">
                      {epCount} {epCount === 1 ? 'episode' : 'episodes'}
                    </span>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}

      {/* Pagination Bar */}
      {(meta.total > meta.limit * meta.page || meta.page > 1) && (
        <div className="bg-card border border-c rounded px-4 py-2.5 flex items-center justify-between text-xs text-muted">
          <span className="mono">
            Page {meta.page} of {totalPages}
          </span>
          <div className="flex items-center gap-2">
            {meta.page > 1 ? (
              <Link
                to="/videos"
                search={(old: Record<string, unknown>) => ({ ...old, page: meta.page - 1 })}
                className="px-2.5 py-1 rounded border border-c hover-bg cursor-pointer text-foreground"
              >
                Previous
              </Link>
            ) : (
              <span className="px-2.5 py-1 rounded border border-c opacity-50 cursor-not-allowed">
                Previous
              </span>
            )}
            {meta.total > meta.limit * meta.page ? (
              <Link
                to="/videos"
                search={(old: Record<string, unknown>) => ({ ...old, page: meta.page + 1 })}
                className="px-2.5 py-1 rounded border border-c hover-bg cursor-pointer text-foreground"
              >
                Next
              </Link>
            ) : (
              <span className="px-2.5 py-1 rounded border border-c opacity-50 cursor-not-allowed">
                Next
              </span>
            )}
          </div>
        </div>
      )}

      <AddMediaDialog />
    </div>
  );
}
