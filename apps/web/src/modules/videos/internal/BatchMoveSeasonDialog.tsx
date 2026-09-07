import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import type { SeriesDetails } from './api';

export type Season = NonNullable<SeriesDetails['seasons']>[number];

export interface BatchMoveSeasonDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedEpisodeCount: number;
  seasons: Season[];
  currentSeasonId?: string | null;
  onConfirmMove: (targetSeasonId: string) => void;
  isPending?: boolean;
}

export function BatchMoveSeasonDialog({
  open,
  onOpenChange,
  selectedEpisodeCount,
  seasons,
  currentSeasonId,
  onConfirmMove,
  isPending = false,
}: BatchMoveSeasonDialogProps) {
  const availableSeasons = seasons.filter((s) => s.id !== currentSeasonId);
  const [selectedTargetSeasonId, setSelectedTargetSeasonId] = useState<string>(
    availableSeasons[0]?.id ?? ''
  );

  const effectiveTargetSeasonId =
    selectedTargetSeasonId || availableSeasons[0]?.id || '';

  const handleConfirm = () => {
    if (!effectiveTargetSeasonId) return;
    onConfirmMove(effectiveTargetSeasonId);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Move Episodes to Season</DialogTitle>
          <DialogDescription>
            Select a target season to move {selectedEpisodeCount}{' '}
            {selectedEpisodeCount === 1 ? 'episode' : 'episodes'}. Their order numbers will be appended to the end of the destination season.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-2">
          <div className="space-y-1.5">
            <Label htmlFor="target-season-select">Destination Season</Label>
            <select
              id="target-season-select"
              value={effectiveTargetSeasonId}
              onChange={(e) => setSelectedTargetSeasonId(e.target.value)}
              className="flex w-full rounded border border-c bg-card px-3 py-2 text-xs mono focus:outline-none focus:border-primary"
              aria-label="Select destination season"
            >
              {availableSeasons.map((season, idx) => (
                <option key={season.id} value={season.id}>
                  {season.title || `Season ${season.tmdbSeason ?? idx + 1}`}
                </option>
              ))}
            </select>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            type="button"
            variant="secondary"
            onClick={() => onOpenChange(false)}
            disabled={isPending}
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={handleConfirm}
            disabled={!effectiveTargetSeasonId || isPending}
          >
            {isPending ? 'Moving...' : 'Move Episodes'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
