import { useState, useEffect, useRef } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';
import { updateSeries, type SeriesDetails, type SeriesItem } from './api';
import { genresQueryOptions } from '@/modules/genres';
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

export interface EditSeriesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  series: SeriesItem | SeriesDetails;
  seriesList?: SeriesItem[];
}

const EMPTY_SERIES_LIST: SeriesItem[] = [];

function sameIdList(a: string[], b: string[]): boolean {
  return a.length === b.length && a.every((v, i) => v === b[i]);
}

export function EditSeriesDialog({
  open,
  onOpenChange,
  series,
  seriesList = EMPTY_SERIES_LIST,
}: EditSeriesDialogProps) {
  // seriesList is retained for backwards compatibility but no longer used
  void seriesList;
  const queryClient = useQueryClient();
  const { data: genres = [] } = useQuery(genresQueryOptions());

  const [editTitle, setEditTitle] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editPosterUrl, setEditPosterUrl] = useState('');
  const [editLogoUrl, setEditLogoUrl] = useState('');
  const [logoPreviewError, setLogoPreviewError] = useState(false);
  const [editIsFeatured, setEditIsFeatured] = useState<boolean>(false);
  const [editIsOngoingHighlighted, setEditIsOngoingHighlighted] =
    useState<boolean>(false);
  const [selectedGenreIds, setSelectedGenreIds] = useState<string[]>([]);
  const wasOpenRef = useRef(false);

  useEffect(() => {
    if (open && series) {
      // Only sync text/flag state on the open transition so fresh inline
      // `series` object identities on re-render don't wipe user edits.
      if (!wasOpenRef.current) {
        setEditTitle(series.title ?? '');
        setEditDescription(series.description ?? '');
        setEditPosterUrl(series.posterUrl ?? '');
        setEditLogoUrl(series.logoUrl ?? '');
        setLogoPreviewError(false);
        setEditIsFeatured(Boolean(series.isFeatured));
        setEditIsOngoingHighlighted(Boolean(series.isOngoingHighlighted));
      }

      let initialGenreIds: string[] = [];
      if ('genreIds' in series && series.genreIds && Array.isArray(series.genreIds) && series.genreIds.length > 0) {
        initialGenreIds = series.genreIds;
      } else if ('genres' in series && series.genres && Array.isArray(series.genres)) {
        initialGenreIds = series.genres
          .map((g) => {
            if (typeof g === 'string') {
              const found = genres.find((genre) => genre.id === g || genre.slug === g || genre.name === g);
              return found ? found.id : g;
            }
            return g.id;
          })
          .filter(Boolean);
      }
      setSelectedGenreIds((prev) =>
        sameIdList(prev, initialGenreIds) ? prev : initialGenreIds
      );
    }
    wasOpenRef.current = open;
  }, [open, series, genres]);

  const updateMutation = useMutation({
    mutationFn: (data: Parameters<typeof updateSeries>[1]) =>
      updateSeries(series.id, data),
    onSuccess: (updated) => {
      queryClient.invalidateQueries({ queryKey: ['series'] });
      toast.success('series.update', {
        description: `Successfully updated ${updated.title}`,
      });
      onOpenChange(false);
    },
    onError: (error: Error) => {
      toast.error('series.update', {
        description: `Failed to update series: ${error.message}`,
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!series) return;
    updateMutation.mutate({
      title: editTitle,
      description: editDescription || null,
      posterUrl: editPosterUrl || null,
      logoUrl: editLogoUrl.trim() === '' ? null : editLogoUrl.trim(),
      isFeatured: editIsFeatured,
      isOngoingHighlighted: editIsOngoingHighlighted,
      genreIds: selectedGenreIds,
    });
  };

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
              onChange={(e) => {
                setEditLogoUrl(e.target.value);
                setLogoPreviewError(false);
              }}
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
                        onClick={() => {
                          if (isSelected) {
                            setSelectedGenreIds(selectedGenreIds.filter((id) => id !== genre.id));
                          } else {
                            setSelectedGenreIds([...selectedGenreIds, genre.id]);
                          }
                        }}
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
