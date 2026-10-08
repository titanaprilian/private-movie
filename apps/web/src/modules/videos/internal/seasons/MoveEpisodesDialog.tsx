import { useEffect, useState } from 'react';
import type { SeasonDetails } from '../api';
import { getSeasonNumber } from './seasonUtils';
import {
  ChunkyDialog,
  ChunkyDialogContent,
  ChunkyDialogHeader,
  ChunkyDialogTitle,
  ChunkyDialogDescription,
  ChunkyDialogBody,
  ChunkyDialogFooter,
} from '@/components/ui/chunky-dialog';
import { ChunkyButton } from '@/components/ui/chunky-button';

export interface MoveEpisodesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  seasons: SeasonDetails[];
  currentSeasonId: string | null;
  selectedCount: number;
  episodeCountBySeason: Record<string, number>;
  isPending?: boolean;
  onConfirm: (targetSeasonId: string) => void;
}

export function MoveEpisodesDialog({
  open,
  onOpenChange,
  seasons,
  currentSeasonId,
  selectedCount,
  episodeCountBySeason,
  isPending = false,
  onConfirm,
}: MoveEpisodesDialogProps) {
  const destinations = seasons.filter((s) => s.id !== currentSeasonId);
  const [targetSeasonId, setTargetSeasonId] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setTargetSeasonId(null);
    }
  }, [open, currentSeasonId]);

  const handleConfirm = () => {
    if (!targetSeasonId || isPending) return;
    onConfirm(targetSeasonId);
  };

  return (
    <ChunkyDialog open={open} onOpenChange={onOpenChange}>
      <ChunkyDialogContent className="max-w-md">
        <ChunkyDialogHeader>
          <ChunkyDialogTitle>Move Episodes to Season</ChunkyDialogTitle>
          <ChunkyDialogDescription>
            Move {selectedCount} {selectedCount === 1 ? 'episode' : 'episodes'} to
            another season. Episodes are appended to the end of the destination
            season in order.
          </ChunkyDialogDescription>
        </ChunkyDialogHeader>
        <ChunkyDialogBody>
          {destinations.length === 0 ? (
            <p
              className="text-sm font-semibold text-[var(--muted)]"
              role="status"
            >
              No other seasons available. Create a new season first.
            </p>
          ) : (
            <div
              role="radiogroup"
              aria-label="Destination season"
              className="flex flex-col gap-2"
            >
              {destinations.map((season, index) => {
                const title =
                  season.title || `Season ${getSeasonNumber(season, index)}`;
                const count = episodeCountBySeason[season.id] ?? 0;
                const selected = targetSeasonId === season.id;
                return (
                  <button
                    key={season.id}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    aria-label={`${title} (${count} episodes)`}
                    onClick={() => setTargetSeasonId(season.id)}
                    className={`flex items-center justify-between gap-3 rounded-[14px] border-2 border-b-4 px-4 py-3 text-left font-extrabold text-[13px] transition-colors ${
                      selected
                        ? 'border-[var(--green)] bg-[var(--green-tint)] text-[var(--green)]'
                        : 'border-[var(--border)] bg-[var(--surface)] text-[var(--ink)]'
                    }`}
                  >
                    <span>{title}</span>
                    <span className="text-xs font-bold text-[var(--muted)]">
                      {count} {count === 1 ? 'episode' : 'episodes'}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </ChunkyDialogBody>
        <ChunkyDialogFooter>
          <ChunkyButton
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </ChunkyButton>
          <ChunkyButton
            type="button"
            disabled={!targetSeasonId || isPending}
            onClick={handleConfirm}
          >
            {isPending ? 'Moving...' : `Move ${selectedCount} ${selectedCount === 1 ? 'Episode' : 'Episodes'}`}
          </ChunkyButton>
        </ChunkyDialogFooter>
      </ChunkyDialogContent>
    </ChunkyDialog>
  );
}
