import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { toast } from 'sonner';
import {
  DragDropContext,
  Droppable,
  Draggable,
  type DropResult,
} from '@hello-pangea/dnd';
import {
  seriesDetailQueryOptions,
  type SeriesDetails,
  updateEpisode,
  deleteEpisode,
  updateEpisodeOrders,
} from './api';
import { AddMediaDialog } from './AddMediaDialog';
import { ManageSourcesDialog } from './ManageSourcesDialog';
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
import { CustomVideoPlayer } from './CustomVideoPlayer';

import { Button } from '@/components/ui/button';

type Episode = SeriesDetails['episodes'][number];

function getEpisodeTags(episode: Episode): string[] {
  if (episode.tags && episode.tags.length > 0) {
    return episode.tags;
  }
  if (
    episode.metadata &&
    typeof episode.metadata === 'object' &&
    'genres' in episode.metadata &&
    Array.isArray((episode.metadata as { genres?: unknown }).genres)
  ) {
    return (episode.metadata as { genres: string[] }).genres;
  }
  return [];
}

export interface SeriesDetailViewProps {
  seriesId: string;
  initialOrder?: number;
}

export function SeriesDetailView({ seriesId, initialOrder }: SeriesDetailViewProps) {
  const { data: series, isLoading } = useQuery(seriesDetailQueryOptions(seriesId));
  const openDialog = useScrapeWorkerStore((state) => state.openDialog);

  const queryClient = useQueryClient();

  const [localEpisodes, setLocalEpisodes] = useState<Episode[]>([]);

  useEffect(() => {
    if (series?.episodes) {
      setLocalEpisodes(series.episodes);
    }
  }, [series?.episodes]);

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

  const [selectedEpisodeId, setSelectedEpisodeId] = useState<string | null>(
    null
  );
  const [selectedSourceId, setSelectedSourceId] = useState<string | null>(
    null
  );
  const [filterText, setFilterText] = useState<string>('');

  useEffect(() => {
    if (initialOrder !== undefined && localEpisodes.length > 0) {
      const match = localEpisodes.find((e) => e.order === initialOrder);
      if (match) {
        setSelectedEpisodeId(match.id);
      }
    }
  }, [initialOrder, localEpisodes]);

  useEffect(() => {
    setSelectedSourceId(null);
  }, [selectedEpisodeId]);

  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isManageSourcesOpen, setIsManageSourcesOpen] = useState(false);

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

  const episodes = localEpisodes;

  const filteredEpisodes = episodes.filter((episode) => {
    const text = filterText.toLowerCase();
    const matchesSearch =
      episode.title.toLowerCase().includes(text) ||
      (episode.description?.toLowerCase().includes(text) ?? false);
    return matchesSearch;
  });

  const selectedEpisode =
    (selectedEpisodeId
      ? filteredEpisodes.find((e) => e.id === selectedEpisodeId)
      : null) ??
    filteredEpisodes[0] ??
    null;

  const allSources = selectedEpisode?.videoSources ?? [];
  const directSources = allSources.filter((s) => s.type === 'direct');
  const embedSources = allSources.filter((s) => s.type === 'embed');

  const activeSource =
    (selectedSourceId
      ? allSources.find((s) => s.id === selectedSourceId)
      : null) ??
    directSources[0] ??
    allSources[0] ??
    null;

  const handleDragEnd = (result: DropResult) => {
    const { destination, source } = result;

    if (!destination || destination.index === source.index) {
      return;
    }

    const previousEpisodes = [...localEpisodes];
    const nextEpisodes = Array.from(localEpisodes);
    const [moved] = nextEpisodes.splice(source.index, 1);
    nextEpisodes.splice(destination.index, 0, moved);

    setLocalEpisodes(nextEpisodes);

    queryClient.setQueryData(
      ['series', seriesId],
      (old: SeriesDetails | undefined) =>
        old ? { ...old, episodes: nextEpisodes } : old
    );

    const newOrders = nextEpisodes.map((ep, index) => ({
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

  const handleAddEpisode = () => {
    openDialog();
  };

  const handleEdit = () => {
    if (!selectedEpisode) return;
    setEditTitle(selectedEpisode.title ?? '');
    setEditVideoType(selectedEpisode.videoType ?? '');
    setEditDescription(selectedEpisode.description ?? '');
    setIsEditDialogOpen(true);
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

  const handleDelete = () => {
    if (!selectedEpisode) return;
    setIsDeleteDialogOpen(true);
  };

  const handleConfirmDelete = () => {
    if (!selectedEpisode) return;
    deleteMutation.mutate(selectedEpisode.id);
    setIsDeleteDialogOpen(false);
  };

  return (
    <div className="space-y-4">
      {/* Header section */}
      <div className="space-y-2">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-semibold tracking-tight">
              {series.title}
            </h1>
            <span className="text-xs mono px-2 py-0.5 rounded border border-c bg-sidebar text-muted">
              {episodes.length} episodes
            </span>
          </div>

          <button
            onClick={handleAddEpisode}
            type="button"
            className="bg-primary text-primary-fg hover:opacity-90 px-3 py-1.5 rounded text-xs font-medium transition cursor-pointer flex items-center gap-1.5 shrink-0"
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
            Add Episode
          </button>
        </div>

        {series.description && (
          <p className="text-xs text-muted leading-relaxed break-words">{series.description}</p>
        )}
      </div>

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
                to="/videos/$seriesId"
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

      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-2 p-2.5 rounded border border-c bg-card">
        <div className="relative flex-1 min-w-[200px]">
          <input
            type="text"
            value={filterText}
            onChange={(e) => setFilterText(e.target.value)}
            placeholder="Filter episodes..."
            className="w-full pl-3 pr-3 py-1.5 rounded border border-c bg-transparent text-xs mono focus:outline-none focus:border-primary"
          />
        </div>
        <span className="text-xs mono text-muted ml-auto hidden sm:inline-block">
          {filteredEpisodes.length} items
        </span>
      </div>

      {/* Two-pane split view */}
      <div className="border border-c rounded bg-card flex flex-col md:flex-row h-[600px] overflow-hidden">
        {/* Left Pane: Scrollable episode list */}
        <div className="w-full md:w-80 lg:w-96 border-b md:border-b-0 md:border-r border-c flex flex-col shrink-0 h-1/2 md:h-full bg-sidebar">
          <div className="px-3 py-2 border-b border-c flex items-center justify-between">
            <span className="text-xs font-medium mono uppercase tracking-wider text-muted">
              Episodes
            </span>
            <span className="text-[10px] mono px-1.5 py-0.5 rounded border border-c bg-card text-muted">
              {filteredEpisodes.length} items
            </span>
          </div>

          <DragDropContext onDragEnd={handleDragEnd}>
            <Droppable droppableId="episodes-list" isDropDisabled={filterText.trim().length > 0}>
              {(droppableProvided) => (
                <div
                  ref={droppableProvided.innerRef}
                  {...droppableProvided.droppableProps}
                  className="flex-1 overflow-y-auto overflow-x-hidden divide-y divide-[var(--border)]"
                >
                  {filteredEpisodes.length === 0 ? (
                    <div className="p-4 text-xs text-muted text-center mono">
                      No episodes match search.
                    </div>
                  ) : (
                    filteredEpisodes.map((episode, index) => {
                      const isSelected = selectedEpisode?.id === episode.id;
                      const formattedDate = episode.createdAt
                        ? typeof episode.createdAt === 'string'
                          ? episode.createdAt.split('T')[0]
                          : new Date(episode.createdAt).toISOString().split('T')[0]
                        : '';
                      const tags = getEpisodeTags(episode);

                      return (
                        <Draggable
                          key={episode.id}
                          draggableId={episode.id}
                          index={index}
                          isDragDisabled={filterText.trim().length > 0}
                        >
                          {(draggableProvided, snapshot) => (
                            <div
                              ref={draggableProvided.innerRef}
                              {...draggableProvided.draggableProps}
                              className={`w-full text-left p-3 flex gap-2 items-start transition-colors min-w-0 ${
                                isSelected
                                  ? 'active-bg bg-[var(--active)] border-l-2 border-[var(--primary)]'
                                  : 'hover-bg'
                              } ${snapshot.isDragging ? 'bg-[var(--active)] opacity-80 shadow-md' : ''}`}
                            >
                              <div
                                {...draggableProvided.dragHandleProps}
                                className="p-1 cursor-grab active:cursor-grabbing text-muted hover:text-current shrink-0 self-center"
                                title="Drag to reorder"
                                aria-label={`Reorder ${episode.title}`}
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

                              <button
                                onClick={() => setSelectedEpisodeId(episode.id)}
                                type="button"
                                className="flex-1 min-w-0 text-left cursor-pointer bg-transparent border-0 p-0"
                              >
                                <div className="text-sm font-medium text-current break-words leading-snug">
                                  {episode.title}
                                </div>
                                <div className="text-xs mono text-muted mt-1 flex flex-wrap items-center gap-2">
                                  <span>{formattedDate}</span>
                                  <span>•</span>
                                  <span>{episode.source}</span>
                                  {episode.duration && (
                                    <>
                                      <span>•</span>
                                      <span>{episode.duration}</span>
                                    </>
                                  )}
                                </div>
                                <div className="flex flex-wrap gap-1 mt-1.5">
                                  {tags.map((tag) => (
                                    <span
                                      key={tag}
                                      className="text-[10px] mono px-1.5 py-0.2 rounded border border-c bg-card text-muted"
                                    >
                                      {tag}
                                    </span>
                                  ))}
                                </div>
                              </button>
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
        </div>

        {/* Right Pane: Episode detail & preview layout */}
        <div className="flex-1 flex flex-col overflow-y-auto p-4 md:p-6 space-y-5 bg-card">
          {selectedEpisode ? (
            <>
              {/* Header row & action buttons */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-c">
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-lg font-semibold">
                      {selectedEpisode.title}
                    </h2>
                    {allSources.length > 0 ? (
                      <span className="text-[10px] mono px-2 py-0.5 rounded bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
                        Ready
                      </span>
                    ) : (
                      <span className="text-[10px] mono px-2 py-0.5 rounded bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
                        No Stream
                      </span>
                    )}
                  </div>
                  <p className="text-xs mono text-muted mt-0.5">
                    ID: {selectedEpisode.id} • Created{' '}
                    {typeof selectedEpisode.createdAt === 'string'
                      ? selectedEpisode.createdAt.split('T')[0]
                      : new Date(selectedEpisode.createdAt).toISOString().split('T')[0]}
                  </p>
                </div>

                {/* Actions: Sources, Edit, Delete */}
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setIsManageSourcesOpen(true)}
                    type="button"
                    className="border border-c hover-bg px-3 py-1.5 rounded text-xs font-medium transition cursor-pointer flex items-center gap-1.5"
                  >
                    <svg
                      width="14"
                      height="14"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
                      <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
                    </svg>
                    Sources
                  </button>

                  <button
                    onClick={handleEdit}
                    type="button"
                    className="border border-c hover-bg px-3 py-1.5 rounded text-xs font-medium transition cursor-pointer flex items-center gap-1.5"
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
                    Edit
                  </button>

                  <button
                    onClick={handleDelete}
                    type="button"
                    className="border border-red-200 dark:border-red-900/50 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 px-3 py-1.5 rounded text-xs font-medium transition cursor-pointer flex items-center gap-1.5"
                  >
                    <svg
                      width="14"
                      height="14"
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

              {/* Video Player Preview Box */}
              <div className="w-full space-y-3">
                {/* Source Selector Button Group */}
                {allSources.length > 0 && (
                  <div className="flex flex-wrap items-center gap-3 p-2.5 rounded border border-c bg-sidebar text-xs mono">
                    <span className="text-muted font-medium uppercase tracking-wider text-[10px]">
                      Source:
                    </span>
                    {directSources.length > 0 && (
                      <div className="flex items-center gap-1.5">
                        <span className="text-[10px] text-muted uppercase font-semibold px-1">Direct</span>
                        {directSources.map((source) => {
                          const isActive = activeSource?.id === source.id;
                          return (
                            <button
                              key={source.id}
                              type="button"
                              onClick={() => setSelectedSourceId(source.id)}
                              className={`px-2.5 py-1 rounded text-xs font-medium cursor-pointer transition-colors border ${
                                isActive
                                  ? 'bg-primary text-primary-fg border-primary'
                                  : 'bg-card text-fg border-c hover-bg'
                              }`}
                            >
                              {source.label}
                              {source.quality && (
                                <span className="opacity-75 text-[10px] ml-1">({source.quality})</span>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    )}

                    {directSources.length > 0 && embedSources.length > 0 && (
                      <div className="h-4 w-px bg-[var(--border)] my-auto" />
                    )}

                    {embedSources.length > 0 && (
                      <div className="flex items-center gap-1.5">
                        <span className="text-[10px] text-muted uppercase font-semibold px-1">Embed</span>
                        {embedSources.map((source) => {
                          const isActive = activeSource?.id === source.id;
                          return (
                            <button
                              key={source.id}
                              type="button"
                              onClick={() => setSelectedSourceId(source.id)}
                              className={`px-2.5 py-1 rounded text-xs font-medium cursor-pointer transition-colors border ${
                                isActive
                                  ? 'bg-primary text-primary-fg border-primary'
                                  : 'bg-card text-fg border-c hover-bg'
                              }`}
                            >
                              {source.label}
                              {source.quality && (
                                <span className="opacity-75 text-[10px] ml-1">({source.quality})</span>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}

                {activeSource ? (
                  activeSource.type === 'direct' ? (
                    <CustomVideoPlayer
                      src={activeSource.url}
                      title={selectedEpisode.title}
                      seriesId={seriesId}
                      currentOrder={selectedEpisode.order ?? 1}
                      onNextEpisode={() => {
                        const currentOrd = selectedEpisode.order ?? 1;
                        const nextEp = episodes.find((e) => (e.order ?? 1) === currentOrd + 1);
                        if (nextEp) {
                          setSelectedEpisodeId(nextEp.id);
                        }
                      }}
                    />
                  ) : (
                    <div className="aspect-video w-full rounded border border-c bg-black overflow-hidden">
                      <iframe
                        src={activeSource.url}
                        title={selectedEpisode.title}
                        allowFullScreen
                        className="w-full h-full border-0"
                      />
                    </div>
                  )
                ) : (
                  <div className="aspect-video w-full rounded border border-c bg-zinc-950 flex flex-col items-center justify-center text-muted text-xs mono">
                    <svg
                      width="24"
                      height="24"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      className="mb-2 opacity-50"
                    >
                      <polygon points="5 3 19 12 5 21 5 3" />
                    </svg>
                    <span>No Stream Available</span>
                  </div>
                )}
              </div>

              {/* Episode Description */}
              <div>
                <h3 className="text-xs font-medium mono uppercase tracking-wider text-muted mb-1">
                  Description
                </h3>
                <p className="text-sm text-current leading-relaxed">
                  {selectedEpisode.description || 'No description provided.'}
                </p>
              </div>

              {/* Metadata Grid */}
              <div>
                <h3 className="text-xs font-medium mono uppercase tracking-wider text-muted mb-2">
                  Episode Metadata
                </h3>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 p-3 rounded border border-c bg-sidebar text-xs mono">
                  <div>
                    <div className="text-muted">Duration</div>
                    <div className="font-semibold text-current mt-0.5">
                      {selectedEpisode.duration ?? 'N/A'}
                    </div>
                  </div>
                  <div>
                    <div className="text-muted">Resolution</div>
                    <div className="font-semibold text-current mt-0.5">
                      {selectedEpisode.resolution ?? 'N/A'}
                    </div>
                  </div>
                  <div>
                    <div className="text-muted">Format</div>
                    <div className="font-semibold text-current mt-0.5">
                      {selectedEpisode.format ?? 'N/A'}
                    </div>
                  </div>
                  <div>
                    <div className="text-muted">File Size</div>
                    <div className="font-semibold text-current mt-0.5">
                      {selectedEpisode.size ?? 'N/A'}
                    </div>
                  </div>
                  <div>
                    <div className="text-muted">Source</div>
                    <div className="font-semibold text-current mt-0.5">
                      {selectedEpisode.source}
                    </div>
                  </div>
                  <div>
                    <div className="text-muted">Tags</div>
                    <div className="flex flex-wrap gap-1 mt-0.5">
                      {getEpisodeTags(selectedEpisode).map((t) => (
                        <span
                          key={t}
                          className="px-1.5 py-0.2 rounded border border-c bg-card text-[10px]"
                        >
                          {t}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-xs text-muted mono">
              No episode selected.
            </div>
          )}
        </div>
      </div>
      <AddMediaDialog />

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
        onOpenChange={setIsManageSourcesOpen}
        episode={selectedEpisode}
        seriesId={seriesId}
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
    </div>
  );
}
