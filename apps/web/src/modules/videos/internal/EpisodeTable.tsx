import { useState, useMemo } from 'react';
import { Droppable, Draggable } from '@hello-pangea/dnd';
import type { SeriesDetails } from './api';

export type Episode = SeriesDetails['episodes'][number];

export type SortField = 'order' | 'title' | 'duration' | 'releaseDate';
export type SortDirection = 'asc' | 'desc';

export interface EpisodeTableProps {
  episodes: Episode[];
  onSelectEpisode?: (episode: Episode) => void;
  onEditEpisode?: (episode: Episode) => void;
  onDeleteEpisode?: (episode: Episode) => void;
  onManageSources?: (episode: Episode) => void;
  selectedEpisodeId?: string | null;
}

function parseDurationToSeconds(duration?: number | string | null): number {
  if (duration === null || duration === undefined) return 0;
  if (typeof duration === 'number') return duration;
  const parts = duration.split(':').map((p) => Number.parseInt(p, 10));
  if (parts.some(Number.isNaN)) return 0;
  if (parts.length === 3) {
    return (parts[0] ?? 0) * 3600 + (parts[1] ?? 0) * 60 + (parts[2] ?? 0);
  }
  if (parts.length === 2) {
    return (parts[0] ?? 0) * 60 + (parts[1] ?? 0);
  }
  if (parts.length === 1) {
    return parts[0] ?? 0;
  }
  return 0;
}

function getReleaseDate(episode: Episode): string {
  if (!episode.createdAt) return '';
  return typeof episode.createdAt === 'string'
    ? episode.createdAt.split('T')[0] ?? ''
    : new Date(episode.createdAt).toISOString().split('T')[0] ?? '';
}

