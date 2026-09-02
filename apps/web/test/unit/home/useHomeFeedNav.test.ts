import { renderHook, act } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { useHomeFeedNav } from '@/modules/home/internal/useHomeFeedNav';
import { useInputModeStore } from '@/hooks/useInputMode';

describe('useHomeFeedNav', () => {
  const mockHeroSeriesId = 'hero-series-1';
  const mockRows = [
    {
      items: [{ id: 'series-1-1' }, { id: 'series-1-2' }, { id: 'series-1-3' }],
    },
    {
      items: [{ id: 'series-2-1' }, { id: 'series-2-2' }],
    },
  ];

  beforeEach(() => {
    useInputModeStore.setState({ isSpatialMode: true });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('initializes focus position at (rowIndex: 0, itemIndex: 0)', () => {
    const { result } = renderHook(() =>
      useHomeFeedNav({
        heroSeriesId: mockHeroSeriesId,
        rows: mockRows,
      })
    );

    expect(result.current.focusedRow).toBe(0);
    expect(result.current.focusedItem).toBe(0);
  });

  it('moves focus to row 1 on ArrowDown from row 0', () => {
    const { result } = renderHook(() =>
      useHomeFeedNav({
        heroSeriesId: mockHeroSeriesId,
        rows: mockRows,
      })
    );

    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
    });

    expect(result.current.focusedRow).toBe(1);
    expect(result.current.focusedItem).toBe(0);
  });

  it('clamps at row 0 on ArrowUp from row 0 (does not underflow)', () => {
    const { result } = renderHook(() =>
      useHomeFeedNav({
        heroSeriesId: mockHeroSeriesId,
        rows: mockRows,
      })
    );

    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true }));
    });

    expect(result.current.focusedRow).toBe(0);
    expect(result.current.focusedItem).toBe(0);
  });

  it('increments itemIndex on ArrowRight within a row', () => {
    const { result } = renderHook(() =>
      useHomeFeedNav({
        heroSeriesId: mockHeroSeriesId,
        rows: mockRows,
      })
    );

    // Move to row 1
    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
    });

    // Move right on row 1
    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    });

    expect(result.current.focusedRow).toBe(1);
    expect(result.current.focusedItem).toBe(1);
  });

  it('clamps itemIndex at the last item on ArrowRight (no wrap)', () => {
    const { result } = renderHook(() =>
      useHomeFeedNav({
        heroSeriesId: mockHeroSeriesId,
        rows: mockRows,
      })
    );

    // Move to row 1 (3 items: 0, 1, 2)
    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
    });

    // Press right 5 times
    for (let i = 0; i < 5; i++) {
      act(() => {
        window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
      });
    }

    expect(result.current.focusedRow).toBe(1);
    expect(result.current.focusedItem).toBe(2);
  });

  it('clamps itemIndex at 0 on ArrowLeft when itemIndex is 0', () => {
    const { result } = renderHook(() =>
      useHomeFeedNav({
        heroSeriesId: mockHeroSeriesId,
        rows: mockRows,
      })
    );

    // Move to row 1
    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
    });

    // Press left
    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true }));
    });

    expect(result.current.focusedRow).toBe(1);
    expect(result.current.focusedItem).toBe(0);
  });

  it('clamps at the last row on ArrowDown', () => {
    const { result } = renderHook(() =>
      useHomeFeedNav({
        heroSeriesId: mockHeroSeriesId,
        rows: mockRows,
      })
    );

    // Press down 5 times (only rows 0, 1, 2 exist)
    for (let i = 0; i < 5; i++) {
      act(() => {
        window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
      });
    }

    expect(result.current.focusedRow).toBe(2);
  });

  it('fires onSelectSeries callback with hero series ID on Enter at row 0', () => {
    const onSelectSeries = vi.fn();
    renderHook(() =>
      useHomeFeedNav({
        heroSeriesId: mockHeroSeriesId,
        rows: mockRows,
        onSelectSeries,
      })
    );

    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    });

    expect(onSelectSeries).toHaveBeenCalledTimes(1);
    expect(onSelectSeries).toHaveBeenCalledWith(mockHeroSeriesId);
  });

  it('fires onSelectSeries callback with correct series ID on Enter at carousel card', () => {
    const onSelectSeries = vi.fn();
    renderHook(() =>
      useHomeFeedNav({
        heroSeriesId: mockHeroSeriesId,
        rows: mockRows,
        onSelectSeries,
      })
    );

    // Move down to row 1, right to item 1
    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
    });
    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    });

    // Press Enter
    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    });

    expect(onSelectSeries).toHaveBeenCalledTimes(1);
    expect(onSelectSeries).toHaveBeenCalledWith('series-1-2');
  });

  it('calls scrollIntoView on focused element on position change', () => {
    const elementMock = document.createElement('div');
    const scrollIntoViewSpy = vi.fn();
    elementMock.scrollIntoView = scrollIntoViewSpy;
    elementMock.setAttribute('data-nav-row', '1');
    elementMock.setAttribute('data-nav-item', '0');
    document.body.appendChild(elementMock);

    renderHook(() =>
      useHomeFeedNav({
        heroSeriesId: mockHeroSeriesId,
        rows: mockRows,
      })
    );

    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
    });

    expect(scrollIntoViewSpy).toHaveBeenCalledWith({
      behavior: 'smooth',
      block: 'nearest',
      inline: 'nearest',
    });

    document.body.removeChild(elementMock);
  });

  it('does not respond to keydown events when isSpatialMode is false', () => {
    const onSelectSeries = vi.fn();

    const { result } = renderHook(() =>
      useHomeFeedNav({
        heroSeriesId: mockHeroSeriesId,
        rows: mockRows,
        onSelectSeries,
        isSpatialMode: false,
      })
    );

    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
    });

    expect(result.current.focusedRow).toBe(0);

    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    });

    expect(onSelectSeries).not.toHaveBeenCalled();
  });

  it('cleans up keydown event listener on unmount', () => {
    const { unmount, result } = renderHook(() =>
      useHomeFeedNav({
        heroSeriesId: mockHeroSeriesId,
        rows: mockRows,
      })
    );

    unmount();

    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
    });

    expect(result.current.focusedRow).toBe(0);
  });
});
