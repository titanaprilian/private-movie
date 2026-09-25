import { useState, useEffect, useRef } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { updateSeries, type SeriesDetails, type SeriesItem } from './api';
import { genresQueryOptions } from '@/modules/genres';
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
import { Checkbox } from '@/components/ui/checkbox';

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
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-w-[calc(100vw-2rem)] max-h-[90vh] flex flex-col overflow-hidden">
        <DialogHeader>
          <DialogTitle>Edit Series</DialogTitle>
          <DialogDescription>
            Update series details, featured and highlight flags, and assigned genres.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0 min-w-0 max-w-full overflow-hidden">
          <div className="flex-1 overflow-y-auto pr-1 space-y-4 py-2 min-w-0">
          <div className="space-y-1.5">
            <Label htmlFor="edit-series-title">Title</Label>
            <Input
              id="edit-series-title"
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value)}
              placeholder="Series title"
              required
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="edit-series-description">Description</Label>
            <textarea
              id="edit-series-description"
              rows={3}
              value={editDescription}
              onChange={(e) => setEditDescription(e.target.value)}
              placeholder="Series description"
              className="flex w-full rounded border border-c bg-transparent px-3 py-2 text-sm shadow-sm transition-colors placeholder:text-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)] focus-visible:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-50"
            />
          </div>

          <div className="flex flex-wrap items-center gap-6 py-1">
            <div className="flex items-center space-x-2">
              <Checkbox
                id="edit-series-featured"
                checked={editIsFeatured}
                onCheckedChange={(checked) => setEditIsFeatured(Boolean(checked))}
              />
              <Label htmlFor="edit-series-featured" className="cursor-pointer font-medium text-sm">
                Featured Series
              </Label>
            </div>

            <div className="flex items-center space-x-2">
              <Checkbox
                id="edit-series-highlighted"
                checked={editIsOngoingHighlighted}
                onCheckedChange={(checked) => setEditIsOngoingHighlighted(Boolean(checked))}
              />
              <Label htmlFor="edit-series-highlighted" className="cursor-pointer font-medium text-sm">
                Highlight in Ongoing Feed
              </Label>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="edit-series-poster">Poster URL</Label>
            <Input
              id="edit-series-poster"
              value={editPosterUrl}
              onChange={(e) => setEditPosterUrl(e.target.value)}
              placeholder="https://..."
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="edit-series-logo">Logo URL</Label>
            <Input
              id="edit-series-logo"
              value={editLogoUrl}
              onChange={(e) => {
                setEditLogoUrl(e.target.value);
                setLogoPreviewError(false);
              }}
              placeholder="https://..."
            />
            {editLogoUrl.trim() !== '' && (
              <div className="rounded border border-c bg-sidebar p-2">
                {logoPreviewError ? (
                  <p className="text-xs text-muted">Failed to load logo preview</p>
                ) : (
                  <img
                    src={editLogoUrl.trim()}
                    alt="Logo preview"
                    className="max-h-12 w-auto object-contain"
                    onError={() => setLogoPreviewError(true)}
                  />
                )}
              </div>
            )}
          </div>

          {/* Interactive multi-select for genres */}
          <div className="space-y-1.5">
            <Label>Genres</Label>
            {genres.length === 0 ? (
              <p className="text-xs text-muted mono">No genres available.</p>
            ) : (
              <div className="flex flex-wrap gap-1.5 p-2 rounded border border-c bg-sidebar max-h-36 overflow-y-auto">
                {genres.map((genre) => {
                  const isSelected = selectedGenreIds.includes(genre.id);
                  return (
                    <button
                      key={genre.id}
                      type="button"
                      onClick={() => {
                        if (isSelected) {
                          setSelectedGenreIds(selectedGenreIds.filter((id) => id !== genre.id));
                        } else {
                          setSelectedGenreIds([...selectedGenreIds, genre.id]);
                        }
                      }}
                      className={`px-2.5 py-1 rounded text-xs mono font-medium border transition-colors cursor-pointer ${
                        isSelected
                          ? 'bg-primary text-primary-fg border-primary'
                          : 'border-c hover-bg text-muted bg-card'
                      }`}
                    >
                      {genre.name}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          </div>

          <DialogFooter className="pt-2">
            <Button
              type="button"
              variant="secondary"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={updateMutation.isPending}>
              {updateMutation.isPending ? 'Saving...' : 'Save Changes'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
