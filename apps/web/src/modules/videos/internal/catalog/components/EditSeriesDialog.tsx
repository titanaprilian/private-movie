import { Loader2 } from 'lucide-react';
import type { EditSeriesDialogProps } from '../types';
export type { EditSeriesDialogProps } from '../types';
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
import { ChunkyInput } from '@/components/ui/chunky-input';
import { ChunkyTextarea } from '@/components/ui/chunky-textarea';
import { ChunkyCheckbox } from '@/components/ui/chunky-checkbox';
import { ChunkyChip } from '@/components/ui/chunky-chip';
import { useEditSeriesForm } from '../hooks/useEditSeriesForm';

export function EditSeriesDialog({
  open,
  onOpenChange,
  series,
  seriesList = [],
}: EditSeriesDialogProps) {
  // seriesList is retained for backwards compatibility but no longer used
  void seriesList;
  const {
    genres,
    editTitle,
    setEditTitle,
    editDescription,
    setEditDescription,
    editPosterUrl,
    setEditPosterUrl,
    editLogoUrl,
    handleLogoUrlChange,
    logoPreviewError,
    setLogoPreviewError,
    editIsFeatured,
    setEditIsFeatured,
    editIsOngoingHighlighted,
    setEditIsOngoingHighlighted,
    selectedGenreIds,
    toggleGenre,
    updateMutation,
    handleSubmit,
  } = useEditSeriesForm({ open, series, onOpenChange });

  return (
    <ChunkyDialog open={open} onOpenChange={onOpenChange}>
      <ChunkyDialogContent className="max-h-[90vh] sm:max-w-lg">
        <ChunkyDialogHeader>
          <ChunkyDialogTitle>Edit Series</ChunkyDialogTitle>
          <ChunkyDialogDescription>
            Update series details, featured and highlight flags, and assigned genres.
          </ChunkyDialogDescription>
        </ChunkyDialogHeader>
        <form onSubmit={handleSubmit} className="flex min-h-0 min-w-0 max-w-full flex-1 flex-col overflow-hidden">
          <ChunkyDialogBody className="min-w-0 space-y-4">
          <div className="space-y-1.5">
            <label htmlFor="edit-series-title" className="mb-1.5 block text-sm font-bold text-[var(--ink)]">
              Title
            </label>
            <ChunkyInput
              id="edit-series-title"
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value)}
              placeholder="Series title"
              required
            />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="edit-series-description" className="mb-1.5 block text-sm font-bold text-[var(--ink)]">
              Description
            </label>
            <ChunkyTextarea
              id="edit-series-description"
              rows={3}
              value={editDescription}
              onChange={(e) => setEditDescription(e.target.value)}
              placeholder="Series description"
            />
          </div>

          <div className="flex flex-wrap items-center gap-6 py-1">
            <div className="flex items-center space-x-2">
              <ChunkyCheckbox
                id="edit-series-featured"
                checked={editIsFeatured}
                onCheckedChange={setEditIsFeatured}
              />
              <label htmlFor="edit-series-featured" className="cursor-pointer select-none text-sm font-bold text-[var(--muted)]">
                Featured Series
              </label>
            </div>

            <div className="flex items-center space-x-2">
              <ChunkyCheckbox
                id="edit-series-highlighted"
                checked={editIsOngoingHighlighted}
                onCheckedChange={setEditIsOngoingHighlighted}
              />
              <label htmlFor="edit-series-highlighted" className="cursor-pointer select-none text-sm font-bold text-[var(--muted)]">
                Highlight in Ongoing Feed
              </label>
            </div>
          </div>

          <div className="space-y-1.5">
            <label htmlFor="edit-series-poster" className="mb-1.5 block text-sm font-bold text-[var(--ink)]">
              Poster URL
            </label>
            <ChunkyInput
              id="edit-series-poster"
              value={editPosterUrl}
              onChange={(e) => setEditPosterUrl(e.target.value)}
              placeholder="https://..."
            />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="edit-series-logo" className="mb-1.5 block text-sm font-bold text-[var(--ink)]">
              Logo URL
            </label>
            <ChunkyInput
              id="edit-series-logo"
              value={editLogoUrl}
              onChange={(e) => handleLogoUrlChange(e.target.value)}
              placeholder="https://..."
            />
            {editLogoUrl.trim() !== '' && (
              <div className="rounded-2xl border-2 border-[var(--border)] bg-[var(--bg)] p-2">
                {logoPreviewError ? (
                  <p className="text-xs font-bold text-[var(--muted)]">Failed to load logo preview</p>
                ) : (
                  <img
                    src={editLogoUrl.trim()}
                    alt="Logo preview"
                    className="max-h-12 w-auto rounded-xl object-contain"
                    onError={() => setLogoPreviewError(true)}
                  />
                )}
              </div>
            )}
          </div>

          {/* Interactive multi-select for genres */}
          <div className="space-y-1.5">
            <span className="mb-1.5 block text-sm font-bold text-[var(--ink)]">Genres</span>
            {genres.length === 0 ? (
              <p className="mono text-xs text-muted">No genres available.</p>
            ) : (
              <div className="max-h-36 overflow-y-auto rounded-2xl border-2 border-[var(--border)] bg-[var(--bg)] p-2">
                <div className="flex flex-wrap gap-1.5">
                  {genres.map((genre) => {
                    const isSelected = selectedGenreIds.includes(genre.id);
                    return (
                      <ChunkyChip
                        key={genre.id}
                        type="button"
                        variant={isSelected ? 'active' : 'default'}
                        pressed={isSelected}
                        onClick={() => toggleGenre(genre.id)}
                      >
                        {genre.name}
                      </ChunkyChip>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          </ChunkyDialogBody>

          <ChunkyDialogFooter>
            <ChunkyButton
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </ChunkyButton>
            <ChunkyButton type="submit" variant="primary" disabled={updateMutation.isPending}>
              {updateMutation.isPending && (
                <Loader2 className="animate-spin" aria-hidden="true" />
              )}
              {updateMutation.isPending ? 'Saving...' : 'Save Changes'}
            </ChunkyButton>
          </ChunkyDialogFooter>
        </form>
      </ChunkyDialogContent>
    </ChunkyDialog>
  );
}
