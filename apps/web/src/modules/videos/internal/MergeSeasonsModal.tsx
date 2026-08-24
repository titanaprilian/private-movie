import { useState, useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { mergeSeasons, type SeasonDetails } from './api';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

export interface MergeSeasonsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  seriesId: string;
  seasons: SeasonDetails[];
}

export function MergeSeasonsModal({
  open,
  onOpenChange,
  seriesId,
  seasons,
}: MergeSeasonsModalProps) {
  const queryClient = useQueryClient();
  const [orderedSeasons, setOrderedSeasons] = useState<SeasonDetails[]>([]);

  useEffect(() => {
    if (open) {
      setOrderedSeasons([...seasons]);
    }
  }, [open, seasons]);

  const mergeMutation = useMutation({
    mutationFn: (orderedIds: string[]) => mergeSeasons(seriesId, orderedIds),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['series', seriesId] });
      queryClient.invalidateQueries({ queryKey: ['series'] });
      toast.success('Seasons merged successfully');
      onOpenChange(false);
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to merge seasons');
    },
  });

  const moveSeason = (index: number, direction: 'up' | 'down') => {
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= orderedSeasons.length) return;

    const next = [...orderedSeasons];
    const [moved] = next.splice(index, 1);
    next.splice(targetIndex, 0, moved);
    setOrderedSeasons(next);
  };

  const handleMerge = () => {
    const orderedSeasonIds = orderedSeasons.map((s) => s.id);
    mergeMutation.mutate(orderedSeasonIds);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Merge Seasons</DialogTitle>
          <DialogDescription>
            Arrange duplicate seasons in chronological order. The top (1st) season will be kept as the primary season, all episodes will be renumbered sequentially across seasons, and duplicate season records will be deleted.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2 py-3 max-h-[350px] overflow-y-auto">
          {orderedSeasons.length === 0 ? (
            <div className="text-xs text-muted mono text-center py-4">
              No duplicate seasons available to merge.
            </div>
          ) : (
            orderedSeasons.map((season, index) => {
              const isPrimary = index === 0;
              const title = season.title || `Season ${season.tmdbSeason ?? index + 1}`;
              const epCount = season.episodes?.length ?? 0;

              return (
                <div
                  key={season.id}
                  data-testid={`season-row-${season.id}`}
                  className={`flex items-center justify-between p-3 rounded border transition-colors ${
                    isPrimary
                      ? 'border-primary bg-primary/5 dark:bg-primary/10'
                      : 'border-c bg-card hover-bg'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <span
                      className={`text-xs mono font-bold w-5 h-5 rounded flex items-center justify-center shrink-0 ${
                        isPrimary
                          ? 'bg-primary text-primary-fg'
                          : 'bg-sidebar border border-c text-muted'
                      }`}
                    >
                      {index + 1}
                    </span>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-medium truncate">{title}</span>
                        {isPrimary && (
                          <span className="text-[10px] mono font-semibold px-2 py-0.5 rounded bg-primary text-primary-fg">
                            Primary Season
                          </span>
                        )}
                      </div>
                      <div className="text-xs mono text-muted mt-0.5 truncate">
                        {epCount} {epCount === 1 ? 'episode' : 'episodes'}
                        {season.sourceUrl && ` • ${season.sourceUrl}`}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-1 shrink-0 ml-2">
                    <button
                      type="button"
                      disabled={index === 0}
                      onClick={() => moveSeason(index, 'up')}
                      aria-label={`Move ${title} up`}
                      className="p-1.5 rounded border border-c hover-bg disabled:opacity-30 disabled:cursor-not-allowed text-muted hover:text-current transition cursor-pointer"
                    >
                      <svg
                        width="14"
                        height="14"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                      >
                        <path d="M18 15l-6-6-6 6" />
                      </svg>
                    </button>
                    <button
                      type="button"
                      disabled={index === orderedSeasons.length - 1}
                      onClick={() => moveSeason(index, 'down')}
                      aria-label={`Move ${title} down`}
                      className="p-1.5 rounded border border-c hover-bg disabled:opacity-30 disabled:cursor-not-allowed text-muted hover:text-current transition cursor-pointer"
                    >
                      <svg
                        width="14"
                        height="14"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                      >
                        <path d="M6 9l6 6 6-6" />
                      </svg>
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            type="button"
            variant="secondary"
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button
            type="button"
            disabled={orderedSeasons.length < 2 || mergeMutation.isPending}
            onClick={handleMerge}
          >
            {mergeMutation.isPending ? 'Merging...' : 'Confirm Merge'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
