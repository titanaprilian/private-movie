import { BackButton } from '@/components/ui/back-button';
import type { WatchTopNavProps } from '../types';

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
      className={
        isPlayer
          ? 'sticky top-0 z-50 px-4 sm:px-8 md:px-12 lg:px-16 py-3 bg-[var(--bg)] border-b border-[var(--border)]'
          : 'sticky top-0 z-50 w-full pointer-events-none px-4 sm:px-8 md:px-12 lg:px-16 pt-4 sm:pt-6 -mb-16 sm:-mb-20'
      }
    >
      {onClick && (
        <div className="pointer-events-auto inline-block">
          <BackButton
            backRef={backRef}
            onClick={onClick}
            label={label}
            aria-label={ariaLabel}
            isFocused={isBackFocused}
            isSpatialMode={isSpatialMode}
          />
        </div>
      )}
    </div>
  );
}