export function EpisodeTable({
  episodes,
  onSelectEpisode,
  onEditEpisode,
  onDeleteEpisode,
  onManageSources,
  selectedEpisodeId,
}: EpisodeTableProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [sortField, setSortField] = useState<SortField>('order');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  const [openMenuEpisodeId, setOpenMenuEpisodeId] = useState<string | null>(null);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const isFiltered = searchQuery.trim().length > 0;
  const isCustomSorted = sortField !== 'order' || sortDirection !== 'asc';
  const isDragDisabled = isFiltered || isCustomSorted;

  const filteredEpisodes = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return episodes;
    return episodes.filter(
      (ep) =>
        ep.title.toLowerCase().includes(q) ||
        (ep.description?.toLowerCase().includes(q) ?? false)
    );
  }, [episodes, searchQuery]);

  const sortedEpisodes = useMemo(() => {
    const sorted = [...filteredEpisodes];
    sorted.sort((a, b) => {
      let comparison = 0;
      switch (sortField) {
        case 'order': {
          const aOrder = a.order ?? 0;
          const bOrder = b.order ?? 0;
          comparison = aOrder - bOrder;
          break;
        }
        case 'title': {
          comparison = a.title.localeCompare(b.title, undefined, { numeric: true, sensitivity: 'base' });
          break;
        }
        case 'duration': {
          const aDur = parseDurationToSeconds(a.duration);
          const bDur = parseDurationToSeconds(b.duration);
          comparison = aDur - bDur;
          break;
        }
        case 'releaseDate': {
          const aDate = getReleaseDate(a);
          const bDate = getReleaseDate(b);
          comparison = aDate.localeCompare(bDate);
          break;
        }
      }
      return sortDirection === 'asc' ? comparison : -comparison;
    });
    return sorted;
  }, [filteredEpisodes, sortField, sortDirection]);

  const dragDisabledTooltip = isFiltered && isCustomSorted
    ? 'Drag-and-drop is disabled while search filter and custom sorting are active.'
    : isFiltered
      ? 'Drag-and-drop is disabled while search filter is active.'
      : isCustomSorted
        ? 'Drag-and-drop is disabled while custom sorting is active. Sort by Order (Asc) to enable reordering.'
        : '';

  return (
    <div className="bg-card border border-c rounded overflow-hidden flex flex-col space-y-0">
      {/* Search & Status Bar */}
      <div className="p-3 border-b border-c flex flex-wrap items-center justify-between gap-2.5">
        <div className="relative flex-1 min-w-[220px] max-w-sm">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search episodes by title or description..."
            className="w-full pl-3 pr-3 py-1.5 rounded border border-c bg-transparent text-xs mono focus:outline-none focus:border-primary placeholder:text-muted"
            aria-label="Search episodes"
          />
        </div>

        <div className="flex items-center gap-3 ml-auto">
          {isDragDisabled && (
            <div
              className="flex items-center gap-1.5 px-2 py-1 rounded bg-amber-500/10 border border-amber-500/30 text-amber-600 dark:text-amber-400 text-xs mono"
              title={dragDisabledTooltip}
            >
              <svg
                width="12"
                height="12"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                className="shrink-0"
              >
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
              <span>Reordering disabled</span>
            </div>
          )}

          <span className="text-xs mono text-muted">
            {sortedEpisodes.length} {sortedEpisodes.length === 1 ? 'episode' : 'episodes'}
          </span>
        </div>
      </div>

      {/* Table responsive container */}
      <div className="overflow-x-auto">
        <Droppable droppableId="episodes-list" isDropDisabled={isDragDisabled}>
          {(droppableProvided) => (
            <table
              className="w-full text-left text-xs border-collapse"
              ref={droppableProvided.innerRef}
              {...droppableProvided.droppableProps}
            >
              <thead>
                <tr className="border-b border-c bg-sidebar text-muted uppercase tracking-wide text-[11px] mono select-none">
                  <th className="w-10 px-3 py-2 text-center">
                    <span className="sr-only">Reorder handle</span>
                  </th>
                  <th className="w-16 px-3 py-2">
                    <button
                      type="button"
                      onClick={() => handleSort('order')}
                      className="flex items-center gap-1 font-mono hover:text-current cursor-pointer transition-colors"
                    >
                      <span>#</span>
                      <span className="text-[10px]">{sortField === 'order' ? (sortDirection === 'asc' ? '↑' : '↓') : '↕'}</span>
                    </button>
                  </th>
                  <th className="px-3 py-2">
                    <button
                      type="button"
                      onClick={() => handleSort('title')}
                      className="flex items-center gap-1 font-mono hover:text-current cursor-pointer transition-colors"
                    >
                      <span>Title</span>
                      <span className="text-[10px]">{sortField === 'title' ? (sortDirection === 'asc' ? '↑' : '↓') : '↕'}</span>
                    </button>
                  </th>
                  <th className="w-24 px-3 py-2">
                    <button
                      type="button"
                      onClick={() => handleSort('duration')}
                      className="flex items-center gap-1 font-mono hover:text-current cursor-pointer transition-colors"
                    >
                      <span>Duration</span>
                      <span className="text-[10px]">{sortField === 'duration' ? (sortDirection === 'asc' ? '↑' : '↓') : '↕'}</span>
                    </button>
                  </th>
                  <th className="w-28 px-3 py-2 text-center">Sources</th>
                  <th className="w-28 px-3 py-2">Status</th>
                  <th className="w-32 px-3 py-2">
                    <button
                      type="button"
                      onClick={() => handleSort('releaseDate')}
                      className="flex items-center gap-1 font-mono hover:text-current cursor-pointer transition-colors"
                    >
                      <span>Release Date</span>
                      <span className="text-[10px]">{sortField === 'releaseDate' ? (sortDirection === 'asc' ? '↑' : '↓') : '↕'}</span>
                    </button>
                  </th>
                  <th className="w-14 px-3 py-2 text-right">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)]">
                {sortedEpisodes.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="p-8 text-center text-xs text-muted mono">
                      {isFiltered ? 'No episodes match your search.' : 'No episodes in this season.'}
                    </td>
                  </tr>
                ) : (
                  sortedEpisodes.map((episode, index) => {
                    const isSelected = selectedEpisodeId === episode.id;
                    const sourcesCount = episode.videoSources?.length ?? 0;
                    const isReady = sourcesCount > 0;
                    const releaseDate = getReleaseDate(episode);
                    const isMenuOpen = openMenuEpisodeId === episode.id;

                    return (
                      <Draggable
                        key={episode.id}
                        draggableId={episode.id}
                        index={index}
                        isDragDisabled={isDragDisabled}
                      >
                        {(draggableProvided, snapshot) => (
                          <tr
                            ref={draggableProvided.innerRef}
                            {...draggableProvided.draggableProps}
                            onClick={() => onSelectEpisode?.(episode)}
                            className={`group cursor-pointer transition-colors ${
                              isSelected
                                ? 'bg-[var(--active)] text-primary font-medium'
                                : 'hover-bg'
                            } ${snapshot.isDragging ? 'bg-[var(--active)] shadow-md opacity-90' : ''}`}
                          >
                            {/* Drag Handle */}
                            <td className="w-10 px-3 py-2 text-center" onClick={(e) => e.stopPropagation()}>
                              <div
                                {...draggableProvided.dragHandleProps}
                                className={`p-1 inline-flex items-center justify-center rounded text-muted hover:text-current ${
                                  isDragDisabled
                                    ? 'cursor-not-allowed opacity-30'
                                    : 'cursor-grab active:cursor-grabbing'
                                }`}
                                title={isDragDisabled ? dragDisabledTooltip : 'Drag to reorder'}
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
                            </td>

                            {/* Order */}
                            <td className="w-16 px-3 py-2 font-mono text-muted">
                              {episode.order ?? index + 1}
                            </td>

                            {/* Title & Description */}
                            <td className="px-3 py-2">
                              <div className="font-medium text-fg break-words leading-tight line-clamp-1">
                                {episode.title}
                              </div>
                              {episode.description && (
                                <div className="text-[11px] text-muted line-clamp-1 mt-0.5 max-w-lg">
                                  {episode.description}
                                </div>
                              )}
                            </td>

                            {/* Duration */}
                            <td className="w-24 px-3 py-2 font-mono text-muted">
                              {episode.duration || '—'}
                            </td>

                            {/* Sources Count */}
                            <td className="w-28 px-3 py-2 text-center">
                              <span className="inline-flex items-center gap-1 font-mono text-[11px] px-2 py-0.5 rounded border border-c bg-sidebar text-muted">
                                <span className={`w-1.5 h-1.5 rounded-full ${isReady ? 'bg-green-500' : 'bg-amber-500'}`} />
                                <span>{sourcesCount}</span>
                              </span>
                            </td>

                            {/* Status */}
                            <td className="w-28 px-3 py-2">
                              {isReady ? (
                                <span className="inline-block text-[10px] mono px-2 py-0.5 rounded bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 font-medium">
                                  Ready
                                </span>
                              ) : (
                                <span className="inline-block text-[10px] mono px-2 py-0.5 rounded bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 font-medium">
                                  No Stream
                                </span>
                              )}
                            </td>

                            {/* Release Date */}
                            <td className="w-32 px-3 py-2 font-mono text-muted">
                              {releaseDate || '—'}
                            </td>

                            {/* Row Actions */}
                            <td className="w-14 px-3 py-2 text-right relative" onClick={(e) => e.stopPropagation()}>
                              <button
                                type="button"
                                onClick={() => setOpenMenuEpisodeId(isMenuOpen ? null : episode.id)}
                                aria-label={`Actions for ${episode.title}`}
                                className="p-1 rounded border border-c hover-bg text-muted hover:text-current transition-colors cursor-pointer"
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

                              {isMenuOpen && (
                                <>
                                  <div
                                    className="fixed inset-0 z-20"
                                    onClick={() => setOpenMenuEpisodeId(null)}
                                  />
                                  <div className="absolute right-3 top-full mt-1 z-30 w-36 bg-card border border-c rounded shadow-md py-1 divide-y divide-[var(--border)] text-xs text-left">
                                    <div className="py-0.5">
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setOpenMenuEpisodeId(null);
                                          onEditEpisode?.(episode);
                                        }}
                                        className="w-full text-left px-3 py-1.5 hover-bg flex items-center gap-2 cursor-pointer text-fg"
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
                                      {onManageSources && (
                                        <button
                                          type="button"
                                          onClick={() => {
                                            setOpenMenuEpisodeId(null);
                                            onManageSources(episode);
                                          }}
                                          className="w-full text-left px-3 py-1.5 hover-bg flex items-center gap-2 cursor-pointer text-fg"
                                        >
                                          <svg
                                            width="12"
                                            height="12"
                                            viewBox="0 0 24 24"
                                            fill="none"
                                            stroke="currentColor"
                                            strokeWidth="2"
                                          >
                                            <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
                                            <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
                                          </svg>
                                          Sources
                                        </button>
                                      )}
                                    </div>
                                    <div className="py-0.5">
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setOpenMenuEpisodeId(null);
                                          onDeleteEpisode?.(episode);
                                        }}
                                        className="w-full text-left px-3 py-1.5 hover-bg text-red-600 dark:text-red-400 flex items-center gap-2 cursor-pointer"
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
                                        Delete
                                      </button>
                                    </div>
                                  </div>
                                </>
                              )}
                            </td>
                          </tr>
                        )}
                      </Draggable>
                    );
                  })
                )}
                {droppableProvided.placeholder}
              </tbody>
            </table>
          )}
        </Droppable>
      </div>
    </div>
  );
}
