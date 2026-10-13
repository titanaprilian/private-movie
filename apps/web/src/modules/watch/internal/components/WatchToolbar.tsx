import { ExternalLink, RotateCcw, SkipBack, SkipForward } from 'lucide-react';
import { ChunkyButton } from '@/components/ui/chunky-button';
import {
  ChunkySelect,
  ChunkySelectContent,
  ChunkySelectItem,
  ChunkySelectTrigger,
  ChunkySelectValue,
} from '@/components/ui/chunky-select';
import type { WatchToolbarProps } from '../types';

function focusRing(
  isSpatialMode: boolean | undefined,
  activeZone: string | undefined,
  focusIndex: number | undefined,
  index: number
) {
  return isSpatialMode && activeZone === 'controls' && focusIndex === index
    ? 'ring-2 ring-white ring-offset-2 ring-offset-black scale-105 bg-white text-black font-semibold shadow-xl z-10'
    : '';
}

export function WatchToolbar({
  hasPrevEpisode,
  hasNextEpisode,
  onPrevEpisode,
  onNextEpisode,
  onReloadPlayer,
  onOpenNewTab,
  isEmbedSource,
  activeSourceIndex,
  sources,
  onSelectSource,
  controlsRefs,
  serverControlIndex,
  isSpatialMode,
  activeZone,
  focusIndex,
}: WatchToolbarProps) {
  return (
    <div
      data-testid="watch-controls"
      className="flex items-center justify-between gap-2 sm:gap-3 flex-nowrap min-w-0"
    >
      {/* Group 1: Playback Controls (Prev / Next segmented pill group) */}
      <div
        data-testid="controls-playback-group"
        className="inline-flex bg-[var(--surface)] border-2 border-[var(--border)] rounded-full p-0.5 sm:p-1 gap-0.5 sm:gap-1 order-1 shrink-0"
      >
        <ChunkyButton
          type="button"
          variant="outline"
          size="sm"
          ref={(el) => {
            if (controlsRefs) controlsRefs.current[0] = el;
          }}
          onClick={onPrevEpisode}
          disabled={!hasPrevEpisode}
          aria-label="Prev episode"
          className={`min-h-[44px] rounded-full font-display text-xs sm:text-sm px-2.5 py-1.5 sm:px-4 sm:py-2 ${focusRing(isSpatialMode, activeZone, focusIndex, 0)}`}
        >
          <SkipBack className="h-3.5 w-3.5 sm:h-4 sm:w-4 shrink-0" />
          <span>Prev</span>
        </ChunkyButton>

        <ChunkyButton
          type="button"
          variant="outline"
          size="sm"
          ref={(el) => {
            if (controlsRefs) controlsRefs.current[1] = el;
          }}
          onClick={onNextEpisode}
          disabled={!hasNextEpisode}
          aria-label="Next episode"
          className={`min-h-[44px] rounded-full font-display text-xs sm:text-sm px-2.5 py-1.5 sm:px-4 sm:py-2 ${focusRing(isSpatialMode, activeZone, focusIndex, 1)}`}
        >
          <span>Next</span>
          <SkipForward className="h-3.5 w-3.5 sm:h-4 sm:w-4 shrink-0" />
        </ChunkyButton>
      </div>

      {/* Group 2: Utility Action Buttons (Reload / Open Tab) — embed only */}
      {isEmbedSource && (
        <div
          data-testid="controls-utility-group"
          className="order-2 flex items-center justify-center shrink-0 min-w-0"
        >
          <div className="flex items-center gap-1.5 sm:gap-2">
            <ChunkyButton
              type="button"
              variant="outline"
              size="sm"
              ref={(el) => {
                if (controlsRefs) controlsRefs.current[2] = el;
              }}
              onClick={onReloadPlayer}
              aria-label="Reload player"
              title="Reload video player"
              className={`min-h-[44px] rounded-full font-display text-xs sm:text-sm px-2.5 py-1.5 sm:px-4 sm:py-2 ${focusRing(isSpatialMode, activeZone, focusIndex, 2)}`}
            >
              <RotateCcw className="h-3.5 w-3.5 sm:h-4 sm:w-4 shrink-0" />
              <span className="hidden sm:inline">Reload</span>
            </ChunkyButton>

            <ChunkyButton
              type="button"
              variant="blue"
              size="sm"
              ref={(el) => {
                if (controlsRefs) controlsRefs.current[3] = el;
              }}
              onClick={onOpenNewTab}
              aria-label="Open in new tab"
              title="Open stream in new tab"
              className={`min-h-[44px] rounded-full font-display text-xs sm:text-sm px-2.5 py-1.5 sm:px-4 sm:py-2 bg-[var(--blue)] ${focusRing(isSpatialMode, activeZone, focusIndex, 3)}`}
            >
              <ExternalLink className="h-3.5 w-3.5 sm:h-4 sm:w-4 shrink-0" />
              <span className="hidden sm:inline">Open Tab</span>
            </ChunkyButton>
          </div>
        </div>
      )}

      {/* Group 3: Stream Configuration / Server Selector Chip — docked to the right */}
      <div
        data-testid="controls-server-group"
        className="order-3 shrink min-w-0 flex items-center justify-end"
      >
        <ChunkySelect
          value={String(activeSourceIndex)}
          onValueChange={(v) => onSelectSource(Number(v))}
        >
          <ChunkySelectTrigger
            ref={(el) => {
              if (controlsRefs) {
                controlsRefs.current[serverControlIndex] =
                  el as unknown as HTMLButtonElement;
              }
            }}
            aria-label="Server selector"
            data-testid="server-selector"
            className={`rounded-full font-display w-auto max-w-[150px] min-[400px]:max-w-[200px] sm:max-w-none sm:w-64 shrink-0 min-h-[44px] ${
              isSpatialMode &&
              activeZone === 'controls' &&
              focusIndex === serverControlIndex
                ? 'ring-2 ring-white ring-offset-2 ring-offset-black scale-[1.02] bg-white text-black font-semibold shadow-xl z-10'
                : ''
            }`}
          >
            <div className="flex items-center gap-1.5 sm:gap-2 min-w-0 flex-1 overflow-hidden">
              <span
                className="w-2 h-2 rounded-full bg-[#58cc02] shrink-0 shadow-[0_0_0_3px_rgba(88,204,2,0.25)]"
                data-testid="server-status-dot"
              />
              <span className="font-display font-bold text-xs sm:text-sm truncate leading-none">
                <ChunkySelectValue placeholder="Select server" />
              </span>
            </div>
          </ChunkySelectTrigger>
          <ChunkySelectContent>
            {sources.length > 1 && (
              <div
                data-testid="server-count-badge"
                className="font-sans font-bold text-[11px] text-[var(--muted)] bg-[var(--surface-raised)] border border-[var(--border)] px-2 py-1 rounded-full text-center leading-none mx-1 mb-1"
              >
                ({sources.length} available)
              </div>
            )}
            {sources.map((source, index) => {
              const isDirect =
                source.type === 's3' || source.type === 'direct';
              return (
                <ChunkySelectItem
                  key={source.id}
                  value={String(index)}
                  data-testid={`server-option-${index}`}
                  className="font-display"
                >
                  <span className="inline-flex items-center gap-2">
                    <span>{source.label}</span>
                    {source.quality && (
                      <span className="font-sans font-bold text-xs opacity-75">
                        · {source.quality}
                      </span>
                    )}
                    <span
                      data-testid={`server-badge-${index}`}
                      className={
                        isDirect
                          ? 'font-sans font-bold text-[10px] uppercase tracking-wide px-2 py-0.5 rounded-full bg-[#58cc02]/15 text-[#58cc02] border border-[#58cc02]/30 leading-none'
                          : 'font-sans font-bold text-[10px] uppercase tracking-wide px-2 py-0.5 rounded-full bg-[var(--surface-raised)] text-[var(--muted)] border border-[var(--border)] leading-none'
                      }
                    >
                      {isDirect ? 'Direct' : 'Embed'}
                    </span>
                  </span>
                </ChunkySelectItem>
              );
            })}
          </ChunkySelectContent>
        </ChunkySelect>
      </div>
    </div>
  );
}
