import { useState, useEffect, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useSearch } from '@tanstack/react-router';
import { toast } from 'sonner';
import {
  Play,
  Check,
  Edit2,
  RefreshCw,
  Plus,
  ArrowDownToLine,
  Trash2,
  Copy,
} from 'lucide-react';
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
  scrapeOngoingSeason,
  type UpdateEpisodeData,
} from './api';
import { EditSeasonDialog } from './EditSeasonDialog';
import { AddSeasonDialog } from './AddSeasonDialog';
import { getSeasonNumber } from './seasonUtils';
import { EditSeriesDialog } from './EditSeriesDialog';
import { SyncTmdbModal } from './SyncTmdbModal';
import { ManageSourcesDialog } from './ManageSourcesDialog';
import { buildCrossSeasonMove, buildBulkCrossSeasonMove } from './crossSeasonMove';
import { MoveEpisodesDialog } from './MoveEpisodesDialog';
import { BulkScrapeModal } from './BulkScrapeModal';
import { BulkIngestModal } from './BulkIngestModal';
import { EpisodeTable } from './EpisodeTable';
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
import { BackButton } from '@/components/ui/back-button';
import { ChunkyButton } from '@/components/ui/chunky-button';
import { ChunkyChip } from '@/components/ui/chunky-chip';
import { ChunkyActionMenu } from '@/components/ui/chunky-action-menu';
import { ChunkyTooltip } from '@/components/ui/chunky-tooltip';
import { ChunkySkeleton } from '@/components/ui/chunky-skeleton';
import { useClampedText } from '@/hooks/useClampedText';

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

  useEffect(() => {
    if (series?.seasons && series.seasons.length > 0) {
      if (!selectedSeasonId || !series.seasons.some((s) => s.id === selectedSeasonId)) {
        setSelectedSeasonId(series.seasons[0].id);
      }
    }
  }, [series?.seasons, selectedSeasonId]);

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

  const scrapeOngoingMutation = useMutation({
    mutationFn: (seasonId: string) => scrapeOngoingSeason(seasonId),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['series', seriesId] });
      queryClient.invalidateQueries({ queryKey: ['episodes'] });
      if (result.sourcesSaved > 0) {
        toast.success(
          `Auto-scrape completed: ${result.sourcesSaved} source${result.sourcesSaved === 1 ? '' : 's'} saved across ${result.episodesScraped} episode${result.episodesScraped === 1 ? '' : 's'}`
        );
      } else {
        toast.success('Auto-scrape completed: no new sources found');
      }
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to auto-scrape ongoing season');
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
  const [isAddSeasonOpen, setIsAddSeasonOpen] = useState(false);
  const [isDeleteSeasonOpen, setIsDeleteSeasonOpen] = useState(false);
  const [isSyncTmdbOpen, setIsSyncTmdbOpen] = useState(false);
  const [isBulkScrapeOpen, setIsBulkScrapeOpen] = useState(false);
  const [isBulkIngestOpen, setIsBulkIngestOpen] = useState(false);
  const [isEditSeriesOpen, setIsEditSeriesOpen] = useState(false);
  const [isBatchDeleteOpen, setIsBatchDeleteOpen] = useState(false);
  const [isMoveEpisodesOpen, setIsMoveEpisodesOpen] = useState(false);
  const [selectedEpisodeIds, setSelectedEpisodeIds] = useState<string[]>([]);
  const [isBatchOperating, setIsBatchOperating] = useState(false);
  const [bulkScrapeEpisodeIds, setBulkScrapeEpisodeIds] = useState<string[] | null>(null);

  const [editTitle, setEditTitle] = useState('');
  const [editVideoType, setEditVideoType] = useState('');
  const [editDescription, setEditDescription] = useState('');

  const activeSeason =
    series?.seasons && series.seasons.length > 0
      ? (selectedSeasonId ? series.seasons.find((s) => s.id === selectedSeasonId) : series.seasons[0]) ?? series.seasons[0]
      : null;

  const currentDescription = activeSeason?.description || series?.description || '';
  const currentPosterUrl = activeSeason?.posterUrl || series?.posterUrl || null;

  const isDescriptionEmpty = !currentDescription || !currentDescription.trim();
  const clampedText = useClampedText(currentDescription, {
    seriesId,
    seasonId: activeSeason?.id,
    contentId: 'series-hero-description',
  });

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="hero">
          <ChunkySkeleton className="w-[104px] aspect-[3/4] rounded-xl flex-none" />
          <div className="hero-body">
            <div className="hero-title">
              <ChunkySkeleton className="h-7 w-48 rounded-lg" />
              <ChunkySkeleton className="h-8 w-24 rounded-full" />
              <ChunkySkeleton className="h-8 w-24 rounded-full" />
            </div>
            <div className="hero-desc-wrap">
              <ChunkySkeleton className="h-12 w-full rounded-lg" />
            </div>
            <div className="hero-actions">
              <ChunkySkeleton className="h-11 w-28 rounded-[14px]" />
              <ChunkySkeleton className="h-11 w-32 rounded-[14px]" />
              <ChunkySkeleton className="h-11 w-36 rounded-[14px]" />
              <ChunkySkeleton className="h-11 w-36 rounded-2xl" />
            </div>
          </div>
        </div>
        <div className="flex flex-col gap-3" aria-label="Loading episodes">
          <ChunkySkeleton className="h-[68px] w-full rounded-[var(--radius)]" />
          <ChunkySkeleton className="h-[68px] w-full rounded-[var(--radius)]" />
          <ChunkySkeleton className="h-[68px] w-full rounded-[var(--radius)]" />
        </div>
      </div>
    );
  }

  if (!series) {
    return (
      <div className="space-y-4">
        <BackButton />
        <div className="bg-[var(--surface)] border-2 border-b-4 border-[var(--border)] rounded-[var(--radius)] p-6 text-center">
          <h1 className="text-xl font-extrabold text-[var(--ink)]">Series not found</h1>
          <p className="text-sm font-semibold text-[var(--muted)] mt-1">
            No series matches <span className="font-mono text-[var(--ink)]">{seriesId}</span>.
          </p>
          <a
            href="/admin/videos"
            className="inline-flex items-center justify-center gap-2 h-11 px-4 mt-4 rounded-[14px] border-2 border-b-4 border-[var(--green)] bg-[var(--green-tint)] text-[var(--green)] font-extrabold text-[13px] uppercase tracking-[0.7px]"
          >
            Back to catalog
          </a>
        </div>
      </div>
    );
  }

  const seasonEpisodes = (() => {
    if (!series?.seasons || series.seasons.length === 0 || !activeSeason) {
      return localEpisodes;
    }
    if (series.seasons.length === 1) {
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

  const handleBulkMoveEpisodes = (targetSeasonId: string) => {
    const move = buildBulkCrossSeasonMove(
      localEpisodes,
      selectedEpisodeIds,
      targetSeasonId
    );
    if (!move) {
      setIsMoveEpisodesOpen(false);
      return;
    }

    const previousEpisodes = [...localEpisodes];
    setLocalEpisodes(move.episodes);
    queryClient.setQueryData(
      ['series', seriesId],
      (old: SeriesDetails | undefined) =>
        old ? { ...old, episodes: move.episodes } : old
    );

    reorderMutation.mutate(move.orders, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ['series', seriesId] });
        setSelectedEpisodeIds([]);
        setIsMoveEpisodesOpen(false);
        toast.success(`Moved ${move.orders.filter((o) => o.seasonId).length} episodes`);
      },
      onError: (error) => {
        setLocalEpisodes(previousEpisodes);
        queryClient.setQueryData(
          ['series', seriesId],
          (old: SeriesDetails | undefined) =>
            old ? { ...old, episodes: previousEpisodes } : old
        );
        toast.error('video.reorder', {
          description: `Failed to move episodes: ${error.message}`,
        });
      },
    });
  };

  const episodeCountBySeason = (() => {
    const counts: Record<string, number> = {};
    for (const ep of localEpisodes) {
      if (ep.seasonId == null) continue;
      const key: string = ep.seasonId;
      counts[key] = (counts[key] ?? 0) + 1;
    }
    return counts;
  })();
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
      {/* Top navigation */}
      <div>
        <BackButton />
      </div>

      <DragDropContext onDragEnd={handleDragEnd}>
      {/* Hero section */}
      <div className="hero">
        {currentPosterUrl ? (
          <img
            src={currentPosterUrl}
            alt={series.title}
            className="hero-poster object-cover bg-[var(--surface)] border-2 border-[var(--border)]"
          />
        ) : (
          <div className="hero-poster bg-[var(--surface)] border-2 border-[var(--border)] text-[var(--muted)] flex items-center justify-center font-bold">
            No Poster
          </div>
        )}
        <div className="hero-body">
          <div className="hero-title">
            <h1 className="text-[28px] font-extrabold text-[var(--ink)] leading-none">
              {series.title}
            </h1>
            <span className="pill ep-count rounded-full bg-[var(--surface)] border-0 text-[var(--blue)] font-extrabold text-[12px]">
              <Play className="size-3.5 fill-current" />
              {localEpisodes.length} {localEpisodes.length === 1 ? 'Episode' : 'Episodes'}
            </span>
            <span
              className={`pill rounded-full font-extrabold text-[12px] border-0 ${
                activeSeason?.status === 'ongoing'
                  ? 'bg-amber-500/15 text-amber-500'
                  : 'pill ok bg-[var(--green-tint)] text-[var(--green)]'
              }`}
            >
              {activeSeason?.status !== 'ongoing' && <Check className="size-3.5 stroke-[3]" />}
              {activeSeason?.status || 'completed'}
            </span>
            {series.isFeatured && (
              <span className="pill rounded-full border-2 border-[var(--gold-dark)] bg-[var(--gold-tint)] text-[var(--gold)] font-extrabold text-[12px]">
                Featured
              </span>
            )}
          </div>

          <div className="hero-desc-wrap">
            {isDescriptionEmpty ? (
              <div className="hero-desc empty">
                No description available.
              </div>
            ) : (
              <>
                <p
                  id="series-hero-description"
                  ref={clampedText.contentRef as React.RefObject<HTMLParagraphElement>}
                  className={`hero-desc${clampedText.isExpanded ? ' expanded' : ''}`}
                >
                  {currentDescription}
                </p>
                {clampedText.showToggle && (
                  <button
                    type="button"
                    onClick={clampedText.toggleExpanded}
                    className="desc-toggle"
                    {...clampedText.toggleProps}
                  >
                    {clampedText.toggleLabel}
                  </button>
                )}
              </>
            )}
          </div>

          <div className="hero-actions">
            <ChunkyChip
              variant="blue"
              onClick={() => setIsEditSeriesOpen(true)}
              type="button"
            >
              <Edit2 className="size-4" />
              Edit Series
            </ChunkyChip>

            {!series.tmdbId ? (
              <ChunkyTooltip content="Link TMDB in Edit Series to enable sync">
                <span className="inline-flex" tabIndex={0}>
                  <ChunkyChip
                    variant="blue"
                    onClick={() => setIsSyncTmdbOpen(true)}
                    type="button"
                    disabled
                  >
                    <RefreshCw className="size-4" />
                    Sync with TMDB
                  </ChunkyChip>
                </span>
              </ChunkyTooltip>
            ) : (
              <ChunkyChip
                variant="blue"
                onClick={() => setIsSyncTmdbOpen(true)}
                type="button"
              >
                <RefreshCw className="size-4" />
                Sync with TMDB
              </ChunkyChip>
            )}

            <ChunkyChip
              variant="blue"
              onClick={() => {
                setBulkScrapeEpisodeIds(null);
                setIsBulkScrapeOpen(true);
              }}
              type="button"
            >
              <Plus className="size-4" />
              Bulk Add Sources
            </ChunkyChip>

            <ChunkyButton
              variant="green"
              onClick={() => setIsBulkIngestOpen(true)}
              type="button"
            >
              <ArrowDownToLine className="size-5" />
              Bulk Ingest Sources
            </ChunkyButton>
          </div>
        </div>
      </div>

      {/* Season Navigation Bar */}
      <div className="season-bar">
        <span className="lbl">SEASON:</span>
        <div className="flex flex-wrap items-center gap-2 flex-1 min-w-0">
          {series.seasons && series.seasons.length > 0 ? (
            series.seasons.map((season, index) => {
              const isActive = season.id === (activeSeason?.id ?? selectedSeasonId);
              const title = season.title || `Season ${getSeasonNumber(season, index)}`;
              return (
                <Droppable
                  key={season.id}
                  droppableId={`season-tab-${season.id}`}
                >
                  {(tabProvided, tabSnapshot) => (
                    <div
                      ref={tabProvided.innerRef}
                      {...tabProvided.droppableProps}
                      className={
                        tabSnapshot.isDraggingOver
                          ? 'ring-2 ring-[var(--green)] rounded-[14px]'
                          : undefined
                      }
                    >
                      <ChunkyChip
                        variant={isActive ? 'active' : 'default'}
                        pressed={isActive}
                        onClick={() => setSelectedSeasonId(season.id)}
                        type="button"
                      >
                        {title}
                      </ChunkyChip>
                    </div>
                  )}
                </Droppable>
              );
            })
          ) : (
            <span className="text-sm font-semibold text-[var(--muted)]">
              No seasons yet
            </span>
          )}
          <ChunkyButton
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setIsAddSeasonOpen(true)}
            aria-label="Add season"
            title="Add season"
          >
            <Plus className="size-4" aria-hidden="true" />
          </ChunkyButton>
        </div>

          {activeSeason && (
            <div className="ml-auto flex-none">
              <ChunkyActionMenu
                triggerLabel="Season actions"
                align="end"
                items={[
                  ...(activeSeason.status === 'ongoing' && activeSeason.scraperUrl
                    ? [
                        {
                          label: scrapeOngoingMutation.isPending
                            ? 'Scraping...'
                            : 'Run Auto-Scrape Now',
                          icon: (
                            <RefreshCw
                              className={`size-4 ${
                                scrapeOngoingMutation.isPending ? 'animate-spin' : ''
                              }`}
                            />
                          ),
                          disabled: scrapeOngoingMutation.isPending,
                          onSelect: () => {
                            scrapeOngoingMutation.mutate(activeSeason.id);
                          },
                        },
                      ]
                    : []),
                  {
                    label: 'Edit Season',
                    icon: <Edit2 className="size-4" />,
                    onSelect: () => setIsEditSeasonOpen(true),
                  },
                  {
                    label: 'Copy Season ID',
                    icon: <Copy className="size-4" />,
                    onSelect: () => {
                      if (activeSeason) {
                        if (navigator.clipboard?.writeText) {
                          navigator.clipboard.writeText(activeSeason.id);
                        }
                        toast.success('Season ID copied to clipboard');
                      }
                    },
                  },
                  {
                    label: 'Delete Season',
                    icon: <Trash2 className="size-4" />,
                    danger: true,
                    disabled: (series.seasons?.length ?? 0) <= 1,
                    onSelect: () => {
                      if (series.seasons && series.seasons.length <= 1) return;
                      setIsDeleteSeasonOpen(true);
                    },
                  },
                ]}
              />
            </div>
          )}
        </div>

      {(!series.seasons || series.seasons.length === 0) && (
        <div
          className="bg-[var(--surface)] border-2 border-b-4 border-[var(--border)] rounded-[var(--radius)] p-6 text-center"
          role="region"
          aria-label="No seasons"
        >
          <h2 className="text-lg font-extrabold text-[var(--ink)]">
            No seasons yet
          </h2>
          <p className="text-sm font-semibold text-[var(--muted)] mt-1">
            This series has no seasons. Create the first season to start
            organizing episodes.
          </p>
          <ChunkyButton
            type="button"
            onClick={() => setIsAddSeasonOpen(true)}
            className="mt-4"
          >
            <Plus className="size-5" aria-hidden="true" />
            Create First Season
          </ChunkyButton>
        </div>
      )}

      {/* Full-Width Episode Data Table */}
      <EpisodeTable
        episodes={episodes}
        selectedEpisodeId={selectedEpisodeId}
        selectedEpisodeIds={selectedEpisodeIds}
        onSelectedEpisodeIdsChange={setSelectedEpisodeIds}
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
      {selectedEpisodeIds.length > 0 && (
        <div className="bulkbar show" role="toolbar" aria-label="Bulk selection actions">
          <b>
            {selectedEpisodeIds.length} selected
          </b>
          <span className="sp" />
          <ChunkyChip
            variant="blue"
            type="button"
            onClick={() => {
              setBulkScrapeEpisodeIds([...selectedEpisodeIds]);
              setIsBulkScrapeOpen(true);
            }}
          >
            <Plus className="size-4" />
            Add sources
          </ChunkyChip>
          <ChunkyChip
            variant="blue"
            type="button"
            onClick={() => setIsMoveEpisodesOpen(true)}
          >
            <Copy className="size-4" />
            Move to Season
          </ChunkyChip>
          <ChunkyChip
            variant="danger"
            type="button"
            onClick={() => setIsBatchDeleteOpen(true)}
          >
            <Trash2 className="size-4" />
            Delete
          </ChunkyChip>
        </div>
      )}
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
      <MoveEpisodesDialog
        open={isMoveEpisodesOpen}
        onOpenChange={setIsMoveEpisodesOpen}
        seasons={series.seasons ?? []}
        currentSeasonId={activeSeason?.id ?? null}
        selectedCount={selectedEpisodeIds.length}
        episodeCountBySeason={episodeCountBySeason}
        isPending={reorderMutation.isPending}
        onConfirm={handleBulkMoveEpisodes}
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
      <SyncTmdbModal
        open={isSyncTmdbOpen}
        onOpenChange={setIsSyncTmdbOpen}
        series={series}
      />
      <BulkScrapeModal
        open={isBulkScrapeOpen}
        onOpenChange={(open) => {
          setIsBulkScrapeOpen(open);
          if (!open) setBulkScrapeEpisodeIds(null);
        }}
        seriesId={seriesId}
        localEpisodes={
          bulkScrapeEpisodeIds
            ? localEpisodes.filter((ep) => bulkScrapeEpisodeIds.includes(ep.id))
            : localEpisodes
        }
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
      <AddSeasonDialog
        open={isAddSeasonOpen}
        onOpenChange={setIsAddSeasonOpen}
        seriesId={seriesId}
        seasons={series.seasons ?? []}
      />

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
              disabled={
                deleteSeasonMutation.isPending ||
                (series.seasons ? series.seasons.length <= 1 : false)
              }
              onClick={() => {
                if (series.seasons && series.seasons.length <= 1) return;
                if (activeSeason) {
                  deleteSeasonMutation.mutate(activeSeason.id);
                }
              }}
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
