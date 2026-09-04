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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { SeriesCombobox } from './SeriesCombobox';

export interface EditSeriesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  series: SeriesItem | SeriesDetails;
  seriesList?: SeriesItem[];
}

const EMPTY_SERIES_LIST: SeriesItem[] = [];

interface RelationSelection {
  relatedSeriesId: string;
  relationType: string;
  title?: string | null;
}

function sameIdList(a: string[], b: string[]): boolean {
  return a.length === b.length && a.every((v, i) => v === b[i]);
}

function sameRelations(a: RelationSelection[], b: RelationSelection[]): boolean {
  return (
    a.length === b.length &&
    a.every(
      (r, i) =>
        r.relatedSeriesId === b[i].relatedSeriesId &&
        r.relationType === b[i].relationType &&
        (r.title ?? null) === (b[i].title ?? null)
    )
  );
}

export function EditSeriesDialog({
  open,
  onOpenChange,
  series,
  seriesList = EMPTY_SERIES_LIST,
}: EditSeriesDialogProps) {
  const queryClient = useQueryClient();
  const { data: genres = [] } = useQuery(genresQueryOptions());

  const [editTitle, setEditTitle] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editPosterUrl, setEditPosterUrl] = useState('');
  const [editIsFeatured, setEditIsFeatured] = useState<boolean>(false);
  const [selectedGenreIds, setSelectedGenreIds] = useState<string[]>([]);
  const [selectedRelations, setSelectedRelations] = useState<
    Array<{ relatedSeriesId: string; relationType: string; title?: string | null }>
  >([]);
  const [newRelationId, setNewRelationId] = useState('');
  const [newRelationType, setNewRelationType] = useState('sequel');

  // Read via ref so the sync effect below doesn't depend on the caller's
  // array identity (an inline/default `[]` is a new reference every render,
  // which would re-trigger the effect and its setStates in an endless loop).
  const seriesListRef = useRef(seriesList);
  seriesListRef.current = seriesList;

  useEffect(() => {
    if (open && series) {
      setEditTitle(series.title ?? '');
      setEditDescription(series.description ?? '');
      setEditPosterUrl(series.posterUrl ?? '');
      setEditIsFeatured(Boolean(series.isFeatured));

      const knownSeriesList = seriesListRef.current;
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

      const initialRelations = (series.relations ?? []).map((r) => ({
        relatedSeriesId: r.relatedSeriesId,
        relationType: r.relationType,
        title: r.title ?? knownSeriesList.find((s) => s.id === r.relatedSeriesId)?.title ?? r.relatedSeriesId,
      }));
      setSelectedRelations((prev) =>
        sameRelations(prev, initialRelations) ? prev : initialRelations
      );
      setNewRelationId('');
      setNewRelationType('sequel');
    }
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
      isFeatured: editIsFeatured,
      genreIds: selectedGenreIds,
      relations: selectedRelations.map((r) => ({
        relatedSeriesId: r.relatedSeriesId,
        relationType: r.relationType,
      })),
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-w-[calc(100vw-2rem)] overflow-hidden">
        <DialogHeader>
          <DialogTitle>Edit Series</DialogTitle>
          <DialogDescription>
            Update series details, featured flag, and assigned genres or relations.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 py-2 min-w-0 max-w-full overflow-hidden">
          <Tabs defaultValue="details" className="w-full min-w-0 max-w-full overflow-hidden">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="details">Details</TabsTrigger>
              <TabsTrigger value="relations">Relations</TabsTrigger>
            </TabsList>

            {/* Details Tab */}
            <TabsContent value="details" className="space-y-4 pt-3">
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

              <div className="flex items-center space-x-2 py-1">
                <Checkbox
                  id="edit-series-featured"
                  checked={editIsFeatured}
                  onCheckedChange={(checked) => setEditIsFeatured(Boolean(checked))}
                />
                <Label htmlFor="edit-series-featured" className="cursor-pointer font-medium text-sm">
                  Featured Series
                </Label>
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
            </TabsContent>

            {/* Relations Tab */}
            <TabsContent value="relations" className="space-y-3 pt-3 min-w-0 max-w-full overflow-hidden">
              <div className="space-y-2 min-w-0 max-w-full overflow-hidden">
                <Label>Related Series</Label>

                {/* List of currently assigned relations */}
                {selectedRelations.length === 0 ? (
                  <p className="text-xs text-muted mono">No relations assigned.</p>
                ) : (
                  <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                    {selectedRelations.map((rel, index) => (
                      <div
                        key={`${rel.relatedSeriesId}-${index}`}
                        className="flex items-center justify-between p-2 rounded border border-c bg-sidebar text-xs gap-2 min-w-0"
                      >
                        <div className="flex items-center gap-2 overflow-hidden min-w-0 flex-1">
                          <span className="font-mono px-1.5 py-0.5 rounded border border-c bg-card text-[10px] uppercase text-muted shrink-0">
                            {rel.relationType}
                          </span>
                          <span
                            className="truncate font-medium min-w-0 flex-1 block"
                            title={rel.title || rel.relatedSeriesId}
                          >
                            {rel.title || rel.relatedSeriesId}
                          </span>
                        </div>
                        <button
                          type="button"
                          aria-label="Remove relation"
                          onClick={() => {
                            setSelectedRelations(
                              selectedRelations.filter((_, i) => i !== index)
                            );
                          }}
                          className="p-1 rounded text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors cursor-pointer shrink-0"
                        >
                          <svg
                            width="14"
                            height="14"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                          >
                            <line x1="18" y1="6" x2="6" y2="18" />
                            <line x1="6" y1="6" x2="18" y2="18" />
                          </svg>
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {/* Form controls to add a new relation edge */}
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 pt-2 border-t border-c min-w-0">
                  <div className="flex-1 min-w-0 space-y-1">
                    <Label htmlFor="add-relation-series" className="sr-only">
                      Related Series
                    </Label>
                    <SeriesCombobox
                      id="add-relation-series"
                      aria-label="Related Series"
                      value={newRelationId}
                      onValueChange={(val) => {
                        setNewRelationId(val);
                      }}
                      excludeSeriesId={series?.id}
                      initialSeriesList={seriesList}
                    />
                  </div>

                  <div className="w-full sm:w-36 shrink-0 space-y-1">
                    <Label htmlFor="add-relation-type" className="sr-only">
                      Relation Type
                    </Label>
                    <Input
                      id="add-relation-type"
                      aria-label="Relation Type"
                      value={newRelationType}
                      onChange={(e) => setNewRelationType(e.target.value)}
                      placeholder="Type (e.g. sequel)"
                      className="h-8 text-xs"
                    />
                  </div>

                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-8 px-3 text-xs shrink-0"
                    onClick={() => {
                      if (!newRelationId.trim() || !newRelationType.trim()) return;
                      const matched = seriesList.find((s) => s.id === newRelationId.trim());
                      setSelectedRelations([
                        ...selectedRelations,
                        {
                          relatedSeriesId: newRelationId.trim(),
                          relationType: newRelationType.trim(),
                          title: matched?.title ?? newRelationId.trim(),
                        },
                      ]);
                      setNewRelationId('');
                      setNewRelationType('sequel');
                    }}
                  >
                    Add Relation
                  </Button>
                </div>
              </div>
            </TabsContent>
          </Tabs>

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
