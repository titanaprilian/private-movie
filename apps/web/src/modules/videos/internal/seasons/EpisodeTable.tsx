import { useState, useMemo, useRef } from 'react';
import { Droppable, Draggable } from '@hello-pangea/dnd';
import { Search, Edit2, Link as LinkIcon, Trash2, GripVertical, AlertCircle } from 'lucide-react';
import { ChunkyCheckbox } from '@/components/ui/chunky-checkbox';
import { ChunkyTooltip } from '@/components/ui/chunky-tooltip';
import { ChunkyActionMenu } from '@/components/ui/chunky-action-menu';
import { ChunkyInput } from '@/components/ui/chunky-input';
import {
  ChunkyTable,
  ChunkyTableToolbar,
  ChunkyTableHeader,
  ChunkyTableHeaderCell,
  ChunkyTableBody,
  ChunkyTableRow,
  ChunkyTableCell,
  ChunkyTableIndexBadge,
} from '@/components/ui/chunky-table';
import { formatEpisodeDuration } from './formatEpisodeDuration';
import type { SeriesDetails } from '../api';

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

const ROW_GRID = 'grid-cols-[24px_20px_44px_minmax(0,1fr)_84px_76px_92px_116px_40px]';

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

  // Anchor index (into the visible sorted list) of the most recently toggled
  // row checkbox. Used for Shift-click range selection.
  const lastToggledIndexRef = useRef<number | null>(null);

  const handleRowCheckboxClick = (
    e: React.MouseEvent,
    episodeId: string,
    visibleIndex: number
  ) => {
    const anchorIndex = lastToggledIndexRef.current;
    if (e.shiftKey && anchorIndex !== null && anchorIndex !== visibleIndex) {
      const start = Math.min(anchorIndex, visibleIndex);
      const end = Math.max(anchorIndex, visibleIndex);
      const rangeIds = sortedEpisodes.slice(start, end + 1).map((ep) => ep.id);
      // Target state follows the clicked row: selecting when it is currently
      // unselected, deselecting when it is currently selected.
      if (activeSelectedIds.includes(episodeId)) {
        const rangeSet = new Set(rangeIds);
        updateSelectedIds(activeSelectedIds.filter((id) => !rangeSet.has(id)));
      } else {
        updateSelectedIds(Array.from(new Set([...activeSelectedIds, ...rangeIds])));
      }
    } else {
      handleToggleEpisode(episodeId);
    }
    lastToggledIndexRef.current = visibleIndex;
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
    <ChunkyTable data-testid="episode-table">
      {/* Search & Status Bar */}
      <ChunkyTableToolbar className="flex flex-wrap items-center justify-between gap-3">
        <div className="relative flex-1 min-w-[220px] max-w-[380px]">
          <Search
            aria-hidden="true"
            className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-[var(--muted)] pointer-events-none"
          />
          <ChunkyInput
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search episodes by title or description..."
            aria-label="Search episodes"
            className="pl-10"
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
      </ChunkyTableToolbar>

      {/* Episode Card Grid Container */}
      <div className="w-full">
        {/* Header Grid Row */}
        <ChunkyTableHeader
          data-testid="episode-table-header"
          className={ROW_GRID}
          role="row"
        >
          {/* Select All Checkbox */}
          <ChunkyTableCell className="flex items-center justify-center">
            <ChunkyCheckbox
              checked={allVisibleSelected}
              indeterminate={isIndeterminate}
              onCheckedChange={handleToggleSelectAll}
              aria-label="Select all visible episodes"
              disabled={sortedEpisodes.length === 0}
            />
          </ChunkyTableCell>

          {/* Grip Header placeholder (layout-only: keeps column aligned with body rows) */}
          <span aria-hidden="true" />

          {/* Order Header */}
          <ChunkyTableHeaderCell
            sortable
            sortDirection={sortField === 'order' ? sortDirection : null}
            onSort={() => handleSort('order')}
            aria-label="Sort by order"
          >
            #
          </ChunkyTableHeaderCell>

          {/* Title Header */}
          <ChunkyTableHeaderCell
            sortable
            sortDirection={sortField === 'title' ? sortDirection : null}
            onSort={() => handleSort('title')}
            aria-label="Sort by title"
          >
            Title
          </ChunkyTableHeaderCell>

          {/* Duration Header */}
          <ChunkyTableHeaderCell
            sortable
            sortDirection={sortField === 'duration' ? sortDirection : null}
            onSort={() => handleSort('duration')}
            aria-label="Sort by duration"
          >
            Duration
          </ChunkyTableHeaderCell>

          {/* Sources Header */}
          <ChunkyTableHeaderCell className="text-center">
            Sources
          </ChunkyTableHeaderCell>

          {/* Status Header */}
          <ChunkyTableHeaderCell>Status</ChunkyTableHeaderCell>

          {/* Release Date Header */}
          <ChunkyTableHeaderCell
            sortable
            sortDirection={sortField === 'releaseDate' ? sortDirection : null}
            onSort={() => handleSort('releaseDate')}
            aria-label="Sort by release date"
          >
            Release Date
          </ChunkyTableHeaderCell>

          {/* Kebab Header placeholder (layout-only: keeps column aligned with body rows) */}
          <span aria-hidden="true" />
        </ChunkyTableHeader>

        {/* List of Episode Cards */}
        <Droppable droppableId="episodes-list" isDropDisabled={isDragDisabled}>
          {(droppableProvided) => (
            <div
              data-testid="episode-list"
              ref={droppableProvided.innerRef}
              {...droppableProvided.droppableProps}
            >
              <ChunkyTableBody>
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
                          <ChunkyTableRow
                            ref={draggableProvided.innerRef}
                            {...draggableProvided.draggableProps}
                            onClick={() => onSelectEpisode?.(episode)}
                            selected={isRowChecked}
                            interactive
                            dragging={snapshot.isDragging}
                            data-testid={`episode-row-${episode.id}`}
                            className={`grid items-center gap-3.5 p-3 ${ROW_GRID} ${
                              isSelected && !isRowChecked
                                ? 'border-[var(--green)] bg-[var(--surface-raised)]'
                                : ''
                            }`}
                          >
                            {/* Checkbox */}
                            <ChunkyTableCell
                              className="flex items-center justify-center"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <ChunkyCheckbox
                                checked={isRowChecked}
                                onClick={(e) =>
                                  handleRowCheckboxClick(e, episode.id, index)
                                }
                                aria-label={`Select ${episode.title}`}
                              />
                            </ChunkyTableCell>

                            {/* Grip Handle */}
                            <ChunkyTableCell
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
                            </ChunkyTableCell>

                            {/* Episode Number Badge */}
                            <ChunkyTableCell className="flex justify-center">
                              <ChunkyTableIndexBadge
                                index={episode.order ?? index + 1}
                              />
                            </ChunkyTableCell>

                            {/* Title & Description */}
                            <ChunkyTableCell className="pr-2">
                              <div
                                data-testid={`episode-title-${episode.id}`}
                                className="text-[15px] font-extrabold leading-snug text-[var(--ink)] truncate"
                              >
                                {episode.title}
                              </div>
                              {episode.description && (
                                <div className="mt-0.5 truncate text-[13px] font-semibold text-[var(--muted)]">
                                  {episode.description}
                                </div>
                              )}
                            </ChunkyTableCell>

                            {/* Duration */}
                            <ChunkyTableCell className="text-[13px] font-bold text-[var(--muted)]">
                              {formatEpisodeDuration(episode.duration)}
                            </ChunkyTableCell>

                            {/* Sources Count Pill */}
                            <ChunkyTableCell className="text-center">
                              <span className="pill src">
                                <span className="dot" />
                                <span>{sourcesCount}</span>
                              </span>
                            </ChunkyTableCell>

                            {/* Status Pill */}
                            <ChunkyTableCell>
                              <span
                                className={`pill status ${
                                  isReady ? 'ready' : 'no-stream'
                                }`}
                              >
                                {isReady ? 'Ready' : 'No Stream'}
                              </span>
                            </ChunkyTableCell>

                            {/* Release Date */}
                            <ChunkyTableCell className="text-[13px] font-bold text-[var(--muted)]">
                              {releaseDate || '—'}
                            </ChunkyTableCell>

                            {/* Kebab Action Menu */}
                            <ChunkyTableCell
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
                            </ChunkyTableCell>
                          </ChunkyTableRow>
                        )}
                      </Draggable>
                    );
                  })
                )}
              </ChunkyTableBody>
              {droppableProvided.placeholder}
            </div>
          )}
        </Droppable>
      </div>
    </ChunkyTable>
  );
}
