import { useState, useEffect, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate, useSearch } from '@tanstack/react-router';
import { toast } from 'sonner';
import {
  DragDropContext,
  Droppable,
  type DropResult,
} from '@hello-pangea/dnd';
import {
  seriesDetailQueryOptions,
  type SeriesDetails,
  updateEpisode,
  deleteEpisode,
  updateEpisodeOrders,
  deleteSeason,
  type UpdateEpisodeData,
} from './api';
import { EditSeasonDialog } from './EditSeasonDialog';
import { EditSeriesDialog } from './EditSeriesDialog';
import { ManageSourcesDialog } from './ManageSourcesDialog';
import { buildCrossSeasonMove } from './crossSeasonMove';
import { BulkScrapeModal } from './BulkScrapeModal';
import { BulkIngestModal } from './BulkIngestModal';
import { EpisodeTable } from './EpisodeTable';
import { BatchMoveSeasonDialog } from './BatchMoveSeasonDialog';
import { BatchDeleteDialog } from './BatchDeleteDialog';
import { EpisodeDetailDrawer } from './EpisodeDetailDrawer';
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

type Episode = SeriesDetails['episodes'][number];

export interface SeriesDetailViewProps {
  seriesId: string;
  initialOrder?: number;
  initialEpisodeId?: string;
  initialSeasonId?: string;
}

