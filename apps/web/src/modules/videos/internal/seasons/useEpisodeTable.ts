import { useMemo, useRef, useState } from 'react';
import type { SeriesDetails } from '../api';

export type EpisodeTableEpisode = SeriesDetails['episodes'][number];

export type EpisodeTableSortField = 'order' | 'title' | 'duration' | 'releaseDate';
export type EpisodeTableSortDirection = 'asc' | 'desc';

export interface UseEpisodeTableOptions {
  episodes: EpisodeTableEpisode[];
  selectedEpisodeIds?: string[];
  onSelectedEpisodeIdsChange?: (selectedIds: string[]) => void;
}

export function parseEpisodeDurationToSeconds(
  duration?: number | string | null
): number {
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

export function getEpisodeReleaseDate(episode: EpisodeTableEpisode): string {
  if (!episode.createdAt) return '';
  return typeof episode.createdAt === 'string'
    ? episode.createdAt.split('T')[0] ?? ''
    : new Date(episode.createdAt).toISOString().split('T')[0] ?? '';
}

export function useEpisodeTable({
  episodes,
  selectedEpisodeIds,
  onSelectedEpisodeIdsChange,
}: UseEpisodeTableOptions) {
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
  const [sortField, setSortField] =
    useState<EpisodeTableSortField>('order');
  const [sortDirection, setSortDirection] =
    useState<EpisodeTableSortDirection>('asc');

  const handleSort = (field: EpisodeTableSortField) => {
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
          const aDur = parseEpisodeDurationToSeconds(a.duration);
          const bDur = parseEpisodeDurationToSeconds(b.duration);
          comparison = aDur - bDur;
          break;
        }
        case 'releaseDate': {
          const aDate = getEpisodeReleaseDate(a);
          const bDate = getEpisodeReleaseDate(b);
          comparison = aDate.localeCompare(bDate);
          break;
        }
      }
      return sortDirection === 'asc' ? comparison : -comparison;
    });
    return sorted;
  }, [filteredEpisodes, sortField, sortDirection]);

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

  const lastToggledIndexRef = useRef<number | null>(null);

  const handleRowCheckboxClick = (
    e: { shiftKey: boolean },
    episodeId: string,
    visibleIndex: number
  ) => {
    const anchorIndex = lastToggledIndexRef.current;
    if (e.shiftKey && anchorIndex !== null && anchorIndex !== visibleIndex) {
      const start = Math.min(anchorIndex, visibleIndex);
      const end = Math.max(anchorIndex, visibleIndex);
      const rangeIds = sortedEpisodes.slice(start, end + 1).map((ep) => ep.id);
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

  return {
    searchQuery,
    setSearchQuery,
    sortField,
    sortDirection,
    handleSort,
    isFiltered,
    isCustomSorted,
    hasMultipleSelected,
    isDragDisabled,
    dragDisabledTooltip,
    filteredEpisodes,
    sortedEpisodes,
    visibleEpisodeIds,
    selectedVisibleCount,
    allVisibleSelected,
    isIndeterminate,
    activeSelectedIds,
    isControlledSelection,
    updateSelectedIds,
    handleToggleSelectAll,
    handleToggleEpisode,
    handleRowCheckboxClick,
  };
}
