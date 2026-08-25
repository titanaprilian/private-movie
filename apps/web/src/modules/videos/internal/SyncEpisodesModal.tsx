import { useState, useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  getSeasonTmdbPreview,
  syncSeasonTmdb,
  type SeasonDetails,
  type SeasonTmdbPreviewResult,
} from './api';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export interface SyncEpisodesModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  seriesId: string;
  season: SeasonDetails;
  defaultTmdbId?: number | null;
}

export function SyncEpisodesModal({
  open,
  onOpenChange,
  seriesId,
  season,
  defaultTmdbId,
}: SyncEpisodesModalProps) {
  const queryClient = useQueryClient();

  const [step, setStep] = useState<1 | 2>(1);
  const [tmdbIdInput, setTmdbIdInput] = useState<string>('');
  const [tmdbSeasonInput, setTmdbSeasonInput] = useState<string>('');
  const [previewData, setPreviewData] = useState<SeasonTmdbPreviewResult | null>(
    null
  );

  useEffect(() => {
    if (open) {
      setStep(1);
      setPreviewData(null);
      const initialTmdbId = season.tmdbId ?? defaultTmdbId ?? '';
      const initialSeasonNumber = season.tmdbSeason ?? 1;
      setTmdbIdInput(initialTmdbId ? String(initialTmdbId) : '');
      setTmdbSeasonInput(String(initialSeasonNumber));
    }
  }, [open, season, defaultTmdbId]);

  const previewMutation = useMutation({
    mutationFn: async () => {
      const parsedTmdbId = tmdbIdInput ? parseInt(tmdbIdInput, 10) : undefined;
      const parsedTmdbSeason = tmdbSeasonInput
        ? parseInt(tmdbSeasonInput, 10)
        : undefined;

      const options = {
        tmdbId: Number.isNaN(parsedTmdbId) ? undefined : parsedTmdbId,
        tmdbSeason: Number.isNaN(parsedTmdbSeason) ? undefined : parsedTmdbSeason,
      };

      return getSeasonTmdbPreview(season.id, options);
    },
    onSuccess: (data) => {
      setPreviewData(data);
      setStep(2);
    },
    onError: (error: Error) => {
      toast.error('Sync Preview Error', {
        description: error.message || 'Failed to fetch TMDB episode preview',
      });
    },
  });

  const syncMutation = useMutation({
    mutationFn: async () => {
      const parsedTmdbId = tmdbIdInput ? parseInt(tmdbIdInput, 10) : undefined;
      const parsedTmdbSeason = tmdbSeasonInput
        ? parseInt(tmdbSeasonInput, 10)
        : undefined;

      const options = {
        tmdbId: Number.isNaN(parsedTmdbId) ? undefined : parsedTmdbId,
        tmdbSeason: Number.isNaN(parsedTmdbSeason) ? undefined : parsedTmdbSeason,
      };

      return syncSeasonTmdb(season.id, options);
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['series', seriesId] });
      queryClient.invalidateQueries({ queryKey: ['series'] });
      toast.success('Episodes Synced', {
        description: `Successfully updated ${result.updatedCount} episodes and inserted ${result.insertedCount} stubs.`,
      });
      onOpenChange(false);
    },
    onError: (error: Error) => {
      toast.error('Sync Execution Failed', {
        description: error.message || 'Failed to sync episodes with TMDB',
      });
    },
  });

  const handleFetchPreview = (e: React.FormEvent) => {
    e.preventDefault();
    previewMutation.mutate();
  };

  const handleConfirmSync = () => {
    syncMutation.mutate();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Sync Season Episodes from TMDB</DialogTitle>
          <DialogDescription>
            {step === 1
              ? 'Enter TMDB details to preview metadata updates and missing episode insertions.'
              : 'Review planned episode updates and stub insertions before confirming synchronization.'}
          </DialogDescription>
        </DialogHeader>

        {step === 1 && (
          <form onSubmit={handleFetchPreview} className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="sync-tmdb-id">TMDB Series ID (Optional if season linked)</Label>
              <Input
                id="sync-tmdb-id"
                type="number"
                placeholder="e.g. 12345"
                value={tmdbIdInput}
                onChange={(e) => setTmdbIdInput(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="sync-tmdb-season">TMDB Season Number</Label>
              <Input
                id="sync-tmdb-season"
                type="number"
                placeholder="e.g. 1"
                value={tmdbSeasonInput}
                onChange={(e) => setTmdbSeasonInput(e.target.value)}
              />
            </div>

            <DialogFooter className="pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={previewMutation.isPending}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={previewMutation.isPending}>
                {previewMutation.isPending ? 'Fetching Preview...' : 'Preview Sync'}
              </Button>
            </DialogFooter>
          </form>
        )}

        {step === 2 && previewData && (
          <div className="space-y-4 py-2 overflow-y-auto flex-1 pr-1">
            {/* Summary statistics */}
            <div className="grid grid-cols-3 gap-2 text-center text-xs mono">
              <div className="p-2 rounded border border-c bg-card">
                <span className="font-bold text-base block text-blue-500">
                  {previewData.updates.length}
                </span>
                <span>Updates</span>
              </div>
              <div className="p-2 rounded border border-c bg-card">
                <span className="font-bold text-base block text-green-500">
                  {previewData.inserts.length}
                </span>
                <span>New Stubs</span>
              </div>
              <div className="p-2 rounded border border-c bg-card">
                <span className="font-bold text-base block text-amber-500">
                  {previewData.unmapped.length}
                </span>
                <span>Unmapped (Kept)</span>
              </div>
            </div>

            {/* Updates list */}
            {previewData.updates.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-xs font-semibold uppercase tracking-wider text-muted mono">
                  Episodes to Update ({previewData.updates.length})
                </h4>
                <div className="space-y-1.5 max-h-48 overflow-y-auto border border-c rounded p-2 text-xs">
                  {previewData.updates.map((item) => (
                    <div
                      key={item.id}
                      className="p-2 rounded bg-muted/40 border border-c/50 flex flex-col gap-1"
                    >
                      <div className="flex items-center justify-between font-medium">
                        <span>Episode {item.order}</span>
                        {item.tmdbId && (
                          <span className="text-[10px] text-muted mono">
                            TMDB #{item.tmdbId}
                          </span>
                        )}
                      </div>
                      <div className="flex flex-col gap-0.5 text-muted-foreground">
                        {item.existingTitle !== item.newTitle ? (
                          <div>
                            <span className="line-through text-red-500/80 mr-2">
                              {item.existingTitle}
                            </span>
                            <span className="text-green-600 dark:text-green-400 font-semibold">
                              → {item.newTitle}
                            </span>
                          </div>
                        ) : (
                          <div className="text-foreground">{item.newTitle}</div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Inserts list */}
            {previewData.inserts.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-xs font-semibold uppercase tracking-wider text-muted mono">
                  New Episodes to Insert ({previewData.inserts.length})
                </h4>
                <div className="space-y-1.5 max-h-48 overflow-y-auto border border-c rounded p-2 text-xs">
                  {previewData.inserts.map((item) => (
                    <div
                      key={item.order}
                      className="p-2 rounded bg-green-500/10 border border-green-500/30 flex items-center justify-between"
                    >
                      <div>
                        <span className="font-semibold mr-2">
                          Episode {item.order}:
                        </span>
                        <span>{item.title}</span>
                      </div>
                      {item.airDate && (
                        <span className="text-[10px] text-muted mono">
                          {item.airDate}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Unmapped list */}
            {previewData.unmapped.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-xs font-semibold uppercase tracking-wider text-muted mono">
                  Unmapped Local Episodes (Preserved - {previewData.unmapped.length})
                </h4>
                <div className="space-y-1 max-h-36 overflow-y-auto border border-c rounded p-2 text-xs text-muted-foreground">
                  {previewData.unmapped.map((item) => (
                    <div key={item.id} className="py-0.5">
                      Episode {item.order}: {item.title}
                    </div>
                  ))}
                </div>
              </div>
            )}

            <DialogFooter className="pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => setStep(1)}
                disabled={syncMutation.isPending}
              >
                Back
              </Button>
              <Button
                type="button"
                onClick={handleConfirmSync}
                disabled={syncMutation.isPending}
              >
                {syncMutation.isPending ? 'Syncing...' : 'Confirm & Sync'}
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
