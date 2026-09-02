import { renderHook, act } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useInputMode, useInputModeStore } from '@/hooks/useInputMode';

describe('useInputMode', () => {
  beforeEach(() => {
    useInputModeStore.setState({ isSpatialMode: false });
  });

  it('initializes with isSpatialMode as false', () => {
    const { result } = renderHook(() => useInputMode());
    expect(result.current.isSpatialMode).toBe(false);
  });

  it('sets isSpatialMode to true when an arrow key is pressed', () => {
    const { result } = renderHook(() => useInputMode());

    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown' }));
    });
    expect(result.current.isSpatialMode).toBe(true);

    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp' }));
    });
    expect(result.current.isSpatialMode).toBe(true);

    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft' }));
    });
    expect(result.current.isSpatialMode).toBe(true);

    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight' }));
    });
    expect(result.current.isSpatialMode).toBe(true);
  });

  it('does not change isSpatialMode when non-arrow keys are pressed', () => {
    const { result } = renderHook(() => useInputMode());

    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab' }));
    });
    expect(result.current.isSpatialMode).toBe(false);

    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
    });
    expect(result.current.isSpatialMode).toBe(false);

    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'a' }));
    });
    expect(result.current.isSpatialMode).toBe(false);
  });

  it('sets isSpatialMode to false when mousemove occurs', () => {
    const { result } = renderHook(() => useInputMode());

    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp' }));
    });
    expect(result.current.isSpatialMode).toBe(true);

    act(() => {
      window.dispatchEvent(new MouseEvent('mousemove'));
    });
    expect(result.current.isSpatialMode).toBe(false);
  });

  it('sets isSpatialMode to false when touchstart occurs', () => {
    const { result } = renderHook(() => useInputMode());

    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight' }));
    });
    expect(result.current.isSpatialMode).toBe(true);

    act(() => {
      window.dispatchEvent(new Event('touchstart'));
    });
    expect(result.current.isSpatialMode).toBe(false);
  });

  it('cleans up event listeners on unmount', () => {
    const addEventListenerSpy = vi.spyOn(window, 'addEventListener');
    const removeEventListenerSpy = vi.spyOn(window, 'removeEventListener');

    const { unmount } = renderHook(() => useInputMode());

    expect(addEventListenerSpy).toHaveBeenCalledWith('keydown', expect.any(Function));
    expect(addEventListenerSpy).toHaveBeenCalledWith('mousemove', expect.any(Function));
    expect(addEventListenerSpy).toHaveBeenCalledWith('touchstart', expect.any(Function));

    unmount();

    expect(removeEventListenerSpy).toHaveBeenCalledWith('keydown', expect.any(Function));
    expect(removeEventListenerSpy).toHaveBeenCalledWith('mousemove', expect.any(Function));
    expect(removeEventListenerSpy).toHaveBeenCalledWith('touchstart', expect.any(Function));

    addEventListenerSpy.mockRestore();
    removeEventListenerSpy.mockRestore();
  });
});
