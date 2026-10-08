import { act } from '../../../utils';
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { renderHook } from '../../../utils';
import {
  useVideoGestures,
  getGestureZone,
  GESTURE_HINT_STORAGE_KEY,
} from '@/components/media/useVideoGestures';

describe('getGestureZone', () => {
  it('maps < 40% to left, > 60% to right, middle otherwise', () => {
    expect(getGestureZone(100, 1000)).toBe('left');
    expect(getGestureZone(399, 1000)).toBe('left');
    expect(getGestureZone(400, 1000)).toBe('middle');
    expect(getGestureZone(500, 1000)).toBe('middle');
    expect(getGestureZone(600, 1000)).toBe('middle');
    expect(getGestureZone(601, 1000)).toBe('right');
    expect(getGestureZone(900, 1000)).toBe('right');
  });

  it('treats unknown width as middle so nothing is consumed', () => {
    expect(getGestureZone(100, 0)).toBe('middle');
  });
});

describe('useVideoGestures', () => {
  beforeEach(() => {
    window.localStorage.clear();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('double-tapping the left side seeks -10s with a backward ripple', () => {
    const onSeekRelative = vi.fn();
    const { result } = renderHook(() => useVideoGestures({ onSeekRelative }));

    let consumed: boolean = false;
    act(() => {
      consumed = result.current.handleTap(100, 1000, 'touch');
    });
    expect(consumed).toBe(false);
    expect(onSeekRelative).not.toHaveBeenCalled();
    expect(result.current.ripple).toBeNull();

    act(() => {
      consumed = result.current.handleTap(120, 1000, 'touch');
    });
    expect(consumed).toBe(true);
    expect(onSeekRelative).toHaveBeenLastCalledWith(-10);
    expect(result.current.ripple?.direction).toBe('backward');

    // Ripple pill animates out over ~600ms
    act(() => {
      vi.advanceTimersByTime(650);
    });
    expect(result.current.ripple).toBeNull();
  });

  it('double-tapping the right side seeks +10s with a forward ripple', () => {
    const onSeekRelative = vi.fn();
    const { result } = renderHook(() => useVideoGestures({ onSeekRelative }));

    act(() => {
      result.current.handleTap(900, 1000, 'touch');
    });
    let consumed = false;
    act(() => {
      consumed = result.current.handleTap(880, 1000, 'touch');
    });
    expect(consumed).toBe(true);
    expect(onSeekRelative).toHaveBeenLastCalledWith(10);
    expect(result.current.ripple?.direction).toBe('forward');
  });

  it('ignores taps in the middle zone and resets double-tap tracking', () => {
    const onSeekRelative = vi.fn();
    const { result } = renderHook(() => useVideoGestures({ onSeekRelative }));

    act(() => {
      expect(result.current.handleTap(100, 1000, 'touch')).toBe(false);
    });
    // Middle tap resets, so a later left tap starts a fresh sequence
    act(() => {
      expect(result.current.handleTap(500, 1000, 'touch')).toBe(false);
    });
    act(() => {
      expect(result.current.handleTap(100, 1000, 'touch')).toBe(false);
    });
    expect(onSeekRelative).not.toHaveBeenCalled();
  });

  it('ignores slow second taps outside the double-tap window', () => {
    const onSeekRelative = vi.fn();
    const { result } = renderHook(() => useVideoGestures({ onSeekRelative }));

    act(() => {
      result.current.handleTap(100, 1000, 'touch');
    });
    act(() => {
      vi.advanceTimersByTime(400);
    });
    let consumed = false;
    act(() => {
      consumed = result.current.handleTap(100, 1000, 'touch');
    });
    expect(consumed).toBe(false);
    expect(onSeekRelative).not.toHaveBeenCalled();
  });

  it('double-clicking with mouse toggles fullscreen; touch double-clicks do not', () => {
    const onToggleFullscreen = vi.fn();
    const { result } = renderHook(() => useVideoGestures({ onToggleFullscreen }));

    act(() => {
      result.current.handleDoubleClick('mouse');
    });
    expect(onToggleFullscreen).toHaveBeenCalledTimes(1);

    act(() => {
      result.current.handleDoubleClick('touch');
    });
    expect(onToggleFullscreen).toHaveBeenCalledTimes(1);

    // Mouse taps never seek
    const onSeekRelative = vi.fn();
    const { result: touchResult } = renderHook(() =>
      useVideoGestures({ onSeekRelative }),
    );
    act(() => {
      expect(touchResult.current.handleTap(100, 1000, 'touch')).toBe(false);
      expect(touchResult.current.handleTap(100, 1000, 'mouse')).toBe(false);
    });
    expect(onSeekRelative).not.toHaveBeenCalled();
  });

  it('shows the first-time mobile hint for 2.5s and persists dismissal', () => {
    const { result } = renderHook(() => useVideoGestures({}));
    expect(result.current.hintVisible).toBe(true);

    act(() => {
      vi.advanceTimersByTime(2500);
    });
    expect(result.current.hintVisible).toBe(false);
    expect(window.localStorage.getItem(GESTURE_HINT_STORAGE_KEY)).not.toBeNull();
  });

  it('hides the hint when it was already seen and supports manual dismiss', () => {
    window.localStorage.setItem(GESTURE_HINT_STORAGE_KEY, '1');
    const { result } = renderHook(() => useVideoGestures({}));
    expect(result.current.hintVisible).toBe(false);
  });

  it('dismissHint persists immediately', () => {
    const { result } = renderHook(() => useVideoGestures({}));
    expect(result.current.hintVisible).toBe(true);
    act(() => {
      result.current.dismissHint();
    });
    expect(result.current.hintVisible).toBe(false);
    expect(window.localStorage.getItem(GESTURE_HINT_STORAGE_KEY)).not.toBeNull();
  });
});
