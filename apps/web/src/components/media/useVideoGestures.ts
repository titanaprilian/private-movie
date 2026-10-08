import { useCallback, useEffect, useRef, useState } from 'react';

export const GESTURE_HINT_STORAGE_KEY = 'pm_player_gesture_hint_seen';

export type GestureDirection = 'backward' | 'forward';

export interface GestureRipple {
  direction: GestureDirection;
  key: number;
}

export type GestureZone = 'left' | 'middle' | 'right';

export interface VideoGesturesOptions {
  onSeekRelative?: (seconds: number) => void;
  onToggleFullscreen?: () => void;
  /** Max gap between two taps to count as a double-tap. Defaults to 300ms. */
  doubleTapWindowMs?: number;
  /** How long the ripple pill stays visible. Defaults to 600ms. */
  rippleDurationMs?: number;
  /** How long the first-time hint stays visible. Defaults to 2500ms. */
  hintDurationMs?: number;
}

export function getGestureZone(clientX: number, containerWidth: number): GestureZone {
  if (!containerWidth || containerWidth <= 0) return 'middle';
  const ratio = clientX / containerWidth;
  if (ratio < 0.4) return 'left';
  if (ratio > 0.6) return 'right';
  return 'middle';
}

function readHintSeen(): boolean {
  try {
    return window.localStorage.getItem(GESTURE_HINT_STORAGE_KEY) !== null;
  } catch {
    return true;
  }
}

function persistHintSeen(): void {
  try {
    window.localStorage.setItem(GESTURE_HINT_STORAGE_KEY, '1');
  } catch {
    // Storage unavailable (private mode, SSR): hint just won't persist.
  }
}

export function useVideoGestures({
  onSeekRelative,
  onToggleFullscreen,
  doubleTapWindowMs = 300,
  rippleDurationMs = 600,
  hintDurationMs = 2500,
}: VideoGesturesOptions = {}) {
  const [ripple, setRipple] = useState<GestureRipple | null>(null);
  const [hintVisible, setHintVisible] = useState<boolean>(() => !readHintSeen());

  const seekRef = useRef(onSeekRelative);
  seekRef.current = onSeekRelative;
  const fullscreenRef = useRef(onToggleFullscreen);
  fullscreenRef.current = onToggleFullscreen;

  const lastTapRef = useRef<{ time: number; zone: GestureZone } | null>(null);
  const rippleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (rippleTimerRef.current) clearTimeout(rippleTimerRef.current);
    };
  }, []);

  const dismissHint = useCallback(() => {
    persistHintSeen();
    setHintVisible(false);
  }, []);

  useEffect(() => {
    if (!hintVisible) return;
    const timer = setTimeout(() => {
      dismissHint();
    }, hintDurationMs);
    return () => clearTimeout(timer);
  }, [hintVisible, hintDurationMs, dismissHint]);

  const showRipple = useCallback(
    (direction: GestureDirection) => {
      if (rippleTimerRef.current) {
        clearTimeout(rippleTimerRef.current);
        rippleTimerRef.current = null;
      }
      setRipple({ direction, key: Date.now() });
      rippleTimerRef.current = setTimeout(() => {
        setRipple(null);
        rippleTimerRef.current = null;
      }, rippleDurationMs);
    },
    [rippleDurationMs],
  );

  /**
   * Feed a tap to the double-tap detector. Returns true when the tap was
   * consumed as a double-tap skip (caller must NOT toggle controls for it).
   */
  const handleTap = useCallback(
    (clientX: number, containerWidth: number, pointerType?: string): boolean => {
      if (pointerType === 'mouse') return false;
      const zone = getGestureZone(clientX, containerWidth);
      if (zone === 'middle') {
        lastTapRef.current = null;
        return false;
      }
      const now = Date.now();
      const prev = lastTapRef.current;
      if (prev && prev.zone === zone && now - prev.time < doubleTapWindowMs) {
        lastTapRef.current = null;
        const seconds = zone === 'left' ? -10 : 10;
        seekRef.current?.(seconds);
        showRipple(zone === 'left' ? 'backward' : 'forward');
        return true;
      }
      lastTapRef.current = { time: now, zone };
      return false;
    },
    [doubleTapWindowMs, showRipple],
  );

  /** Desktop double-click toggles fullscreen. Touch double-taps seek instead. */
  const handleDoubleClick = useCallback(
    (pointerType?: string): void => {
      if (pointerType !== undefined && pointerType !== 'mouse') return;
      fullscreenRef.current?.();
    },
    [],
  );

  return { ripple, hintVisible, dismissHint, handleTap, handleDoubleClick };
}
