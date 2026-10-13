import { renderHook, act } from '../../utils';
import { describe, expect, it, vi } from 'vitest';
import { useEpisodeTable } from '@/modules/videos/internal/seasons/useEpisodeTable';
import type { SeriesDetails } from '@/modules/videos/internal/api';

type Ep = SeriesDetails['episodes'][number];

const mockEpisodes = [
  { id: 'ep-1', title: 'Charlie', order: 3, duration: '24:15', description: 'lorem', createdAt: '2026-01-03T00:00:00.000Z' },
  { id: 'ep-2', title: 'Alpha Episode 10', order: 1, duration: '22:30', description: 'ipsum', createdAt: '2026-01-01T00:00:00.000Z' },
  { id: 'ep-3', title: 'Alpha Episode 2', order: 2, duration: '01:05:00', description: 'dolor', createdAt: '2026-01-02T00:00:00.000Z' },
] as unknown as Ep[];

describe('useEpisodeTable', () => {
  it('toggles selection in uncontrolled mode and notifies', () => {
    const onChange = vi.fn();
    const { result } = renderHook(() =>
      useEpisodeTable({ episodes: mockEpisodes, onSelectedEpisodeIdsChange: onChange })
    );
    act(() => {
      result.current.handleToggleEpisode('ep-1');
    });
    expect(result.current.activeSelectedIds).toEqual(['ep-1']);
    expect(onChange).toHaveBeenCalledWith(['ep-1']);
    act(() => {
      result.current.handleToggleEpisode('ep-1');
    });
    expect(result.current.activeSelectedIds).toEqual([]);
  });

  it('supports controlled selection without internal state', () => {
    const onChange = vi.fn();
    const { result } = renderHook(() =>
      useEpisodeTable({
        episodes: mockEpisodes,
        selectedEpisodeIds: ['ep-2'],
        onSelectedEpisodeIdsChange: onChange,
      })
    );
    expect(result.current.isControlledSelection).toBe(true);
    expect(result.current.activeSelectedIds).toEqual(['ep-2']);
    act(() => {
      result.current.handleToggleSelectAll(true);
    });
    expect(onChange).toHaveBeenCalledWith(expect.arrayContaining(['ep-1', 'ep-2', 'ep-3']));
  });

  it('selects a range on Shift-click', () => {
    const { result } = renderHook(() => useEpisodeTable({ episodes: mockEpisodes }));
    // default sort is by order asc → visible order: ep-2, ep-3, ep-1
    expect(result.current.sortedEpisodes.map((e) => e.id)).toEqual(['ep-2', 'ep-3', 'ep-1']);
    act(() => {
      result.current.handleRowCheckboxClick({ shiftKey: false }, 'ep-2', 0);
    });
    act(() => {
      result.current.handleRowCheckboxClick({ shiftKey: true }, 'ep-1', 2);
    });
    expect(result.current.activeSelectedIds).toEqual(
      expect.arrayContaining(['ep-2', 'ep-3', 'ep-1'])
    );
    expect(result.current.activeSelectedIds).toHaveLength(3);
  });

  it('filters by search query across title and description', () => {
    const { result } = renderHook(() => useEpisodeTable({ episodes: mockEpisodes }));
    act(() => {
      result.current.setSearchQuery('lorem');
    });
    expect(result.current.isFiltered).toBe(true);
    expect(result.current.sortedEpisodes.map((e) => e.id)).toEqual(['ep-1']);
    expect(result.current.isDragDisabled).toBe(true);
  });

  it('sorts by title numerically and toggles direction', () => {
    const { result } = renderHook(() => useEpisodeTable({ episodes: mockEpisodes }));
    act(() => {
      result.current.handleSort('title');
    });
    expect(result.current.sortedEpisodes.map((e) => e.id)).toEqual(['ep-3', 'ep-2', 'ep-1']);
    act(() => {
      result.current.handleSort('title');
    });
    expect(result.current.sortDirection).toBe('desc');
    expect(result.current.sortedEpisodes.map((e) => e.id)).toEqual(['ep-1', 'ep-2', 'ep-3']);
  });

  it('sorts by duration and release date', () => {
    const { result } = renderHook(() => useEpisodeTable({ episodes: mockEpisodes }));
    act(() => {
      result.current.handleSort('duration');
    });
    expect(result.current.sortedEpisodes.map((e) => e.id).slice(0, 1)).toEqual(['ep-2']);
    act(() => {
      result.current.handleSort('releaseDate');
    });
    expect(result.current.sortedEpisodes.map((e) => e.id)).toEqual(['ep-2', 'ep-3', 'ep-1']);
  });

  it('computes select-all and indeterminate state on visible rows', () => {
    const { result } = renderHook(() => useEpisodeTable({ episodes: mockEpisodes }));
    act(() => {
      result.current.setSearchQuery('alpha');
    });
    // visible: ep-2, ep-3
    act(() => {
      result.current.handleToggleEpisode('ep-2');
    });
    expect(result.current.isIndeterminate).toBe(true);
    expect(result.current.allVisibleSelected).toBe(false);
    act(() => {
      result.current.handleToggleSelectAll(true);
    });
    expect(result.current.allVisibleSelected).toBe(true);
  });
});
