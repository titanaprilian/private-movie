import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useWatchNav } from '@/modules/watch/internal/useWatchNav';

function dispatchKey(key: string) {
  act(() => {
    window.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }));
  });
}

describe('useWatchNav', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    Object.defineProperty(document, 'fullscreenElement', {
      value: null,
      writable: true,
      configurable: true,
    });
  });

  it('initial zone is controls and focusIndex is 0', () => {
    const { result } = renderHook(() => useWatchNav({ controlsCount: 4, episodesCount: 5 }));
    expect(result.current.activeZone).toBe('controls');
    expect(result.current.focusIndex).toBe(0);
  });

  it('ArrowUp from controls transitions to player', () => {
    const iframe = document.createElement('iframe');
    iframe.setAttribute('data-testid', 'watch-player');
    document.body.appendChild(iframe);
    const mockDispatch = vi.fn();
    Object.defineProperty(iframe, 'contentWindow', {
      value: { dispatchEvent: mockDispatch },
      writable: true,
      configurable: true,
    });
    const { result } = renderHook(() => useWatchNav({ controlsCount: 4, episodesCount: 5 }));
    dispatchKey('ArrowUp');
    expect(result.current.activeZone).toBe('player');
  });

  it('ArrowUp from player transitions to back', () => {
    const { result } = renderHook(() => useWatchNav({ controlsCount: 4, episodesCount: 5 }));
    dispatchKey('ArrowUp');
    expect(result.current.activeZone).toBe('player');
    dispatchKey('ArrowUp');
    expect(result.current.activeZone).toBe('back');
  });

  it('ArrowDown from back transitions to player', () => {
    const iframe = document.createElement('iframe');
    iframe.setAttribute('data-testid', 'watch-player');
    document.body.appendChild(iframe);
    const mockDispatch = vi.fn();
    Object.defineProperty(iframe, 'contentWindow', {
      value: { dispatchEvent: mockDispatch },
      writable: true,
      configurable: true,
    });
    const { result } = renderHook(() => useWatchNav({ controlsCount: 4, episodesCount: 5 }));
    dispatchKey('ArrowUp');
    dispatchKey('ArrowUp');
    expect(result.current.activeZone).toBe('back');
    mockDispatch.mockClear();
    dispatchKey('ArrowDown');
    expect(result.current.activeZone).toBe('player');
  });

  it('ArrowDown from player transitions to controls', () => {
    const { result } = renderHook(() => useWatchNav({ controlsCount: 4, episodesCount: 5 }));
    dispatchKey('ArrowUp');
    expect(result.current.activeZone).toBe('player');
    dispatchKey('ArrowDown');
    expect(result.current.activeZone).toBe('controls');
  });

  it('ArrowRight from player transitions to episodes', () => {
    const iframe = document.createElement('iframe');
    iframe.setAttribute('data-testid', 'watch-player');
    document.body.appendChild(iframe);
    const mockDispatch = vi.fn();
    Object.defineProperty(iframe, 'contentWindow', {
      value: { dispatchEvent: mockDispatch },
      writable: true,
      configurable: true,
    });
    const { result } = renderHook(() => useWatchNav({ controlsCount: 4, episodesCount: 5 }));
    dispatchKey('ArrowUp');
    expect(result.current.activeZone).toBe('player');
    dispatchKey('ArrowRight');
    expect(result.current.activeZone).toBe('episodes');
  });

  it('ArrowRight at the last item of controls transitions to episodes', () => {
    const { result } = renderHook(() => useWatchNav({ controlsCount: 3, episodesCount: 5 }));
    dispatchKey('ArrowRight');
    dispatchKey('ArrowRight');
    expect(result.current.activeZone).toBe('controls');
    expect(result.current.focusIndex).toBe(2);
    dispatchKey('ArrowRight');
    expect(result.current.activeZone).toBe('episodes');
    expect(result.current.focusIndex).toBe(0);
  });

  it('ArrowLeft from episodes transitions to controls', () => {
    const { result } = renderHook(() => useWatchNav({ controlsCount: 3, episodesCount: 5 }));
    dispatchKey('ArrowRight');
    dispatchKey('ArrowRight');
    dispatchKey('ArrowRight');
    expect(result.current.activeZone).toBe('episodes');
    dispatchKey('ArrowLeft');
    expect(result.current.activeZone).toBe('controls');
  });

  it('Transitioning into player zone dispatches f KeyboardEvent', () => {
    const iframe = document.createElement('iframe');
    iframe.setAttribute('data-testid', 'watch-player');
    document.body.appendChild(iframe);
    const mockDispatch = vi.fn();
    Object.defineProperty(iframe, 'contentWindow', {
      value: { dispatchEvent: mockDispatch },
      writable: true,
      configurable: true,
    });
    renderHook(() => useWatchNav({ controlsCount: 4, episodesCount: 5 }));
    dispatchKey('ArrowUp');
    expect(mockDispatch).toHaveBeenCalledWith(expect.objectContaining({ key: 'f' }));
  });

  it('Enter while in player zone dispatches Space', () => {
    const iframe = document.createElement('iframe');
    iframe.setAttribute('data-testid', 'watch-player');
    document.body.appendChild(iframe);
    const mockDispatch = vi.fn();
    Object.defineProperty(iframe, 'contentWindow', {
      value: { dispatchEvent: mockDispatch },
      writable: true,
      configurable: true,
    });
    renderHook(() => useWatchNav({ controlsCount: 4, episodesCount: 5 }));
    dispatchKey('ArrowUp');
    mockDispatch.mockClear();
    dispatchKey('Enter');
    const keys = mockDispatch.mock.calls.map((c) => (c[0] as KeyboardEvent).key);
    expect(keys.some((k) => k === ' ' || k === 'Space')).toBe(true);
  });

  it('ArrowRight while in player zone dispatches ArrowRight', () => {
    const iframe = document.createElement('iframe');
    iframe.setAttribute('data-testid', 'watch-player');
    document.body.appendChild(iframe);
    const mockDispatch = vi.fn();
    Object.defineProperty(iframe, 'contentWindow', {
      value: { dispatchEvent: mockDispatch },
      writable: true,
      configurable: true,
    });
    renderHook(() => useWatchNav({ controlsCount: 4, episodesCount: 5 }));
    dispatchKey('ArrowUp');
    mockDispatch.mockClear();
    dispatchKey('ArrowRight');
    expect(mockDispatch).toHaveBeenCalledWith(expect.objectContaining({ key: 'ArrowRight' }));
  });

  it('ArrowUp while in player zone transitions to back (not forwarded)', () => {
    const iframe = document.createElement('iframe');
    iframe.setAttribute('data-testid', 'watch-player');
    document.body.appendChild(iframe);
    const mockDispatch = vi.fn();
    Object.defineProperty(iframe, 'contentWindow', {
      value: { dispatchEvent: mockDispatch },
      writable: true,
      configurable: true,
    });
    const { result } = renderHook(() => useWatchNav({ controlsCount: 4, episodesCount: 5 }));
    dispatchKey('ArrowUp');
    mockDispatch.mockClear();
    dispatchKey('ArrowUp');
    expect(result.current.activeZone).toBe('back');
    expect(mockDispatch).not.toHaveBeenCalled();
  });

  it('fullscreenchange while in player zone -> zone becomes controls', () => {
    const btn = document.createElement('button');
    btn.setAttribute('aria-label', 'Prev episode');
    btn.focus = vi.fn();
    document.body.appendChild(btn);
    const iframe = document.createElement('iframe');
    iframe.setAttribute('data-testid', 'watch-player');
    document.body.appendChild(iframe);
    const mockDispatch = vi.fn();
    Object.defineProperty(iframe, 'contentWindow', {
      value: { dispatchEvent: mockDispatch },
      writable: true,
      configurable: true,
    });
    const { result } = renderHook(() => useWatchNav({ controlsCount: 4, episodesCount: 5 }));
    dispatchKey('ArrowUp');
    expect(result.current.activeZone).toBe('player');
    Object.defineProperty(document, 'fullscreenElement', {
      value: null,
      writable: true,
      configurable: true,
    });
    act(() => {
      document.dispatchEvent(new Event('fullscreenchange'));
    });
    expect(result.current.activeZone).toBe('controls');
  });

  it('iframe dispatch failures are caught silently', () => {
    const iframe = document.createElement('iframe');
    iframe.setAttribute('data-testid', 'watch-player');
    document.body.appendChild(iframe);
    Object.defineProperty(iframe, 'contentWindow', {
      get() {
        throw new Error('cross-origin');
      },
      configurable: true,
    });
    const { result } = renderHook(() => useWatchNav({ controlsCount: 4, episodesCount: 5 }));
    expect(() => dispatchKey('ArrowUp')).not.toThrow();
    expect(result.current.activeZone).toBe('player');
  });

  it('event listeners are cleaned up on unmount', () => {
    const addSpy = vi.spyOn(window, 'addEventListener');
    const removeSpy = vi.spyOn(window, 'removeEventListener');
    const docAdd = vi.spyOn(document, 'addEventListener');
    const docRemove = vi.spyOn(document, 'removeEventListener');
    const { unmount } = renderHook(() => useWatchNav({ controlsCount: 4, episodesCount: 5 }));
    expect(addSpy).toHaveBeenCalledWith('keydown', expect.any(Function));
    expect(docAdd).toHaveBeenCalledWith('fullscreenchange', expect.any(Function));
    unmount();
    expect(removeSpy).toHaveBeenCalledWith('keydown', expect.any(Function));
    expect(docRemove).toHaveBeenCalledWith('fullscreenchange', expect.any(Function));
    addSpy.mockRestore();
    removeSpy.mockRestore();
    docAdd.mockRestore();
    docRemove.mockRestore();
  });

  it('ArrowLeft dispatches ArrowLeft in player zone', () => {
    const iframe = document.createElement('iframe');
    iframe.setAttribute('data-testid', 'watch-player');
    document.body.appendChild(iframe);
    const mockDispatch = vi.fn();
    Object.defineProperty(iframe, 'contentWindow', {
      value: { dispatchEvent: mockDispatch },
      writable: true,
      configurable: true,
    });
    renderHook(() => useWatchNav({ controlsCount: 4, episodesCount: 5 }));
    dispatchKey('ArrowUp');
    mockDispatch.mockClear();
    dispatchKey('ArrowLeft');
    expect(mockDispatch).toHaveBeenCalledWith(expect.objectContaining({ key: 'ArrowLeft' }));
  });

  it('episodes ArrowUp/ArrowDown moves focusIndex', () => {
    const { result } = renderHook(() => useWatchNav({ controlsCount: 3, episodesCount: 5 }));
    dispatchKey('ArrowRight');
    dispatchKey('ArrowRight');
    dispatchKey('ArrowRight');
    expect(result.current.activeZone).toBe('episodes');
    dispatchKey('ArrowDown');
    expect(result.current.focusIndex).toBe(1);
    dispatchKey('ArrowUp');
    expect(result.current.focusIndex).toBe(0);
  });
});
