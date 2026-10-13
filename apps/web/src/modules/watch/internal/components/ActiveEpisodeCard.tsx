import { ChunkyCard } from '@/components/ui/chunky-card';
import type { ActiveEpisodeCardProps } from '../types';

export function ActiveEpisodeCard({
  seriesTitle,
  activeEpisode,
  activeSeasonTitle,
  formattedDuration,
  onBackToOverview,
}: ActiveEpisodeCardProps) {
  return (
    <ChunkyCard
      data-testid="active-episode-overview"
      className="rounded-[20px] p-5 sm:p-6 space-y-3"
    >
      <button
        type="button"
        onClick={onBackToOverview}
        data-testid="series-tag-pill"
        className="inline-flex items-center bg-[#58cc02]/15 hover:bg-[#58cc02]/25 text-[#58cc02] font-display font-bold text-xs sm:text-sm px-3.5 py-1 rounded-full cursor-pointer transition-all duration-150 active:scale-[0.97]"
      >
        {seriesTitle}
      </button>

      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 flex-wrap">
        <h2 className="text-2xl sm:text-3xl font-display font-extrabold tracking-tight text-[var(--ink)] leading-snug">
          {activeEpisode.order !== undefined && activeEpisode.order !== null
            ? `EP ${activeEpisode.order} — ${activeEpisode.title}`
            : activeEpisode.title}
        </h2>

        <div className="flex items-center gap-2 shrink-0">
          {activeSeasonTitle && (
            <span
              data-testid="meta-season-badge"
              className="bg-[var(--surface-raised)] border-2 border-b-4 border-[var(--border)] text-[var(--muted)] font-display font-bold text-xs sm:text-sm px-3.5 py-1 rounded-full whitespace-nowrap"
            >
              {activeSeasonTitle}
            </span>
          )}
          {formattedDuration && (
            <span
              data-testid="meta-duration-badge"
              className="bg-[var(--yellow)]/15 border-2 border-b-4 border-[var(--yellow-dark)]/40 text-[var(--yellow)] font-display font-bold text-xs sm:text-sm px-3.5 py-1 rounded-full whitespace-nowrap"
            >
              {formattedDuration}
            </span>
          )}
        </div>
      </div>

      {activeEpisode.description ? (
        <p className="text-sm sm:text-base leading-relaxed text-[var(--muted)] max-w-4xl pt-1">
          {activeEpisode.description}
        </p>
      ) : (
        <p className="text-sm sm:text-base italic text-[var(--muted)]/60 pt-1">
          No description available for this episode.
        </p>
      )}
    </ChunkyCard>
  );
}
