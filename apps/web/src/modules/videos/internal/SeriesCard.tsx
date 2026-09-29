import { useState } from 'react';
import { Link } from '@tanstack/react-router';
import { cn } from '@/lib/utils';
import { FeaturedStar } from './FeaturedStar';
import { ChunkyTooltip } from '@/components/ui/chunky-tooltip';
import type { SeriesItem } from './api';

export interface SeriesCardProps {
  item: SeriesItem & { episodes?: unknown[]; episodeCount?: number };
  onToggleFeatured: (item: SeriesCardProps['item'], e: React.MouseEvent) => void;
  onEdit: (item: SeriesCardProps['item'], e: React.MouseEvent) => void;
  onDelete: (item: SeriesCardProps['item'], e: React.MouseEvent) => void;
  onToggleHighlight?: (item: SeriesCardProps['item'], e: React.MouseEvent) => void;
}

// eslint-disable-next-line react-refresh/only-export-components
export function getEpisodeCount(
  item: SeriesCardProps['item']
): number {
  if (Array.isArray(item.episodes)) return item.episodes.length;
  return item.episodeCount ?? 0;
}

export function SeriesCard({ item, onToggleFeatured, onEdit, onDelete, onToggleHighlight }: SeriesCardProps) {
  const [imgFailed, setImgFailed] = useState(false);
  const epCount = getEpisodeCount(item);
  const isFeatured = Boolean(item.isFeatured);
  const isHighlighted = Boolean(
    (item as SeriesItem & { isOngoingHighlighted?: boolean }).isOngoingHighlighted
  );
  const isOngoing = Boolean(
    (item as SeriesItem & { hasOngoing?: boolean; seasons?: { status?: string }[] }).hasOngoing ||
      (item as SeriesItem & { seasons?: { status?: string }[] }).seasons?.some(
        (s) => s.status === 'ongoing'
      )
  );
  const showImg = Boolean(item.posterUrl) && !imgFailed;
  const initial = (item.title?.charAt(0) ?? '?').toUpperCase();

  const stop = (fn: (item: SeriesCardProps['item'], e: React.MouseEvent) => void) => {
    return (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      fn(item, e);
    };
  };

  return (
    <div
      data-testid="series-card"
      data-series-id={item.id}
      className="group bg-card border border-c rounded-[16px] overflow-hidden flex flex-col hover:border-primary transition-colors"
    >
      <div className="relative aspect-[3/4] overflow-hidden bg-black/10 dark:bg-white/5 flex items-center justify-center">
        {showImg ? (
          <Link
            to="/admin/videos/$seriesId"
            params={{ seriesId: item.id }}
            aria-label={`View ${item.title}`}
            className="absolute inset-0 cursor-pointer"
          >
            <img
              src={item.posterUrl as string}
              alt={item.title}
              onError={() => setImgFailed(true)}
              className="w-full h-full object-cover rounded-t transition-transform duration-300 group-hover:scale-105"
              loading="lazy"
            />
          </Link>
        ) : (
          <Link
            to="/admin/videos/$seriesId"
            params={{ seriesId: item.id }}
            aria-label={`View ${item.title}`}
            className="absolute inset-0 flex items-center justify-center cursor-pointer"
          >
            <div
              data-testid="series-poster-fallback"
              className="w-12 h-12 rounded border border-c bg-muted/20 flex items-center justify-center text-sm font-mono text-muted"
            >
              {initial}
            </div>
          </Link>
        )}
        <FeaturedStar
          featured={isFeatured}
          title={item.title}
          aria-label={
            isFeatured
              ? `Remove ${item.title} from featured`
              : `Mark ${item.title} as featured`
          }
          onToggle={(e) => onToggleFeatured(item, e)}
        />
        {(isFeatured || isOngoing || isHighlighted) && (
          <div className="absolute top-2 left-2 flex flex-wrap gap-1 z-10 max-w-[calc(100%-4rem)]">
            {isFeatured && (
              <span
                className={cn(
                  'inline-flex items-center justify-center',
                  'px-2 h-[26px] rounded-[8px]',
                  'border-2 border-b-[3px]',
                  'border-[var(--green)] bg-[var(--green-soft)] text-[var(--green)]',
                  'text-[11px] font-extrabold uppercase tracking-[0.6px]',
                  'backdrop-blur-xs shadow-xs'
                )}
              >
                Featured
              </span>
            )}
            {isOngoing && (
              <span
                className={cn(
                  'inline-flex items-center justify-center',
                  'px-2 h-[26px] rounded-[8px]',
                  'border-2 border-b-[3px]',
                  'border-[var(--gold-dark)] bg-[var(--gold-tint)] text-[var(--gold)]',
                  'text-[11px] font-extrabold uppercase tracking-[0.6px]',
                  'backdrop-blur-xs shadow-xs'
                )}
              >
                Ongoing
              </span>
            )}
            {isHighlighted && (
              <span
                className={cn(
                  'inline-flex items-center justify-center',
                  'px-2 h-[26px] rounded-[8px]',
                  'border-2 border-b-[3px]',
                  'border-[var(--gold-dark)] bg-[var(--gold-tint-hover)] text-[var(--gold)]',
                  'text-[11px] font-extrabold uppercase tracking-[0.6px]',
                  'backdrop-blur-xs shadow-xs'
                )}
              >
                Highlighted Ongoing
              </span>
            )}
          </div>
        )}
        {onToggleHighlight && (
          <ChunkyTooltip
            content={
              isHighlighted
                ? 'Remove ongoing highlight'
                : 'Highlight in ongoing feed'
            }
          >
          <button
            type="button"
            aria-label={`${isHighlighted ? 'Unhighlight' : 'Highlight'} ${item.title}`}
            aria-pressed={isHighlighted}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onToggleHighlight(item, e);
            }}
            className={cn(
              'absolute bottom-2 right-2 z-10',
              'w-9 h-9 rounded-[10px]',
              'inline-flex items-center justify-center',
              'border-2 border-b-[3px]',
              'font-extrabold transition-all cursor-pointer',
              'active:translate-y-[2px] active:border-b-2',
              'backdrop-blur-xs shadow-xs',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--blue)]',
              isHighlighted
                ? 'border-[var(--gold-dark)] bg-[var(--gold-tint)] text-[var(--gold)] opacity-100 hover:bg-[var(--gold-tint-hover)]'
                : 'border-c bg-card/90 text-muted hover:text-[var(--gold)] opacity-0 group-hover:opacity-100 focus-visible:opacity-100'
            )}
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill={isHighlighted ? 'currentColor' : 'none'}
              stroke="currentColor"
              strokeWidth="2"
              aria-hidden="true"
            >
              <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
            </svg>
          </button>
          </ChunkyTooltip>
        )}
      </div>

      <div className="p-3 flex flex-col flex-1 justify-between">
        <div>
          <Link
            to="/admin/videos/$seriesId"
            params={{ seriesId: item.id }}
            className="cursor-pointer hover:text-primary transition-colors"
          >
            <h3 className="text-sm font-medium leading-snug line-clamp-1">
              {item.title}
            </h3>
          </Link>
          <p className="text-xs text-muted mt-1 line-clamp-2 leading-relaxed">
            {item.description || 'No description available.'}
          </p>
        </div>

        <div className="mt-3 pt-2 border-t border-c flex items-center justify-between text-xs">
          <span className="mono text-muted">{item.source}</span>
          <span className="text-[10px] mono px-1.5 py-0.5 rounded border border-[var(--blue)] bg-[var(--blue-soft)] text-[var(--blue)] font-semibold">
            {epCount} {epCount === 1 ? 'episode' : 'episodes'}
          </span>
        </div>
      </div>

      <div className="px-3 pb-3 pt-1 flex items-center gap-2 mt-auto">
        <button
          type="button"
          aria-label={`Edit ${item.title}`}
          onClick={stop(onEdit)}
          className={cn(
            'flex-1 h-11 inline-flex items-center justify-center gap-2 rounded-[14px]',
            'border-2 border-b-4 border-[var(--blue)] bg-[var(--blue-soft)] text-[var(--blue)]',
            'font-extrabold text-[13px] uppercase tracking-[0.7px] cursor-pointer transition-all',
            'hover:brightness-110 active:translate-y-[2px] active:border-b-2',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--blue)]'
          )}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M12 20h9"/>
            <path d="M16.376 3.622a1 1 0 0 1 3.002 3.002L7.368 18.635a2 2 0 0 1-.855.506l-2.872.838a.5.5 0 0 1-.62-.62l.838-2.872a2 2 0 0 1 .506-.854z"/>
          </svg>
          Edit
        </button>
        <button
          type="button"
          aria-label={`Delete ${item.title}`}
          onClick={stop(onDelete)}
          className={cn(
            'flex-1 h-11 inline-flex items-center justify-center gap-2 rounded-[14px]',
            'border-2 border-b-4 border-[var(--red)] bg-[var(--red)]/10 text-[var(--red)]',
            'font-extrabold text-[13px] uppercase tracking-[0.7px] cursor-pointer transition-all',
            'hover:bg-[var(--red)]/20 active:translate-y-[2px] active:border-b-2',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--red)]'
          )}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M3 6h18"/>
            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/>
            <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
          </svg>
          Delete
        </button>
      </div>
    </div>
  );
}
