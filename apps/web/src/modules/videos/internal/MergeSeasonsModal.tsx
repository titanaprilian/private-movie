import { useState, useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  DragDropContext,
  Droppable,
  Draggable,
  type DropResult,
} from '@hello-pangea/dnd';
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
import { Checkbox } from '@/components/ui/checkbox';

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
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (open) {
      setOrderedSeasons([...seasons]);
      setSelectedIds(new Set(seasons.map((s) => s.id)));
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

  const toggleSeasonSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleDragEnd = (result: DropResult) => {
    if (!result.destination) return;
    const next = [...orderedSeasons];
    const [moved] = next.splice(result.source.index, 1);
    next.splice(result.destination.index, 0, moved);
    setOrderedSeasons(next);
  };

  const selectedSeasons = orderedSeasons.filter((s) => selectedIds.has(s.id));

  const handleMerge = () => {
    const orderedSeasonIds = selectedSeasons.map((s) => s.id);
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

        <DragDropContext onDragEnd={handleDragEnd}>
          <Droppable droppableId="seasons-list">
            {(droppableProvided) => (
              <div
                ref={droppableProvided.innerRef}
                {...droppableProvided.droppableProps}
                className="space-y-2 py-3 max-h-[350px] overflow-y-auto"
              >
                {orderedSeasons.length === 0 ? (
                  <div className="text-xs text-muted mono text-center py-4">
                    No duplicate seasons available to merge.
                  </div>
                ) : (
                  orderedSeasons.map((season, index) => {
                    const isSelected = selectedIds.has(season.id);
                    const selectedIndex = isSelected
                      ? selectedSeasons.findIndex((s) => s.id === season.id)
                      : -1;
                    const isPrimary = selectedIndex === 0;
                    const title = season.title || `Season ${season.tmdbSeason ?? index + 1}`;
                    const epCount = season.episodes?.length ?? 0;

                    return (
                      <Draggable key={season.id} draggableId={season.id} index={index}>
                        {(draggableProvided, snapshot) => (
                          <div
                            ref={draggableProvided.innerRef}
                            {...draggableProvided.draggableProps}
                            data-testid={`season-row-${season.id}`}
                            className={`flex items-center justify-between p-3 rounded border transition-colors ${
                              isPrimary
                                ? 'border-primary bg-primary/5 dark:bg-primary/10'
                                : isSelected
                                ? 'border-c bg-card hover-bg'
                                : 'border-c bg-card/50 opacity-60'
                            } ${snapshot.isDragging ? 'shadow-md bg-card border-primary' : ''}`}
                          >
                            <div className="flex items-center gap-3 min-w-0 flex-1">
                              <div
                                {...draggableProvided.dragHandleProps}
                                className="p-1 cursor-grab active:cursor-grabbing text-muted hover:text-current shrink-0"
                                title="Drag to reorder"
                                aria-label={`Reorder ${title}`}
                              >
                                <svg
                                  width="14"
                                  height="14"
                                  viewBox="0 0 24 24"
                                  fill="none"
                                  stroke="currentColor"
                                  strokeWidth="2"
                                >
                                  <circle cx="9" cy="5" r="1" />
                                  <circle cx="9" cy="12" r="1" />
                                  <circle cx="9" cy="19" r="1" />
                                  <circle cx="15" cy="5" r="1" />
                                  <circle cx="15" cy="12" r="1" />
                                  <circle cx="15" cy="19" r="1" />
                                </svg>
                              </div>

                              <Checkbox
                                checked={isSelected}
                                onCheckedChange={() => toggleSeasonSelect(season.id)}
                                aria-label={`Select ${title}`}
                                data-testid={`season-checkbox-${season.id}`}
                              />

                              <span
                                className={`text-xs mono font-bold w-5 h-5 rounded flex items-center justify-center shrink-0 ${
                                  isPrimary
                                    ? 'bg-primary text-primary-fg'
                                    : isSelected
                                    ? 'bg-sidebar border border-c text-muted'
                                    : 'bg-sidebar/50 border border-c/50 text-muted/50'
                                }`}
                              >
                                {isSelected ? selectedIndex + 1 : '-'}
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
                          </div>
                        )}
                      </Draggable>
                    );
                  })
                )}
                {droppableProvided.placeholder}
              </div>
            )}
          </Droppable>
        </DragDropContext>

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
            disabled={selectedSeasons.length < 2 || mergeMutation.isPending}
            onClick={handleMerge}
          >
            {mergeMutation.isPending ? 'Merging...' : 'Confirm Merge'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
