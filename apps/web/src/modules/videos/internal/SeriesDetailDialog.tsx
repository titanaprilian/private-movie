import { Play, Star, X } from 'lucide-react';
import {
  Dialog,
  DialogClose,
  DialogContent,
} from '@/components/ui/dialog';
import { ChunkyButton } from '@/components/ui/chunky-button';

export interface SeriesDetailDialogSeries {
  id: string;
  title: string;
  synopsis: string;
  posterUrl: string;
  bannerUrl: string;
  type: string;
  seasons: number;
  episodes: number;
  rating: string;
  year: number;
  genres: string[];
}

export interface SeriesDetailDialogProps {
  series: SeriesDetailDialogSeries | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onPlay?: (seriesId: string) => void;
}

function formatTypeLabel(type: string): string {
  const normalized = (type || 'tv').toLowerCase();
  if (normalized === 'movie') return 'Movie';
  return 'TV';
}

export function SeriesDetailDialog({ series, open, onOpenChange, onPlay }: SeriesDetailDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        data-testid="series-detail-dialog"
        className="max-w-2xl rounded-[20px] border-2 border-[var(--border)] bg-[var(--bg)] p-0 overflow-hidden gap-0"
      >
        {series ? (
          <div>
            <div className="relative h-56 md:h-72 w-full overflow-hidden">
              <img
                data-testid="series-detail-backdrop"
                src={series.bannerUrl}
                alt={`${series.title} backdrop`}
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-[var(--bg)] via-transparent to-transparent pointer-events-none" />
              <DialogClose
                data-testid="series-detail-close"
                aria-label="Close details"
                className="absolute right-4 top-4"
                asChild
              >
                <ChunkyButton variant="outline" size="icon">
                  <X className="w-5 h-5" />
                </ChunkyButton>
              </DialogClose>
            </div>

            <div className="p-6 space-y-4">
              <div data-testid="series-detail-badges" className="flex items-center gap-2 flex-wrap">
                <span className="rounded-full px-2.5 py-1 text-xs font-extrabold bg-black/50 text-white">
                  {formatTypeLabel(series.type)}
                </span>
                <span className="rounded-full px-2.5 py-1 text-xs font-extrabold bg-[var(--purple)] text-white">
                  {series.seasons} {series.seasons === 1 ? 'Season' : 'Seasons'}
                </span>
                <span className="rounded-full px-2.5 py-1 text-xs font-extrabold bg-[var(--yellow)] text-amber-950 flex items-center gap-1">
                  <Star className="w-3.5 h-3.5 fill-amber-950 text-amber-950 shrink-0" aria-hidden="true" />
                  <span className="leading-none">{series.rating}</span>
                </span>
              </div>

              <h2 data-testid="series-detail-title" className="font-display text-3xl md:text-4xl font-extrabold tracking-tight text-[var(--ink)]">
                {series.title}
              </h2>

              <p data-testid="series-detail-synopsis" className="font-sans text-sm md:text-base text-[var(--muted)] leading-relaxed">
                {series.synopsis}
              </p>

              <div className="flex items-center gap-3 pt-2">
                <ChunkyButton
                  type="button"
                  data-testid="series-detail-play"
                  onClick={() => {
                    onPlay?.(series.id);
                    onOpenChange(false);
                  }}
                >
                  <Play className="w-5 h-5 fill-white text-white" />
                  <span>Play Now</span>
                </ChunkyButton>
              </div>
            </div>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
