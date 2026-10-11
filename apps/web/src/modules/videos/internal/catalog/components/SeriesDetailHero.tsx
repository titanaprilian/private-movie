import {
  Play,
  Check,
  Edit2,
  RefreshCw,
  Plus,
  ArrowDownToLine,
} from 'lucide-react';
import type { SeriesDetails, SeasonDetails } from '../../api';
import { ChunkyButton } from '@/components/ui/chunky-button';
import { ChunkyChip } from '@/components/ui/chunky-chip';
import { ChunkyTooltip } from '@/components/ui/chunky-tooltip';
import { useClampedText } from '@/hooks/useClampedText';

export interface SeriesDetailHeroProps {
  series: SeriesDetails;
  activeSeason: SeasonDetails | null;
  episodeCount: number;
  onEditSeries: () => void;
  onSyncTmdb: () => void;
  onBulkScrape: () => void;
  onBulkIngest: () => void;
}

export function SeriesDetailHero({
  series,
  activeSeason,
  episodeCount,
  onEditSeries,
  onSyncTmdb,
  onBulkScrape,
  onBulkIngest,
}: SeriesDetailHeroProps) {
  const currentDescription = activeSeason?.description || series?.description || '';
  const currentPosterUrl = activeSeason?.posterUrl || series?.posterUrl || null;

  const isDescriptionEmpty = !currentDescription || !currentDescription.trim();
  const clampedText = useClampedText(currentDescription, {
    seriesId: series.id,
    seasonId: activeSeason?.id,
    contentId: 'series-hero-description',
  });

  return (
    <div className="hero">
      {currentPosterUrl ? (
        <img
          src={currentPosterUrl}
          alt={series.title}
          className="hero-poster object-cover bg-[var(--surface)] border-2 border-[var(--border)]"
        />
      ) : (
        <div className="hero-poster bg-[var(--surface)] border-2 border-[var(--border)] text-[var(--muted)] flex items-center justify-center font-bold">
          No Poster
        </div>
      )}
      <div className="hero-body">
        <div className="hero-title">
          <h1 className="text-[28px] font-extrabold text-[var(--ink)] leading-none">
            {series.title}
          </h1>
          <span className="pill ep-count rounded-full bg-[var(--surface)] border-0 text-[var(--blue)] font-extrabold text-[12px]">
            <Play className="size-3.5 fill-current" />
            {episodeCount} {episodeCount === 1 ? 'Episode' : 'Episodes'}
          </span>
          <span
            className={`pill rounded-full font-extrabold text-[12px] border-0 ${
              activeSeason?.status === 'ongoing'
                ? 'bg-amber-500/15 text-amber-500'
                : 'pill ok bg-[var(--green-tint)] text-[var(--green)]'
            }`}
          >
            {activeSeason?.status !== 'ongoing' && <Check className="size-3.5 stroke-[3]" />}
            {activeSeason?.status || 'completed'}
          </span>
          {series.isFeatured && (
            <span className="pill rounded-full border-2 border-[var(--gold-dark)] bg-[var(--gold-tint)] text-[var(--gold)] font-extrabold text-[12px]">
              Featured
            </span>
          )}
        </div>

        <div className="hero-desc-wrap">
          {isDescriptionEmpty ? (
            <div className="hero-desc empty">
              No description available.
            </div>
          ) : (
            <>
              <p
                id="series-hero-description"
                ref={clampedText.contentRef as React.RefObject<HTMLParagraphElement>}
                className={`hero-desc${clampedText.isExpanded ? ' expanded' : ''}`}
              >
                {currentDescription}
              </p>
              {clampedText.showToggle && (
                <button
                  type="button"
                  onClick={clampedText.toggleExpanded}
                  className="desc-toggle"
                  {...clampedText.toggleProps}
                >
                  {clampedText.toggleLabel}
                </button>
              )}
            </>
          )}
        </div>

        <div className="hero-actions">
          <ChunkyChip
            variant="blue"
            onClick={onEditSeries}
            type="button"
          >
            <Edit2 className="size-4" />
            Edit Series
          </ChunkyChip>

          {!series.tmdbId ? (
            <ChunkyTooltip content="Link TMDB in Edit Series to enable sync">
              <span className="inline-flex" tabIndex={0}>
                <ChunkyChip
                  variant="blue"
                  onClick={onSyncTmdb}
                  type="button"
                  disabled
                >
                  <RefreshCw className="size-4" />
                  Sync with TMDB
                </ChunkyChip>
              </span>
            </ChunkyTooltip>
          ) : (
            <ChunkyChip
              variant="blue"
              onClick={onSyncTmdb}
              type="button"
            >
              <RefreshCw className="size-4" />
              Sync with TMDB
            </ChunkyChip>
          )}

          <ChunkyChip
            variant="blue"
            onClick={onBulkScrape}
            type="button"
          >
            <Plus className="size-4" />
            Bulk Add Sources
          </ChunkyChip>

          <ChunkyButton
            variant="green"
            onClick={onBulkIngest}
            type="button"
          >
            <ArrowDownToLine className="size-5" />
            Bulk Ingest Sources
          </ChunkyButton>
        </div>
      </div>
    </div>
  );
}
