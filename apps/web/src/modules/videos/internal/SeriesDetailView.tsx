import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { seriesDetailQueryOptions, type SeriesDetails } from './api';
import { AddMediaDialog } from './AddMediaDialog';
import { useScrapeWorkerStore } from './store/useScrapeWorkerStore';

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
}

export function SeriesDetailView({ seriesId }: SeriesDetailViewProps) {
  const { data: series, isLoading } = useQuery(seriesDetailQueryOptions(seriesId));
  const openDialog = useScrapeWorkerStore((state) => state.openDialog);

  const [selectedEpisodeId, setSelectedEpisodeId] = useState<string | null>(
    null
  );
  const [filterText, setFilterText] = useState<string>('');

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

  const episodes = series.episodes ?? [];

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

  const handleAddEpisode = () => {
    openDialog();
  };

  const handlePlay = (title: string) => {
    toast.info('video.play', {
      description: `Playing ${title}`,
    });
  };

  const handleEdit = (title: string) => {
    toast.info('video.edit', {
      description: `Editing ${title}`,
    });
  };

  const handleDelete = (title: string) => {
    toast.error('video.delete', {
      description: `Deleted ${title}`,
    });
  };

  return (
    <div className="space-y-4">
      {/* Header section */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-semibold tracking-tight">
              {series.title}
            </h1>
            <span className="text-xs mono px-2 py-0.5 rounded border border-c bg-sidebar text-muted">
              {episodes.length} episodes
            </span>
          </div>
          <p className="text-xs text-muted mt-0.5">{series.description}</p>
        </div>

        <button
          onClick={handleAddEpisode}
          type="button"
          className="bg-primary text-primary-fg hover:opacity-90 px-3 py-1.5 rounded text-xs font-medium transition cursor-pointer self-start sm:self-auto flex items-center gap-1.5"
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
          + Add Episode
        </button>
      </div>

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

          <div className="flex-1 overflow-y-auto divide-y divide-[var(--border)]">
            {filteredEpisodes.length === 0 ? (
              <div className="p-4 text-xs text-muted text-center mono">
                No episodes match search.
              </div>
            ) : (
              filteredEpisodes.map((episode) => {
                const isSelected = selectedEpisode?.id === episode.id;
                const formattedDate = episode.createdAt
                  ? typeof episode.createdAt === 'string'
                    ? episode.createdAt.split('T')[0]
                    : new Date(episode.createdAt).toISOString().split('T')[0]
                  : '';
                const tags = getEpisodeTags(episode);

                return (
                  <button
                    key={episode.id}
                    onClick={() => setSelectedEpisodeId(episode.id)}
                    type="button"
                    className={`w-full text-left p-3 flex gap-3 items-start transition-colors cursor-pointer ${
                      isSelected
                        ? 'active-bg bg-[var(--active)] border-l-2 border-[var(--primary)]'
                        : 'hover-bg'
                    }`}
                  >
                    {/* Thumbnail placeholder */}
                    <div className="w-20 h-12 rounded border border-c bg-black/10 dark:bg-white/10 shrink-0 flex items-center justify-center relative overflow-hidden">
                      <svg
                        width="18"
                        height="18"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        className="text-muted"
                      >
                        <polygon points="5 3 19 12 5 21 5 3" />
                      </svg>
                      {episode.duration && (
                        <span className="absolute bottom-1 right-1 text-[9px] mono px-1 rounded bg-black/75 text-white">
                          {episode.duration}
                        </span>
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate text-current">
                        {episode.title}
                      </div>
                      <div className="text-xs mono text-muted mt-0.5 flex items-center gap-2">
                        <span>{formattedDate}</span>
                        <span>•</span>
                        <span>{episode.source}</span>
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
                    </div>
                  </button>
                );
              })
            )}
          </div>
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
                    {selectedEpisode.videoUrl ? (
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

                {/* Mock Actions: Play, Edit, Delete */}
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handlePlay(selectedEpisode.title)}
                    type="button"
                    className="bg-primary text-primary-fg hover:opacity-90 px-3 py-1.5 rounded text-xs font-medium transition cursor-pointer flex items-center gap-1.5"
                  >
                    <svg
                      width="14"
                      height="14"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                    >
                      <polygon points="5 3 19 12 5 21 5 3" />
                    </svg>
                    Play
                  </button>

                  <button
                    onClick={() => handleEdit(selectedEpisode.title)}
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
                    onClick={() => handleDelete(selectedEpisode.title)}
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
              <div className="aspect-video w-full rounded border border-c bg-zinc-950 flex flex-col items-center justify-center relative overflow-hidden group shadow-inner">
                {selectedEpisode.videoUrl ? (
                  <iframe
                    src={selectedEpisode.videoUrl}
                    title={selectedEpisode.title}
                    className="w-full h-full border-0"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                  />
                ) : (
                  <div className="flex flex-col items-center justify-center text-muted text-xs mono">
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
    </div>
  );
}
