import { useState, useMemo } from 'react';
import { Droppable, Draggable } from '@hello-pangea/dnd';
import { ChunkyCheckbox } from '@/components/ui/chunky-checkbox';
import { ChunkyTooltip } from '@/components/ui/chunky-tooltip';
import { ChunkyActionMenu } from '@/components/ui/chunky-action-menu';
import { formatEpisodeDuration } from './formatEpisodeDuration';
import { Edit2, Link as LinkIcon, Trash2, GripVertical, AlertCircle } from 'lucide-react';
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

  // Multi-selection props (bulk actions render in SeriesDetailView sticky bulkbar)
  selectedEpisodeIds?: string[];
  onSelectedEpisodeIdsChange?: (selectedIds: string[]) => void;
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
  selectedEpisodeIds,
  onSelectedEpisodeIdsChange,
}: EpisodeTableProps) {
  const [internalSelectedIds, setInternalSelectedIds] = useState<string[]>([]);
  const isControlledSelection = selectedEpisodeIds !== undefined;
  const activeSelectedIds = isControlledSelection
    ? selectedEpisodeIds
    : internalSelectedIds;

  const updateSelectedIds = (newIds: string[]) => {
    if (!isControlledSelection) {
      setInternalSelectedIds(newIds);
    }
    onSelectedEpisodeIdsChange?.(newIds);
  };

  const [searchQuery, setSearchQuery] = useState('');
  const [sortField, setSortField] = useState<SortField>('order');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');

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
  const hasMultipleSelected = activeSelectedIds.length > 1;
  const isDragDisabled = isFiltered || isCustomSorted || hasMultipleSelected;

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
          comparison = a.title.localeCompare(b.title, undefined, {
            numeric: true,
            sensitivity: 'base',
          });
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

  // Selection calculations on visible (filtered & sorted) episodes
  const visibleEpisodeIds = useMemo(
    () => sortedEpisodes.map((ep) => ep.id),
    [sortedEpisodes]
  );
  const selectedVisibleCount = visibleEpisodeIds.filter((id) =>
    activeSelectedIds.includes(id)
  ).length;

  const allVisibleSelected =
    visibleEpisodeIds.length > 0 &&
    selectedVisibleCount === visibleEpisodeIds.length;
  const isIndeterminate =
    selectedVisibleCount > 0 && selectedVisibleCount < visibleEpisodeIds.length;

  const handleToggleSelectAll = (checked: boolean) => {
    if (checked) {
      const merged = Array.from(
        new Set([...activeSelectedIds, ...visibleEpisodeIds])
      );
      updateSelectedIds(merged);
    } else {
      const remaining = activeSelectedIds.filter(
        (id) => !visibleEpisodeIds.includes(id)
      );
      updateSelectedIds(remaining);
    }
  };

  const handleToggleEpisode = (episodeId: string) => {
    if (activeSelectedIds.includes(episodeId)) {
      updateSelectedIds(activeSelectedIds.filter((id) => id !== episodeId));
    } else {
      updateSelectedIds([...activeSelectedIds, episodeId]);
    }
  };

  const dragDisabledTooltip = hasMultipleSelected
    ? 'Drag-and-drop is disabled while multiple episodes are selected.'
    : isFiltered && isCustomSorted
      ? 'Drag-and-drop is disabled while search filter and custom sorting are active.'
      : isFiltered
        ? 'Drag-and-drop is disabled while search filter is active.'
        : isCustomSorted
          ? 'Drag-and-drop is disabled while custom sorting is active. Sort by Order (Asc) to enable reordering.'
          : '';

  return (
    <div className="flex flex-col space-y-4">
      {/* Search & Status Bar */}
      <div className="bg-[var(--surface)] border-2 border-[var(--border)] rounded-[16px] p-3 flex flex-wrap items-center justify-between gap-3">
        <div className="relative flex-1 min-w-[220px] max-w-[380px]">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search episodes by title or description..."
            className="w-full h-11 px-4 rounded-xl border-2 border-b-4 border-[var(--border)] bg-[var(--bg)] text-sm font-bold text-[var(--ink)] placeholder:text-[var(--muted)] focus:outline-none focus:border-[var(--blue)] transition-all"
            aria-label="Search episodes"
          />
        </div>

        <div className="flex items-center gap-3 ml-auto">
          {isDragDisabled && (
            <ChunkyTooltip content={dragDisabledTooltip}>
              <div
                tabIndex={0}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-500/10 border-2 border-amber-500/30 text-amber-500 text-xs font-extrabold"
              >
                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                <span>Reordering disabled</span>
              </div>
            </ChunkyTooltip>
          )}

          <span className="text-xs font-extrabold tracking-wide uppercase text-[var(--muted)]">
            {sortedEpisodes.length}{' '}
            {sortedEpisodes.length === 1 ? 'episode' : 'episodes'}
          </span>
        </div>
      </div>

      {/* Episode Card Grid Container */}
      <div className="w-full">
        {/* Header Grid Row */}
        <div className="ep-head select-none" role="row">
          {/* Select All Checkbox */}
          <div className="flex items-center justify-center">
            <ChunkyCheckbox
              checked={allVisibleSelected}
              indeterminate={isIndeterminate}
              onCheckedChange={handleToggleSelectAll}
              aria-label="Select all visible episodes"
              disabled={sortedEpisodes.length === 0}
            />
          </div>

          {/* Grip Header placeholder (layout-only: keeps column aligned with body rows) */}
          <span aria-hidden="true" />

          {/* Order Header */}
          <span>
            <button
              type="button"
              onClick={() => handleSort('order')}
              className="flex items-center gap-1 font-extrabold uppercase hover:text-[var(--ink)] cursor-pointer transition-colors"
            >
              <span>#</span>
              <span className="text-[10px]">
                {sortField === 'order'
                  ? sortDirection === 'asc'
                    ? '↑'
                    : '↓'
                  : '↕'}
              </span>
            </button>
          </span>

          {/* Title Header */}
          <span>
            <button
              type="button"
              onClick={() => handleSort('title')}
              className="flex items-center gap-1 font-extrabold uppercase hover:text-[var(--ink)] cursor-pointer transition-colors"
            >
              <span>Title</span>
              <span className="text-[10px]">
                {sortField === 'title'
                  ? sortDirection === 'asc'
                    ? '↑'
                    : '↓'
                  : '↕'}
              </span>
            </button>
          </span>

          {/* Duration Header */}
          <span>
            <button
              type="button"
              onClick={() => handleSort('duration')}
              className="flex items-center gap-1 font-extrabold uppercase hover:text-[var(--ink)] cursor-pointer transition-colors"
            >
              <span>Duration</span>
              <span className="text-[10px]">
                {sortField === 'duration'
                  ? sortDirection === 'asc'
                    ? '↑'
                    : '↓'
                  : '↕'}
              </span>
            </button>
          </span>

          {/* Sources Header */}
          <span className="text-center font-extrabold uppercase">Sources</span>

          {/* Status Header */}
          <span className="font-extrabold uppercase">Status</span>

          {/* Release Date Header */}
          <span>
            <button
              type="button"
              onClick={() => handleSort('releaseDate')}
              className="flex items-center gap-1 font-extrabold uppercase hover:text-[var(--ink)] cursor-pointer transition-colors"
            >
              <span>Release Date</span>
              <span className="text-[10px]">
                {sortField === 'releaseDate'
                  ? sortDirection === 'asc'
                    ? '↑'
                    : '↓'
                  : '↕'}
              </span>
            </button>
          </span>

          {/* Kebab Header placeholder (layout-only: keeps column aligned with body rows) */}
          <span aria-hidden="true" />
        </div>

        {/* List of Episode Cards */}
        <Droppable droppableId="episodes-list" isDropDisabled={isDragDisabled}>
          {(droppableProvided) => (
            <div
              className="ep-list"
              ref={droppableProvided.innerRef}
              {...droppableProvided.droppableProps}
            >
              {sortedEpisodes.length === 0 ? (
                <div className="p-8 text-center rounded-[var(--radius)] border-2 border-b-4 border-[var(--border)] bg-[var(--surface)]">
                  <p className="text-sm font-extrabold text-[var(--ink)]">
                    {isFiltered
                      ? 'No episodes match your search.'
                      : 'No episodes in this season.'}
                  </p>
                  <p className="text-xs font-semibold text-[var(--muted)] mt-1">
                    {isFiltered
                      ? 'Try a different title or description keyword.'
                      : 'Add episodes to this season to get started.'}
                  </p>
                </div>
              ) : (
                sortedEpisodes.map((episode, index) => {
                  const isSelected = selectedEpisodeId === episode.id;
                  const isRowChecked = activeSelectedIds.includes(episode.id);
                  const sourcesCount = episode.videoSources?.length ?? 0;
                  const isReady = sourcesCount > 0;
                  const releaseDate = getReleaseDate(episode);

                  return (
                    <Draggable
                      key={episode.id}
                      draggableId={episode.id}
                      index={index}
                      isDragDisabled={isDragDisabled}
                    >
                      {(draggableProvided, snapshot) => (
                        <div
                          ref={draggableProvided.innerRef}
                          {...draggableProvided.draggableProps}
                          onClick={() => onSelectEpisode?.(episode)}
                          className={`ep ${isRowChecked ? 'sel' : ''} ${
                            isSelected && !isRowChecked ? 'border-[var(--green)] bg-[var(--surface-raised)]' : ''
                          } ${
                            snapshot.isDragging
                              ? 'shadow-2xl z-20 opacity-90 scale-[1.01]'
                              : ''
                          } cursor-pointer`}
                        >
                          {/* Checkbox */}
                          <div
                            className="flex items-center justify-center"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <ChunkyCheckbox
                              checked={isRowChecked}
                              onCheckedChange={() =>
                                handleToggleEpisode(episode.id)
                              }
                              aria-label={`Select ${episode.title}`}
                            />
                          </div>

                          {/* Grip Handle */}
                          <div
                            onClick={(e) => e.stopPropagation()}
                            className="flex items-center justify-center"
                          >
                            <ChunkyTooltip
                              content={
                                isDragDisabled
                                  ? dragDisabledTooltip
                                  : 'Drag to reorder'
                              }
                            >
                              <div
                                {...draggableProvided.dragHandleProps}
                                className={`grip p-1 rounded inline-flex items-center justify-center ${
                                  isDragDisabled
                                    ? 'cursor-not-allowed opacity-30'
                                    : 'cursor-grab active:cursor-grabbing hover:text-[var(--ink)]'
                                }`}
                                aria-label={`Reorder ${episode.title}`}
                              >
                                <GripVertical className="w-4 h-4" />
                              </div>
                            </ChunkyTooltip>
                          </div>

                          {/* Episode Number Badge */}
                          <div className="ep-num">
                            {episode.order ?? index + 1}
                          </div>

                          {/* Title & Description */}
                          <div className="min-w-0 pr-2">
                            <div className="ep-title text-[var(--ink)] truncate">
                              {episode.title}
                            </div>
                            {episode.description && (
                              <div className="ep-desc">
                                {episode.description}
                              </div>
                            )}
                          </div>

                          {/* Duration */}
                          <div className="ep-dur">
                            {formatEpisodeDuration(episode.duration)}
                          </div>

                          {/* Sources Count Pill */}
                          <div className="text-center">
                            <span className="pill src">
                              <span className="dot" />
                              <span>{sourcesCount}</span>
                            </span>
                          </div>

                          {/* Status Pill */}
                          <div>
                            <span
                              className={`pill status ${
                                isReady ? 'ready' : 'no-stream'
                              }`}
                            >
                              {isReady ? 'Ready' : 'No Stream'}
                            </span>
                          </div>

                          {/* Release Date */}
                          <div className="ep-date">
                            {releaseDate || '—'}
                          </div>

                          {/* Kebab Action Menu */}
                          <div
                            className="flex items-center justify-end"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <ChunkyActionMenu
                              triggerLabel={`Actions for ${episode.title}`}
                              className="kebab"
                              items={[
                                {
                                  label: 'Edit',
                                  icon: <Edit2 className="w-4 h-4" />,
                                  onSelect: () => onEditEpisode?.(episode),
                                },
                                ...(onManageSources
                                  ? [
                                      {
                                        label: 'Sources',
                                        icon: <LinkIcon className="w-4 h-4" />,
                                        onSelect: () => onManageSources(episode),
                                      },
                                    ]
                                  : []),
                                {
                                  label: 'Delete',
                                  icon: <Trash2 className="w-4 h-4" />,
                                  danger: true,
                                  onSelect: () => onDeleteEpisode?.(episode),
                                },
                              ]}
                            />
                          </div>
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
      </div>
    </div>
  );
}
