import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';

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
      className="sticky top-0 z-50 px-4 sm:px-8 md:px-12 lg:px-16 py-3 bg-black/60 backdrop-blur-md border-b border-white/10"
    >
      {onClick && (
        <Button
          ref={backRef}
          variant="ghost"
          size="sm"
          onClick={onClick}
          aria-label={ariaLabel}
          className={`gap-2 bg-black/50 backdrop-blur-md border border-white/20 text-white hover:bg-black/80 hover:text-white ${
            isSpatialMode && isBackFocused ? 'ring-2 ring-white' : ''
          }`}
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          <span>{label}</span>
        </Button>
      )}
    </div>
  );
}
