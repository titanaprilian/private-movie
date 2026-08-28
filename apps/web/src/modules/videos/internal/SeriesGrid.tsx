import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient, useSuspenseQuery } from '@tanstack/react-query';
import { Link, useNavigate, useSearch } from '@tanstack/react-router';
import { toast } from 'sonner';
import { genresQueryOptions } from '@/modules/genres';
import {
  seriesListQueryOptions,
  updateSeries,
  deleteSeries,
  type SeriesItem,
} from './api';
import { AddMediaDialog } from './AddMediaDialog';
import { useScrapeWorkerStore } from './store/useScrapeWorkerStore';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { SeriesCombobox } from './SeriesCombobox';

export function SeriesGrid() {
  const search = useSearch({ from: '/admin/videos/' }) as {
    page?: number;
    q?: string;
    genre?: string;
  };
  const navigate = useNavigate({ from: '/admin/videos/' });
  const openDialog = useScrapeWorkerStore((state) => state.openDialog);
  const queryClient = useQueryClient();

  const { data } = useSuspenseQuery(seriesListQueryOptions(search));
  const { data: genres = [] } = useQuery(genresQueryOptions());

  const [inputValue, setInputValue] = useState(search.q ?? '');
  const [editingSeries, setEditingSeries] = useState<SeriesItem | null>(null);
  const [deletingSeries, setDeletingSeries] = useState<SeriesItem | null>(null);

  const [editTitle, setEditTitle] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editPosterUrl, setEditPosterUrl] = useState('');
  const [selectedGenreIds, setSelectedGenreIds] = useState<string[]>([]);
  const [selectedRelations, setSelectedRelations] = useState<
    Array<{ relatedSeriesId: string; relationType: string; title?: string | null }>
  >([]);
  const [newRelationId, setNewRelationId] = useState('');
  const [newRelationType, setNewRelationType] = useState('sequel');

  useEffect(() => {
    setInputValue(search.q ?? '');
  }, [search.q]);

  useEffect(() => {
    const handler = setTimeout(() => {
      const trimmed = inputValue.trim();
      const currentQ = search.q ?? '';
      if (trimmed !== currentQ) {
        navigate({
          search: (old: Record<string, unknown>) => ({
            ...old,
            q: trimmed || undefined,
            page: 1,
          }),
        });
      }
    }, 500);

    return () => {
      clearTimeout(handler);
    };
  }, [inputValue, search.q, navigate]);

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Parameters<typeof updateSeries>[1] }) =>
      updateSeries(id, data),
    onSuccess: (updated) => {
      queryClient.invalidateQueries({ queryKey: ['series'] });
      toast.success('series.update', {
        description: `Successfully updated ${updated.title}`,
      });
      setEditingSeries(null);
    },
    onError: (error: Error) => {
      toast.error('series.update', {
        description: `Failed to update series: ${error.message}`,
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteSeries(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['series'] });
      toast.success('series.delete', {
        description: 'Successfully deleted series',
      });
      setDeletingSeries(null);
    },
    onError: (error: Error) => {
      toast.error('series.delete', {
        description: `Failed to delete series: ${error.message}`,
      });
    },
  });

  const handleOpenEdit = (item: SeriesItem, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setEditingSeries(item);
    setEditTitle(item.title ?? '');
    setEditDescription(item.description ?? '');
    setEditPosterUrl(item.posterUrl ?? '');

    let initialGenreIds: string[] = [];
    if (item.genreIds && Array.isArray(item.genreIds) && item.genreIds.length > 0) {
      initialGenreIds = item.genreIds;
    } else if (item.genres && Array.isArray(item.genres)) {
      initialGenreIds = item.genres
        .map((g) => {
          if (typeof g === 'string') {
            const found = genres.find((genre) => genre.id === g || genre.slug === g || genre.name === g);
            return found ? found.id : g;
          }
          return g.id;
        })
        .filter(Boolean);
    }
    setSelectedGenreIds(initialGenreIds);

    const seriesListForLookup = data?.series ?? [];
    const initialRelations = (item.relations ?? []).map((r) => ({
      relatedSeriesId: r.relatedSeriesId,
      relationType: r.relationType,
      title: r.title ?? seriesListForLookup.find((s) => s.id === r.relatedSeriesId)?.title ?? r.relatedSeriesId,
    }));
    setSelectedRelations(initialRelations);
    setNewRelationId('');
    setNewRelationType('sequel');
  };

  const handleOpenDelete = (item: SeriesItem, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDeletingSeries(item);
  };

  const seriesList = data?.series ?? [];
  const meta = data?.meta ?? { total: seriesList.length, page: 1, limit: 20 };
  const totalPages = Math.max(1, Math.ceil(meta.total / (meta.limit || 20)));

  return (
    <div className="space-y-4">
      {/* Header section */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-lg font-semibold">Videos</h1>
          <p className="text-xs text-muted">
            Manage and browse your video catalog.
          </p>
        </div>
        <button
          type="button"
          onClick={openDialog}
          className="px-3 py-1.5 rounded bg-primary text-primary-fg text-xs font-medium cursor-pointer hover:opacity-90 transition-opacity flex items-center gap-1.5"
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path d="M12 5v14M5 12h14" />
          </svg>
          Add Video
        </button>
      </div>

      {/* Filter bar & Genre Pills */}
      <div className="bg-card border border-c rounded p-3 space-y-3">
        <div className="flex items-center justify-between gap-3">
          <input
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder="Filter series..."
            className="w-full max-w-xs px-3 py-1.5 rounded border border-c bg-transparent text-xs mono focus:outline-none focus:border-primary"
          />
          <span className="text-xs text-muted mono">
            {meta.total} {meta.total === 1 ? 'series' : 'series'}
          </span>
        </div>

        {genres.length > 0 && (
          <div className="flex items-center gap-1.5 flex-wrap pt-2 border-t border-c">
            <button
              type="button"
              onClick={() => {
                navigate({
                  search: (old: Record<string, unknown>) => ({
                    ...old,
                    genre: undefined,
                    page: 1,
                  }),
                });
              }}
              className={`px-2.5 py-1 rounded text-xs mono font-medium border transition-colors cursor-pointer ${
                !search.genre
                  ? 'bg-primary text-primary-fg border-primary'
                  : 'border-c hover-bg text-muted'
              }`}
            >
              All
            </button>
            {genres.map((genre) => {
              const isSelected = search.genre === genre.slug;
              return (
                <button
                  key={genre.id}
                  type="button"
                  onClick={() => {
                    navigate({
                      search: (old: Record<string, unknown>) => ({
                        ...old,
                        genre: isSelected ? undefined : genre.slug,
                        page: 1,
                      }),
                    });
                  }}
                  className={`px-2.5 py-1 rounded text-xs mono font-medium border transition-colors cursor-pointer ${
                    isSelected
                      ? 'bg-primary text-primary-fg border-primary'
                      : 'border-c hover-bg text-muted'
                  }`}
                >
                  {genre.name}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Grid view */}
      {seriesList.length === 0 ? (
        <div className="bg-card border border-c rounded p-8 text-center text-xs text-muted mono">
          No series found matching filter.
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {seriesList.map((item: SeriesItem & { episodes?: unknown[]; episodeCount?: number }) => {
            const epCount = item.episodes?.length ?? item.episodeCount ?? 0;
            return (
              <div
                key={item.id}
                className="group bg-card border border-c rounded overflow-hidden flex flex-col hover:border-primary transition-colors"
              >
                <Link
                  to="/admin/videos/$seriesId"
                  params={{ seriesId: item.id }}
                  className="flex flex-col flex-1 cursor-pointer"
                >
                  {/* Poster / Thumbnail */}
                  <div className="relative aspect-[16/10] overflow-hidden bg-black/10 dark:bg-white/5 flex items-center justify-center">
                    {item.posterUrl ? (
                      <img
                        src={item.posterUrl}
                        alt={item.title}
                        className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                        loading="lazy"
                      />
                    ) : (
                      <div className="w-12 h-12 rounded border border-c bg-muted/20 flex items-center justify-center text-sm font-mono text-muted">
                        {item.title.charAt(0).toUpperCase()}
                      </div>
                    )}
                  </div>

                  {/* Card Content */}
                  <div className="p-3 flex flex-col flex-1 justify-between">
                    <div>
                      <h3 className="text-sm font-medium leading-snug line-clamp-1 group-hover:text-primary transition-colors">
                        {item.title}
                      </h3>
                      <p className="text-xs text-muted mt-1 line-clamp-2 leading-relaxed">
                        {item.description || 'No description available.'}
                      </p>
                    </div>

                    <div className="mt-3 pt-2 border-t border-c flex items-center justify-between text-xs">
                      <span className="mono text-muted">{item.source}</span>
                      <span className="text-[10px] mono px-1.5 py-0.5 rounded border border-c bg-sidebar text-muted">
                        {epCount} {epCount === 1 ? 'episode' : 'episodes'}
                      </span>
                    </div>
                  </div>
                </Link>

                {/* Card Action Buttons: Edit & Delete */}
                <div className="px-3 pb-3 pt-1 flex items-center gap-2">
                  <button
                    type="button"
                    aria-label={`Edit ${item.title}`}
                    onClick={(e) => handleOpenEdit(item, e)}
                    className="flex-1 px-2 py-1 rounded text-xs font-medium border border-c hover-bg cursor-pointer text-foreground flex items-center justify-center gap-1 transition-colors"
                  >
                    <svg
                      width="12"
                      height="12"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                    >
                      <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
                      <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
                    </svg>
                    Edit
                  </button>
                  <button
                    type="button"
                    aria-label={`Delete ${item.title}`}
                    onClick={(e) => handleOpenDelete(item, e)}
                    className="flex-1 px-2 py-1 rounded text-xs font-medium border border-red-200 dark:border-red-900/50 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 cursor-pointer flex items-center justify-center gap-1 transition-colors"
                  >
                    <svg
                      width="12"
                      height="12"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                    >
                      <polyline points="3 6 5 6 21 6" />
                      <path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" />
                    </svg>
                    Delete
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Pagination Bar */}
      {(meta.total > meta.limit * meta.page || meta.page > 1) && (
        <div className="bg-card border border-c rounded px-4 py-2.5 flex items-center justify-between text-xs text-muted">
          <span className="mono">
            Page {meta.page} of {totalPages}
          </span>
          <div className="flex items-center gap-2">
            {meta.page > 1 ? (
              <Link
                to="/admin/videos"
                search={(old: Record<string, unknown>) => ({ ...old, page: meta.page - 1 })}
                className="px-2.5 py-1 rounded border border-c hover-bg cursor-pointer text-foreground"
              >
                Previous
              </Link>
            ) : (
              <span className="px-2.5 py-1 rounded border border-c opacity-50 cursor-not-allowed">
                Previous
              </span>
            )}
            {meta.total > meta.limit * meta.page ? (
              <Link
                to="/admin/videos"
                search={(old: Record<string, unknown>) => ({ ...old, page: meta.page + 1 })}
                className="px-2.5 py-1 rounded border border-c hover-bg cursor-pointer text-foreground"
              >
                Next
              </Link>
            ) : (
              <span className="px-2.5 py-1 rounded border border-c opacity-50 cursor-not-allowed">
                Next
              </span>
            )}
          </div>
        </div>
      )}

      {/* Edit Series Dialog */}
      <Dialog open={!!editingSeries} onOpenChange={(open) => !open && setEditingSeries(null)}>
        <DialogContent className="sm:max-w-lg max-w-[calc(100vw-2rem)] overflow-hidden">
          <DialogHeader>
            <DialogTitle>Edit Series</DialogTitle>
            <DialogDescription>
              Update series details and assigned genres or relations.
            </DialogDescription>
          </DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (!editingSeries) return;
              updateMutation.mutate({
                id: editingSeries.id,
                data: {
                  title: editTitle,
                  description: editDescription || null,
                  posterUrl: editPosterUrl || null,
                  genreIds: selectedGenreIds,
                  relations: selectedRelations.map((r) => ({
                    relatedSeriesId: r.relatedSeriesId,
                    relationType: r.relationType,
                  })),
                },
              });
            }}
            className="space-y-4 py-2 min-w-0 max-w-full overflow-hidden"
          >
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
                        excludeSeriesId={editingSeries?.id}
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
                onClick={() => setEditingSeries(null)}
              >
                Cancel
              </Button>
              <Button type="submit">Save Changes</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Series Confirmation Dialog */}
      <Dialog open={!!deletingSeries} onOpenChange={(open) => !open && setDeletingSeries(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Delete Series</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete {deletingSeries?.title ? `"${deletingSeries.title}"` : 'this series'}? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0 pt-2">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setDeletingSeries(null)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={() => {
                if (deletingSeries) {
                  deleteMutation.mutate(deletingSeries.id);
                }
              }}
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AddMediaDialog />
    </div>
  );
}