export function SeriesDetailView({
  seriesId,
  initialOrder,
  initialEpisodeId,
  initialSeasonId,
}: SeriesDetailViewProps) {
  const { data: series, isLoading } = useQuery(seriesDetailQueryOptions(seriesId));

  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const searchParams = useSearch({ strict: false }) as Record<string, unknown>;

  const [localEpisodes, setLocalEpisodes] = useState<Episode[]>([]);
  const [selectedSeasonId, setSelectedSeasonId] = useState<string | null>(
    initialSeasonId ?? null
  );

  useEffect(() => {
    if (series?.episodes) {
      setLocalEpisodes(series.episodes);
    }
  }, [series?.episodes]);

  const hasMultipleSeasons = Boolean(series?.seasons && series.seasons.length > 1);

  useEffect(() => {
    if (hasMultipleSeasons && series?.seasons && series.seasons.length > 0) {
      if (!selectedSeasonId || !series.seasons.some((s) => s.id === selectedSeasonId)) {
        setSelectedSeasonId(series.seasons[0].id);
      }
    }
  }, [series?.seasons, hasMultipleSeasons, selectedSeasonId]);

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Parameters<typeof updateEpisode>[1] }) =>
      updateEpisode(id, data),
    onSuccess: (updatedEpisode) => {
      queryClient.invalidateQueries({ queryKey: ['series', seriesId] });
      toast.success('video.edit', {
        description: `Successfully updated ${updatedEpisode.title}`,
      });
    },
    onError: (error) => {
      toast.error('video.edit', {
        description: `Failed to update: ${error.message}`,
      });
    }
  });

  const deleteMutation = useMutation({
    mutationFn: deleteEpisode,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['series', seriesId] });
      // variables is { id, seriesId }
      toast.success('video.delete', {
        description: `Successfully deleted episode`,
      });
    },
    onError: (error) => {
      toast.error('video.delete', {
        description: `Failed to delete: ${error.message}`,
      });
    }
  });

  const reorderMutation = useMutation({
    mutationFn: (orders: { id: string; order: number }[]) =>
      updateEpisodeOrders(seriesId, orders),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['series', seriesId] });
    },
  });

  const deleteSeasonMutation = useMutation({
    mutationFn: deleteSeason,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['series', seriesId] });
      toast.success('Season deleted successfully');
      setIsDeleteSeasonOpen(false);
    },
    onError: (error) => {
      const err = error as Error & { code?: string };
      if (err.code === 'SEASON_NOT_EMPTY') {
        toast.error('Cannot delete season', {
          description:
            err.message ||
            'This season still contains episodes. Move or delete them first.',
        });
      } else {
        toast.error('Failed to delete season', {
          description: error.message,
        });
      }
      setIsDeleteSeasonOpen(false);
    },
  });

  const [selectedEpisodeId, setSelectedEpisodeId] = useState<string | null>(
    initialEpisodeId ?? null
  );
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  // Sync drawer state with URL search params or initial props
  useEffect(() => {
    const epIdFromSearch =
      (searchParams?.episodeId as string | undefined) ?? initialEpisodeId;
    const orderFromSearch =
      typeof searchParams?.order === 'number'
        ? (searchParams.order as number)
        : initialOrder !== undefined
          ? initialOrder
          : undefined;

    if (epIdFromSearch && localEpisodes.some((e) => e.id === epIdFromSearch)) {
      setSelectedEpisodeId(epIdFromSearch);
      setIsDrawerOpen(true);
    } else if (orderFromSearch !== undefined && localEpisodes.length > 0) {
      const match = localEpisodes.find((e) => e.order === orderFromSearch);
      if (match) {
        setSelectedEpisodeId(match.id);
        setIsDrawerOpen(true);
      }
    }
  }, [
    searchParams?.episodeId,
    searchParams?.order,
    initialEpisodeId,
    initialOrder,
    localEpisodes,
  ]);

  const updateDrawerUrl = useCallback(
    (episode: Episode | null) => {
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (navigate as any)({
          search: (prev: Record<string, unknown>) => {
            const next = { ...prev };
            if (episode) {
              next.episodeId = episode.id;
              if (episode.order !== null && episode.order !== undefined) {
                next.order = episode.order;
              } else {
                delete next.order;
              }
            } else {
              delete next.episodeId;
              delete next.order;
            }
            return next;
          },
          replace: true,
        });
      } catch {
        // Fallback for tests or contexts where router navigate is mocked without search function
      }
    },
    [navigate]
  );

  const handleOpenEpisodeDrawer = (episode: Episode) => {
    setSelectedEpisodeId(episode.id);
    setIsDrawerOpen(true);
    updateDrawerUrl(episode);
  };

  const handleCloseEpisodeDrawer = (open: boolean) => {
    setIsDrawerOpen(open);
    if (!open) {
      updateDrawerUrl(null);
    }
  };

  const handleSaveDrawerEpisode = async (
    episodeId: string,
    data: UpdateEpisodeData
  ) => {
    await updateMutation.mutateAsync({ id: episodeId, data });
  };

  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isManageSourcesOpen, setIsManageSourcesOpen] = useState(false);
  const [manageSourcesInitialTab, setManageSourcesInitialTab] = useState<
    'add-url' | 'add-direct' | 'remote-ingest' | 'upload-s3' | 'edit-existing' | undefined
  >(undefined);
  const [isEditSeasonOpen, setIsEditSeasonOpen] = useState(false);
  const [isDeleteSeasonOpen, setIsDeleteSeasonOpen] = useState(false);
  const [isSeasonMenuOpen, setIsSeasonMenuOpen] = useState(false);
  const [isBulkScrapeOpen, setIsBulkScrapeOpen] = useState(false);
  const [isBulkIngestOpen, setIsBulkIngestOpen] = useState(false);
  const [isEditSeriesOpen, setIsEditSeriesOpen] = useState(false);
  const [isBatchMoveOpen, setIsBatchMoveOpen] = useState(false);
  const [isBatchDeleteOpen, setIsBatchDeleteOpen] = useState(false);
  const [selectedEpisodeIds, setSelectedEpisodeIds] = useState<string[]>([]);
  const [isBatchOperating, setIsBatchOperating] = useState(false);

  const [editTitle, setEditTitle] = useState('');
  const [editVideoType, setEditVideoType] = useState('');
  const [editDescription, setEditDescription] = useState('');

  if (isLoading) {
    return (
      <div className="space-y-4 p-4 text-xs text-muted mono">
        Loading series...
      </div>
    );
  }

  if (!series) {
    return (
      <div className="space-y-4">
        <div className="bg-card border border-c rounded p-4">
          <h1 className="text-lg font-semibold">Series not found</h1>
          <p className="text-xs text-muted mt-0.5">
            No series matches <span className="mono">{seriesId}</span>.
          </p>
        </div>
      </div>
    );
  }

  const activeSeason =
    series?.seasons && series.seasons.length > 0
      ? (selectedSeasonId ? series.seasons.find((s) => s.id === selectedSeasonId) : series.seasons[0]) ?? series.seasons[0]
      : null;

  const currentDescription = activeSeason?.description || series.description;
  const currentPosterUrl = activeSeason?.posterUrl || series.posterUrl;

  const seasonEpisodes = (() => {
    if (!hasMultipleSeasons || !activeSeason) {
      return localEpisodes;
    }
    const activeSeasonEpIds = new Set(
      activeSeason.episodes?.map((e) => e.id) ?? []
    );
    return localEpisodes.filter(
      (ep) => ep.seasonId === activeSeason.id || activeSeasonEpIds.has(ep.id)
    );
  })();

  const episodes = seasonEpisodes;

  const selectedEpisode = selectedEpisodeId
    ? episodes.find((e) => e.id === selectedEpisodeId) ?? null
    : null;

  const SEASON_TAB_PREFIX = 'season-tab-';

  const handleCrossSeasonDrop = (episodeId: string, targetSeasonId: string) => {
    const move = buildCrossSeasonMove(localEpisodes, episodeId, targetSeasonId);
    if (!move) return;

    const previousEpisodes = [...localEpisodes];
    setLocalEpisodes(move.episodes);
    queryClient.setQueryData(
      ['series', seriesId],
      (old: SeriesDetails | undefined) =>
        old ? { ...old, episodes: move.episodes } : old
    );

    reorderMutation.mutate(move.orders, {
      onError: (error) => {
        setLocalEpisodes(previousEpisodes);
        queryClient.setQueryData(
          ['series', seriesId],
          (old: SeriesDetails | undefined) =>
            old ? { ...old, episodes: previousEpisodes } : old
        );
        toast.error('video.reorder', {
          description: `Failed to move episode: ${error.message}`,
        });
      },
    });
  };

  const handleDragEnd = (result: DropResult) => {
    const { destination, source } = result;

    if (!destination) {
      return;
    }

    if (destination.droppableId.startsWith(SEASON_TAB_PREFIX)) {
      handleCrossSeasonDrop(
        result.draggableId,
        destination.droppableId.slice(SEASON_TAB_PREFIX.length)
      );
      return;
    }

    if (destination.index === source.index) {
      return;
    }

    const previousEpisodes = [...localEpisodes];
    const nextSeasonEpisodes = Array.from(seasonEpisodes);
    const [moved] = nextSeasonEpisodes.splice(source.index, 1);
    nextSeasonEpisodes.splice(destination.index, 0, moved);

    const updatedSeasonEpMap = new Map(
      nextSeasonEpisodes.map((ep, idx) => [ep.id, { ...ep, order: idx + 1 }])
    );
    const nextLocalEpisodes = localEpisodes.map(
      (ep) => updatedSeasonEpMap.get(ep.id) ?? ep
    );

    setLocalEpisodes(nextLocalEpisodes);

    queryClient.setQueryData(
      ['series', seriesId],
      (old: SeriesDetails | undefined) =>
        old ? { ...old, episodes: nextLocalEpisodes } : old
    );

    const newOrders = nextSeasonEpisodes.map((ep, index) => ({
      id: ep.id,
      order: index + 1,
    }));

    reorderMutation.mutate(newOrders, {
      onError: (error) => {
        setLocalEpisodes(previousEpisodes);
        queryClient.setQueryData(
          ['series', seriesId],
          (old: SeriesDetails | undefined) =>
            old ? { ...old, episodes: previousEpisodes } : old
        );
        toast.error('video.reorder', {
          description: `Failed to reorder episodes: ${error.message}`,
        });
      },
    });
  };

  const handleConfirmEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEpisode) return;
    updateMutation.mutate({
      id: selectedEpisode.id,
      data: {
        title: editTitle,
        videoType: editVideoType || null,
        description: editDescription || null,
      },
    });
    setIsEditDialogOpen(false);
  };

  const handleConfirmDelete = () => {
    if (!selectedEpisode) return;
    deleteMutation.mutate(selectedEpisode.id);
    setIsDeleteDialogOpen(false);
  };

  const handleBatchMoveToSeason = async (targetSeasonId: string) => {
    if (selectedEpisodeIds.length === 0) return;
    setIsBatchOperating(true);

    const previousEpisodes = [...localEpisodes];
    // Calculate new states sequentially
    let currentEpisodes = [...localEpisodes];
    const allOrders: { id: string; order: number; seasonId?: string }[] = [];

    for (const epId of selectedEpisodeIds) {
      const move = buildCrossSeasonMove(currentEpisodes, epId, targetSeasonId);
      if (move) {
        currentEpisodes = move.episodes;
        // Merge or replace orders for changed episodes
        for (const orderItem of move.orders) {
          const existingIdx = allOrders.findIndex((o) => o.id === orderItem.id);
          if (existingIdx >= 0) {
            allOrders[existingIdx] = orderItem;
          } else {
            allOrders.push(orderItem);
          }
        }
      }
    }

    setLocalEpisodes(currentEpisodes);
    queryClient.setQueryData(
      ['series', seriesId],
      (old: SeriesDetails | undefined) =>
        old ? { ...old, episodes: currentEpisodes } : old
    );

    try {
      await updateEpisodeOrders(seriesId, allOrders);
      await queryClient.invalidateQueries({ queryKey: ['series', seriesId] });
      toast.success(
        `Successfully moved ${selectedEpisodeIds.length} ${
          selectedEpisodeIds.length === 1 ? 'episode' : 'episodes'
        }`
      );
      setSelectedEpisodeIds([]);
      setIsBatchMoveOpen(false);
    } catch (error) {
      setLocalEpisodes(previousEpisodes);
      queryClient.setQueryData(
        ['series', seriesId],
        (old: SeriesDetails | undefined) =>
          old ? { ...old, episodes: previousEpisodes } : old
      );
      toast.error('video.move', {
        description: `Failed to move episodes: ${(error as Error).message}`,
      });
    } finally {
      setIsBatchOperating(false);
    }
  };

  const handleBatchDelete = async () => {
    if (selectedEpisodeIds.length === 0) return;
    setIsBatchOperating(true);

    let successCount = 0;
    const errors: string[] = [];

    for (const epId of selectedEpisodeIds) {
      try {
        await deleteEpisode(epId);
        successCount++;
      } catch (err) {
        errors.push((err as Error).message);
      }
    }

    await queryClient.invalidateQueries({ queryKey: ['series', seriesId] });
    setSelectedEpisodeIds([]);
    setIsBatchDeleteOpen(false);
    setIsBatchOperating(false);

    if (successCount > 0) {
      toast.success(
        `Successfully deleted ${successCount} ${
          successCount === 1 ? 'episode' : 'episodes'
        }`
      );
    }
    if (errors.length > 0) {
      toast.error(
        `Failed to delete ${errors.length} ${
          errors.length === 1 ? 'episode' : 'episodes'
        }`
      );
    }
  };

  return (
    <div className="space-y-4">
      <DragDropContext onDragEnd={handleDragEnd}>
      {/* Header section */}
      <div className="flex gap-4 items-start">
        {currentPosterUrl && (
          <img
            src={currentPosterUrl}
            alt={series.title}
            className="w-20 h-28 object-cover rounded border border-c shrink-0"
          />
        )}
        <div className="space-y-2 flex-1 min-w-0">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl font-semibold tracking-tight">
                {series.title}
              </h1>
              <span className="text-xs mono px-2 py-0.5 rounded border border-c bg-sidebar text-muted">
                {localEpisodes.length} episodes
              </span>
              <span className={`text-xs mono px-2 py-0.5 rounded border ${
                activeSeason?.status === 'ongoing'
                  ? 'border-blue-500/30 bg-blue-500/10 text-blue-600 dark:text-blue-400'
                  : 'border-c bg-sidebar text-muted'
              } capitalize`}>
                {activeSeason?.status || 'completed'}
              </span>
              {series.isFeatured && (
                <span className="text-xs mono px-2 py-0.5 rounded border border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400">
                  Featured
                </span>
              )}
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={() => setIsEditSeriesOpen(true)}
                type="button"
                className="border border-c hover-bg px-3 py-1.5 rounded text-xs font-medium transition cursor-pointer flex items-center gap-1.5 shrink-0"
              >
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
                  <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
                </svg>
                Edit Series
              </button>

              <button
                onClick={() => setIsBulkScrapeOpen(true)}
                type="button"
                className="border border-c hover-bg px-3 py-1.5 rounded text-xs font-medium transition cursor-pointer flex items-center gap-1.5 shrink-0"
              >
                Bulk Add Sources
              </button>

              <button
                onClick={() => setIsBulkIngestOpen(true)}
                type="button"
                className="border border-c hover-bg px-3 py-1.5 rounded text-xs font-medium transition cursor-pointer flex items-center gap-1.5 shrink-0"
              >
                Bulk Ingest URLs
              </button>
            </div>
          </div>

          {currentDescription && (
            <p className="text-xs text-muted leading-relaxed break-words">{currentDescription}</p>
          )}
        </div>
      </div>

      {/* Season Navigation Bar (season tabs double as drop targets for cross-season episode moves; collapses when seasons <= 1) */}
      {series.seasons && hasMultipleSeasons && (
        <div className="flex flex-wrap items-center justify-between gap-2 p-2.5 rounded border border-c bg-card">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-medium mono uppercase tracking-wider text-muted mr-1">
              Season:
            </span>
            <div className="flex flex-wrap gap-1.5">
              {series.seasons.map((season, index) => {
                const isActive = season.id === (activeSeason?.id ?? selectedSeasonId);
                const title = season.title || `Season ${season.tmdbSeason ?? index + 1}`;
                return (
                  <Droppable
                    key={season.id}
                    droppableId={`season-tab-${season.id}`}
                  >
                    {(tabProvided, tabSnapshot) => (
                      <div
                        ref={tabProvided.innerRef}
                        {...tabProvided.droppableProps}
                        className={`rounded ${
                          tabSnapshot.isDraggingOver
                            ? 'ring-2 ring-[var(--primary)]'
                            : ''
                        }`}
                      >
                        <button
                          type="button"
                          onClick={() => setSelectedSeasonId(season.id)}
                          className={`px-3 py-1 rounded text-xs font-medium cursor-pointer transition-colors border ${
                            isActive
                              ? 'bg-primary text-primary-fg border-primary'
                              : 'bg-card text-fg border-c hover-bg'
                          }`}
                        >
                          {title}
                        </button>
                      </div>
                    )}
                  </Droppable>
                );
              })}
            </div>
          </div>

          {activeSeason && (
            <div className="relative ml-auto">
              <button
                type="button"
                onClick={() => setIsSeasonMenuOpen((prev) => !prev)}
                aria-label="Season actions"
                className="p-1.5 rounded border border-c bg-card text-muted hover:text-current hover-bg cursor-pointer transition-colors flex items-center justify-center"
              >
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                >
                  <circle cx="12" cy="5" r="2" />
                  <circle cx="12" cy="12" r="2" />
                  <circle cx="12" cy="19" r="2" />
                </svg>
              </button>

              {isSeasonMenuOpen && (
                <>
                  <div
                    className="fixed inset-0 z-10"
                    onClick={() => setIsSeasonMenuOpen(false)}
                  />
                  <div className="absolute right-0 top-full mt-1 z-20 w-44 bg-card border border-c rounded shadow-sm py-1 divide-y divide-[var(--border)]">
                    <div className="py-0.5">
                      <button
                        type="button"
                        onClick={() => {
                          setIsSeasonMenuOpen(false);
                          setIsEditSeasonOpen(true);
                        }}
                        className="w-full text-left px-3 py-1.5 text-xs hover-bg transition-colors flex items-center gap-2 cursor-pointer"
                      >
                        <svg
                          width="12"
                          height="12"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                        >
                          <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
                        </svg>
                        Edit Season
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setIsSeasonMenuOpen(false);
                          if (activeSeason) {
                            if (navigator.clipboard?.writeText) {
                              navigator.clipboard.writeText(activeSeason.id);
                            }
                            toast.success('Season ID copied to clipboard');
                          }
                        }}
                        className="w-full text-left px-3 py-1.5 text-xs hover-bg transition-colors flex items-center gap-2 cursor-pointer"
                      >
                        <svg
                          width="12"
                          height="12"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                        >
                          <rect width="14" height="14" x="8" y="8" rx="2" ry="2" />
                          <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" />
                        </svg>
                        Copy Season ID
                      </button>
                    </div>
                    <div className="py-0.5">
                      <button
                        type="button"
                        onClick={() => {
                          setIsSeasonMenuOpen(false);
                          setIsDeleteSeasonOpen(true);
                        }}
                        className="w-full text-left px-3 py-1.5 text-xs hover-bg text-red-600 dark:text-red-400 transition-colors flex items-center gap-2 cursor-pointer"
                      >
                        <svg
                          width="12"
                          height="12"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                        >
                          <path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
                        </svg>
                        Delete Season
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      )}

      {/* Related Series section */}
      {series.relations && series.relations.length > 0 && (
        <div className="p-2.5 rounded border border-c bg-card space-y-2">
          <div className="text-xs font-medium mono uppercase tracking-wider text-muted">
            Related Series
          </div>
          <div className="flex flex-wrap gap-2">
            {series.relations.map((rel) => (
              <Link
                key={rel.relatedSeriesId}
                to="/admin/videos/$seriesId"
                params={{ seriesId: rel.relatedSeriesId }}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded border border-c bg-sidebar hover:border-primary transition-colors text-xs cursor-pointer"
              >
                <span className="font-mono text-[10px] uppercase px-1.5 py-0.5 rounded bg-card border border-c text-muted">
                  {rel.relationType}
                </span>
                <span className="font-medium text-current">
                  {rel.title || rel.relatedSeriesId}
                </span>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Full-Width Episode Data Table */}
      <EpisodeTable
        episodes={episodes}
        selectedEpisodeId={selectedEpisodeId}
        selectedEpisodeIds={selectedEpisodeIds}
        onSelectedEpisodeIdsChange={setSelectedEpisodeIds}
        onBatchMoveToSeason={() => setIsBatchMoveOpen(true)}
        onBatchDelete={() => setIsBatchDeleteOpen(true)}
        disableBatchMove={!series.seasons || series.seasons.length <= 1}
        onSelectEpisode={handleOpenEpisodeDrawer}
        onEditEpisode={handleOpenEpisodeDrawer}
        onDeleteEpisode={(ep) => {
          setSelectedEpisodeId(ep.id);
          setIsDeleteDialogOpen(true);
        }}
        onManageSources={(ep) => {
          setSelectedEpisodeId(ep.id);
          setIsManageSourcesOpen(true);
        }}
      />
      {/* Slide-Out Episode Detail Drawer */}
      <EpisodeDetailDrawer
        open={isDrawerOpen}
        onOpenChange={handleCloseEpisodeDrawer}
        episode={selectedEpisode}
        onSave={handleSaveDrawerEpisode}
        isSaving={updateMutation.isPending}
        onOpenAdvancedIngest={(tab) => {
          setManageSourcesInitialTab(tab);
          setIsManageSourcesOpen(true);
        }}
      />
      <BatchMoveSeasonDialog
        open={isBatchMoveOpen}
        onOpenChange={setIsBatchMoveOpen}
        selectedEpisodeCount={selectedEpisodeIds.length}
        seasons={series.seasons ?? []}
        currentSeasonId={activeSeason?.id ?? null}
        onConfirmMove={handleBatchMoveToSeason}
        isPending={isBatchOperating}
      />
      <BatchDeleteDialog
        open={isBatchDeleteOpen}
        onOpenChange={setIsBatchDeleteOpen}
        selectedEpisodeCount={selectedEpisodeIds.length}
        onConfirmDelete={handleBatchDelete}
        isPending={isBatchOperating}
      />
      <EditSeriesDialog
        open={isEditSeriesOpen}
        onOpenChange={setIsEditSeriesOpen}
        series={series}
      />
      <BulkScrapeModal
        open={isBulkScrapeOpen}
        onOpenChange={setIsBulkScrapeOpen}
        seriesId={seriesId}
        localEpisodes={localEpisodes}
        seasons={series.seasons ?? []}
      />
      <BulkIngestModal
        open={isBulkIngestOpen}
        onOpenChange={setIsBulkIngestOpen}
        seriesId={seriesId}
        localEpisodes={localEpisodes}
        seasons={series.seasons ?? []}
      />
      {activeSeason && (
        <EditSeasonDialog
          season={activeSeason}
          open={isEditSeasonOpen}
          onOpenChange={setIsEditSeasonOpen}
        />
      )}

      {/* Delete Season Confirmation Dialog */}
      <Dialog open={isDeleteSeasonOpen} onOpenChange={setIsDeleteSeasonOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Season</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete{' '}
              {activeSeason?.title ? `"${activeSeason.title}"` : 'this season'}?
              Seasons containing episodes cannot be deleted. This action cannot
              be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setIsDeleteSeasonOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={deleteSeasonMutation.isPending}
              onClick={() =>
                activeSeason && deleteSeasonMutation.mutate(activeSeason.id)
              }
            >
              {deleteSeasonMutation.isPending ? 'Deleting...' : 'Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Episode Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Episode</DialogTitle>
            <DialogDescription>
              Update the details of this episode.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleConfirmEdit} className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="edit-title">Title</Label>
              <Input
                id="edit-title"
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                placeholder="Episode title"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="edit-description">Description</Label>
              <textarea
                id="edit-description"
                rows={3}
                value={editDescription}
                onChange={(e) => setEditDescription(e.target.value)}
                placeholder="Episode description"
                className="flex w-full rounded border border-c bg-transparent px-3 py-2 text-sm shadow-sm transition-colors placeholder:text-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)] focus-visible:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-50"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="edit-video-type">Video Type</Label>
              <Input
                id="edit-video-type"
                value={editVideoType}
                onChange={(e) => setEditVideoType(e.target.value)}
                placeholder="e.g. mp4, embed"
              />
            </div>
            <DialogFooter className="pt-2">
              <Button
                type="button"
                variant="secondary"
                onClick={() => setIsEditDialogOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit">Save Changes</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Manage Sources Dialog */}
      <ManageSourcesDialog
        open={isManageSourcesOpen}
        onOpenChange={(open) => {
          setIsManageSourcesOpen(open);
          if (!open) setManageSourcesInitialTab(undefined);
        }}
        episode={selectedEpisode}
        seriesId={seriesId}
        initialTab={manageSourcesInitialTab}
      />

      {/* Delete Episode Confirmation Dialog */}
      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Episode</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete {selectedEpisode?.title ? `"${selectedEpisode.title}"` : 'this episode'}? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setIsDeleteDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={handleConfirmDelete}
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      </DragDropContext>
    </div>
  );
}
