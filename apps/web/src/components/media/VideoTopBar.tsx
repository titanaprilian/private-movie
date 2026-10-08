import { ChevronLeft } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface VideoTopBarProps {
  /** Visibility state of player controls. When false, bar transitions out and disables pointer events. */
  showControls: boolean;
  /** Optional click handler for the Back button. If omitted, Back button is not rendered. */
  onBack?: () => void;
  /** Name of the series / show if playing an episodic video. */
  seriesTitle?: string;
  /** Episode code/label (e.g., "S1:E3"). */
  episodeLabel?: string;
  /** Episode title or standalone video title. */
  title?: string;
  /** Optional extra classes on the root container. */
  className?: string;
}

export function VideoTopBar({
  showControls,
  onBack,
  seriesTitle,
  episodeLabel,
  title,
  className,
}: VideoTopBarProps) {
  // Title formatting priority:
  // If seriesTitle and episodeLabel are provided: "${seriesTitle} · ${episodeLabel}${title ? ' – ' + title : ''}"
  // Otherwise fall back to title (if present).
  let displayTitle = '';
  if (seriesTitle && episodeLabel) {
    displayTitle = `${seriesTitle} · ${episodeLabel}${title ? ` – ${title}` : ''}`;
  } else if (title) {
    displayTitle = title;
  }

  return (
    <div
      data-testid="video-top-bar"
      className={cn(
        'absolute top-0 inset-x-0 z-40 flex items-center justify-between p-4 md:p-6 transition-all duration-300',
        showControls ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-2 pointer-events-none',
        className
      )}
    >
      <div className="flex items-center gap-3">
        {onBack && (
          <button
            type="button"
            onClick={onBack}
            aria-label="Back"
            className="inline-flex items-center gap-2 rounded-full bg-[var(--surface)]/90 backdrop-blur-md border-2 border-[#58cc02]/60 text-[var(--ink)] hover:border-[#58cc02] font-sans font-bold text-sm px-3.5 py-2 shadow-[0_3px_0_#46a302] border-b-4 border-b-[var(--green-dark)] active:translate-y-[2px] active:border-b-2 active:shadow-[0_1px_0_#46a302] transition-all cursor-pointer"
          >
            <ChevronLeft className="h-4.5 w-4.5 stroke-[2.5]" aria-hidden="true" />
            <span>Back</span>
          </button>
        )}
      </div>

      {displayTitle ? (
        <div
          data-testid="video-top-bar-title"
          className="flex items-center max-w-[70%] sm:max-w-md md:max-w-xl truncate rounded-full bg-[var(--surface)]/90 backdrop-blur-md border-2 border-b-4 border-[var(--border)] px-4 py-2 text-xs md:text-sm font-extrabold text-[var(--ink)] shadow-md"
        >
          <span className="truncate">{displayTitle}</span>
        </div>
      ) : null}
    </div>
  );
}
