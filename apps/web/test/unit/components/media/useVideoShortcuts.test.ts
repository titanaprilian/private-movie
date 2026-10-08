import { fireEvent } from '../../../utils';
import { describe, expect, it, vi } from 'vitest';
import { renderHook } from '../../../utils';
import { useVideoShortcuts } from '@/components/media/useVideoShortcuts';

function setup(overrides = {}) {
  const handlers = {
    onTogglePlay: vi.fn(),
    onSeekRelative: vi.fn(),
    onAdjustVolume: vi.fn(),
    onToggleMute: vi.fn(),
    onToggleFullscreen: vi.fn(),
    ...overrides,
  };
  renderHook(() => useVideoShortcuts(handlers));
  return handlers;
}

function press(key: string) {
  fireEvent.keyDown(document, { key });
}

describe('useVideoShortcuts', () => {
  it('invokes play/pause on Space and k/K, preventing default scroll', () => {
    const h = setup();
    // fireEvent returns false when preventDefault() was called on a cancelable event
    const spacePrevented = fireEvent.keyDown(document, { key: ' ', cancelable: true });
    expect(spacePrevented).toBe(false);
    expect(h.onTogglePlay).toHaveBeenCalledTimes(1);

    press('k');
    expect(h.onTogglePlay).toHaveBeenCalledTimes(2);

    press('K');
    expect(h.onTogglePlay).toHaveBeenCalledTimes(3);
  });

  it('seeks -10s on j/J, +10s on l/L, -5s/+5s on arrows', () => {
    const h = setup();
    press('j');
    expect(h.onSeekRelative).toHaveBeenLastCalledWith(-10);
    press('J');
    expect(h.onSeekRelative).toHaveBeenLastCalledWith(-10);
    press('l');
    expect(h.onSeekRelative).toHaveBeenLastCalledWith(10);
    press('L');
    expect(h.onSeekRelative).toHaveBeenLastCalledWith(10);
    press('ArrowLeft');
    expect(h.onSeekRelative).toHaveBeenLastCalledWith(-5);
    press('ArrowRight');
    expect(h.onSeekRelative).toHaveBeenLastCalledWith(5);
  });

  it('adjusts volume on ArrowUp/ArrowDown and prevents page scrolling', () => {
    const h = setup();
    const upPrevented = fireEvent.keyDown(document, { key: 'ArrowUp', cancelable: true });
    expect(h.onAdjustVolume).toHaveBeenLastCalledWith(0.1);
    expect(upPrevented).toBe(false);

    const downPrevented = fireEvent.keyDown(document, { key: 'ArrowDown', cancelable: true });
    expect(h.onAdjustVolume).toHaveBeenLastCalledWith(-0.1);
    expect(downPrevented).toBe(false);
  });

  it('toggles mute on m/M and fullscreen on f/F', () => {
    const h = setup();
    press('m');
    expect(h.onToggleMute).toHaveBeenCalledTimes(1);
    press('M');
    expect(h.onToggleMute).toHaveBeenCalledTimes(2);
    press('f');
    expect(h.onToggleFullscreen).toHaveBeenCalledTimes(1);
    press('F');
    expect(h.onToggleFullscreen).toHaveBeenCalledTimes(2);
  });

  it('suppresses all shortcuts when focused on input, textarea, select, or contentEditable', () => {
    const h = setup();

    const input = document.createElement('input');
    document.body.appendChild(input);
    Object.defineProperty(document, 'activeElement', { value: input, configurable: true });
    press('k');
    press('f');
    expect(h.onTogglePlay).not.toHaveBeenCalled();
    expect(h.onToggleFullscreen).not.toHaveBeenCalled();

    const textarea = document.createElement('textarea');
    Object.defineProperty(document, 'activeElement', { value: textarea, configurable: true });
    press('k');
    expect(h.onTogglePlay).not.toHaveBeenCalled();

    const select = document.createElement('select');
    Object.defineProperty(document, 'activeElement', { value: select, configurable: true });
    press('m');
    expect(h.onToggleMute).not.toHaveBeenCalled();

    const editable = document.createElement('div');
    Object.defineProperty(editable, 'isContentEditable', { value: true, configurable: true });
    Object.defineProperty(document, 'activeElement', { value: editable, configurable: true });
    press('l');
    expect(h.onSeekRelative).not.toHaveBeenCalled();

    Object.defineProperty(document, 'activeElement', { value: document.body, configurable: true });
    input.remove();
  });

  it('cleans up the keydown listener on unmount', () => {
    const removeSpy = vi.spyOn(document, 'removeEventListener');
    const { unmount } = renderHook(() => useVideoShortcuts({ onTogglePlay: vi.fn() }));
    unmount();
    expect(removeSpy).toHaveBeenCalledWith('keydown', expect.any(Function));
    removeSpy.mockRestore();
  });

  it('does nothing when no callbacks provided', () => {
    renderHook(() => useVideoShortcuts({}));
    expect(() => press('k')).not.toThrow();
  });
});
