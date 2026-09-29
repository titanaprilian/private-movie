import { useCallback, useRef, useState, type MouseEvent } from 'react';

/** Pointer travel (px) beyond which a press counts as a drag, not a click. */
const DRAG_THRESHOLD_PX = 6;

export interface DragScrollHandlers<T extends HTMLElement> {
  onMouseDown: (e: MouseEvent<T>) => void;
  onMouseMove: (e: MouseEvent<T>) => void;
  onMouseUp: (e: MouseEvent<T>) => void;
  onMouseLeave: (e: MouseEvent<T>) => void;
  onClickCapture: (e: MouseEvent<T>) => void;
}

/**
 * Enables click-and-drag horizontal scrolling on an overflow-x container
 * (desktop mouse equivalent of touch swipe). A drag beyond the threshold
 * suppresses the trailing click so cards don't navigate when the user
 * was actually scrolling.
 */
export function useDragScroll<T extends HTMLDivElement>() {
  const containerRef = useRef<T | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const state = useRef({
    dragging: false,
    startX: 0,
    startScrollLeft: 0,
    suppressClick: false,
  });

  const onMouseDown = useCallback((e: MouseEvent<T>) => {
    // Primary button only — ignore right/middle clicks.
    if (e.button !== 0) return;
    const el = containerRef.current;
    if (!el) return;
    state.current = {
      dragging: true,
      startX: e.clientX,
      startScrollLeft: el.scrollLeft,
      suppressClick: false,
    };
    // Avoid native image-drag ghosts and text selection while dragging.
    e.preventDefault();
  }, []);

  const onMouseMove = useCallback((e: MouseEvent<T>) => {
    const s = state.current;
    if (!s.dragging) return;
    const el = containerRef.current;
    if (!el) return;
    const dx = e.clientX - s.startX;
    if (Math.abs(dx) > DRAG_THRESHOLD_PX) {
      s.suppressClick = true;
      setIsDragging(true);
    }
    el.scrollLeft = s.startScrollLeft - dx;
  }, []);

  const endDrag = useCallback(() => {
    state.current.dragging = false;
    setIsDragging(false);
  }, []);

  const onMouseUp = useCallback(() => {
    endDrag();
  }, [endDrag]);

  const onMouseLeave = useCallback(() => {
    endDrag();
  }, [endDrag]);

  const onClickCapture = useCallback((e: MouseEvent<T>) => {
    if (state.current.suppressClick) {
      state.current.suppressClick = false;
      e.stopPropagation();
      e.preventDefault();
    }
  }, []);

  const handlers: DragScrollHandlers<T> = {
    onMouseDown,
    onMouseMove,
    onMouseUp,
    onMouseLeave,
    onClickCapture,
  };

  return { containerRef, dragHandlers: handlers, isDragging };
}
