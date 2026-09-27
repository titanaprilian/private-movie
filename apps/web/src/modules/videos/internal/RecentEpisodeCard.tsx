export interface RecentEpisodeCardProps {
  episodeId: string;
  seriesId: string;
  title: string;
  seriesTitle: string;
  thumbnailUrl: string;
  badgeLabel: string;
  onSelect?: (args: { episodeId: string; seriesId: string }) => void;
}

export function RecentEpisodeCard({
  episodeId,
  seriesId,
  title,
  seriesTitle,
  thumbnailUrl,
  badgeLabel,
  onSelect,
}: RecentEpisodeCardProps) {
  return (
    <div
      data-testid="episode-card"
      data-episode-id={episodeId}
      onClick={() => onSelect?.({ episodeId, seriesId })}
      className="w-72 shrink-0 rounded-[20px] border-2 border-[var(--border)] bg-[var(--bg)] overflow-hidden transition-all duration-150 hover:-translate-y-1 hover:border-[#1cb0f6] cursor-pointer group relative snap-start"
    >
      <div data-testid="episode-thumbnail" className="relative aspect-video w-full bg-[var(--surface-raised)] overflow-hidden">
        <img
          data-testid="episode-thumbnail-img"
          src={thumbnailUrl}
          alt={title}
          className="w-full h-full object-cover group-hover:opacity-90 transition-opacity"
          loading="lazy"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-60 pointer-events-none" />
        <div className="absolute bottom-2 left-2 z-10">
          <span className="rounded-full px-2.5 py-1 text-xs font-extrabold bg-[var(--green)] text-white">
            {badgeLabel}
          </span>
        </div>
      </div>

      <div className="p-2 sm:p-3 bg-[var(--bg)] space-y-0.5">
        <h3 data-testid="episode-title" className="text-sm font-bold font-sans text-[var(--ink)] truncate group-hover:text-[var(--blue)] transition-colors">
          {title}
        </h3>
        <p data-testid="episode-series-title" className="text-xs font-sans text-[var(--muted)] truncate">
          {seriesTitle}
        </p>
      </div>
    </div>
  );
}
