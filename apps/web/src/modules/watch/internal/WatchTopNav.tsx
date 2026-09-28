import { ChevronLeft } from 'lucide-react';

export type WatchTopNavMode = 'overview' | 'player';

export interface WatchTopNavProps {
  mode: WatchTopNavMode;
  /** Referrer-safe back to catalogue (overview mode). */
  onBackToCatalog?: () => void;
  /** Back to episode overview (player mode). */
  onBackToOverview?: () => void;
  isBackFocused?: boolean;
  isSpatialMode?: boolean;
  backRef?: React.Ref<HTMLButtonElement>;
}

export function WatchTopNav({
  mode,
  onBackToCatalog,
  onBackToOverview,
  isBackFocused,
  isSpatialMode,
  backRef,
}: WatchTopNavProps) {
  const isPlayer = mode === 'player';
  const label = isPlayer ? 'Back to Overview' : 'Back';
  const ariaLabel = isPlayer ? 'Back to series overview' : 'Back';
  const onClick = isPlayer ? onBackToOverview : onBackToCatalog;

  return (
    <div
      data-testid="watch-top-nav"
      className="sticky top-0 z-50 px-4 sm:px-8 md:px-12 lg:px-16 py-3 bg-[var(--bg)]/60 backdrop-blur-md border-b border-[var(--border)]"
    >
      {onClick && (
        <button
          ref={backRef}
          type="button"
          onClick={onClick}
          aria-label={ariaLabel}
          className={`inline-flex items-center gap-2 rounded-full bg-[var(--surface)] border-2 border-[#58cc02]/60 text-[var(--ink)] hover:border-[#58cc02] font-sans font-bold text-sm px-3.5 py-2 shadow-[0_3px_0_#46a302] active:translate-y-[2px] active:shadow-[0_1px_0_#46a302] transition-all cursor-pointer ${
            isSpatialMode && isBackFocused ? 'ring-2 ring-white' : ''
          }`}
        >
          <ChevronLeft className="h-4.5 w-4.5 stroke-[2.5]" aria-hidden="true" />
          <span>{label}</span>
        </button>
      )}
    </div>
  );
}
