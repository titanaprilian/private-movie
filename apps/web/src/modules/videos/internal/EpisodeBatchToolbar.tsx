import { Button } from '@/components/ui/button';

export interface EpisodeBatchToolbarProps {
  selectedCount: number;
  onDeselectAll: () => void;
  onMoveToSeason: () => void;
  onDeleteSelected: () => void;
  disableMove?: boolean;
}

export function EpisodeBatchToolbar({
  selectedCount,
  onDeselectAll,
  onMoveToSeason,
  onDeleteSelected,
  disableMove = false,
}: EpisodeBatchToolbarProps) {
  if (selectedCount === 0) {
    return null;
  }

  return (
    <div
      role="toolbar"
      aria-label="Batch actions toolbar"
      className="p-2.5 px-3 rounded border border-c bg-sidebar flex flex-wrap items-center justify-between gap-3 text-xs"
    >
      <div className="flex items-center gap-2">
        <span className="inline-flex items-center justify-center px-2 py-0.5 rounded bg-primary/10 text-primary font-mono font-medium border border-primary/20">
          {selectedCount} selected
        </span>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={onDeselectAll}
          className="h-7 px-2 text-xs mono text-muted hover:text-fg"
        >
          Deselect All
        </Button>
      </div>

      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant="secondary"
          size="sm"
          disabled={disableMove}
          onClick={onMoveToSeason}
          className="h-7 px-2.5 text-xs flex items-center gap-1.5"
          title={disableMove ? 'At least two seasons are required to move episodes' : 'Move selected episodes to another season'}
        >
          <svg
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="shrink-0"
          >
            <path d="M15 3h6v6" />
            <path d="M10 14L21 3" />
            <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
          </svg>
          <span>Move to Season</span>
        </Button>

        <Button
          type="button"
          variant="destructive"
          size="sm"
          onClick={onDeleteSelected}
          className="h-7 px-2.5 text-xs flex items-center gap-1.5"
        >
          <svg
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="shrink-0"
          >
            <path d="M3 6h18" />
            <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
          </svg>
          <span>Delete Selected</span>
        </Button>
      </div>
    </div>
  );
}
