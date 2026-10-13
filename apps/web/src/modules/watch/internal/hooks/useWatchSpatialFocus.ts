import { useEffect, useRef } from 'react';
import type {
  UseWatchSpatialFocusOptions,
  UseWatchSpatialFocusReturn,
} from '../types';

/**
 * Owns every DOM focus ref used by the watch view (back, play, toolbar
 * controls, episode list) and all spatial-mode side effects: clamping the
 * focus index when toolbar controls disappear, programmatic focus +
 * scrollIntoView on zone/index changes, initial focus on load, and the
 * Enter-key activation handler for non-player zones.
 */
export function useWatchSpatialFocus({
  hasSeries,
  isSpatialMode,
  activeZone,
  focusIndex,
  setFocusIndex,
  selectedEpisodeId,
  iframeRef,
  controlsCount,
}: UseWatchSpatialFocusOptions): UseWatchSpatialFocusReturn {
  const backRef = useRef<HTMLAnchorElement | HTMLButtonElement | null>(null);
  const playRef = useRef<HTMLButtonElement | null>(null);
  const controlsRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const episodeRefs = useRef<(HTMLButtonElement | null)[]>([]);

  // Clamp spatial focus when utility buttons disappear (e.g. switching to direct).
  useEffect(() => {
    if (focusIndex >= controlsCount) {
      setFocusIndex(controlsCount - 1);
    }
  }, [focusIndex, controlsCount, setFocusIndex]);

  // Programmatic focus + scrollIntoView when activeZone/focusIndex changes (spatial mode only)
  useEffect(() => {
    if (!hasSeries) return;
    if (!isSpatialMode) return;

    let el: HTMLElement | null = null;
    if (activeZone === 'back') {
      el = backRef.current;
    } else if (activeZone === 'player') {
      el = iframeRef.current;
    } else if (activeZone === 'controls') {
      el = controlsRefs.current[focusIndex] ?? null;
    } else if (activeZone === 'episodes') {
      el = episodeRefs.current[focusIndex] ?? null;
    }

    if (el) {
      try {
        el.focus();
      } catch {
        // ignore
      }
      try {
        if (typeof el.scrollIntoView === 'function') {
          el.scrollIntoView({
            behavior: 'smooth',
            block: 'nearest',
            inline: 'nearest',
          });
        }
      } catch {
        // ignore
      }
    }
  }, [activeZone, focusIndex, isSpatialMode, hasSeries, iframeRef]);

  // Initial focus on controls bar Prev button or hero play button when page loads in spatial mode
  useEffect(() => {
    if (!hasSeries) return;
    if (!isSpatialMode) return;
    if (activeZone !== 'controls' || focusIndex !== 0) return;
    const t = setTimeout(() => {
      try {
        if (selectedEpisodeId) {
          controlsRefs.current[0]?.focus();
        } else {
          playRef.current?.focus();
        }
      } catch {
        // ignore
      }
    }, 0);
    return () => clearTimeout(t);
  }, [hasSeries, isSpatialMode, activeZone, focusIndex, selectedEpisodeId]);

  // Handle Enter for non-player zones: click the focused element
  useEffect(() => {
    if (!hasSeries) return;
    if (!isSpatialMode) return;

    const handler = (e: KeyboardEvent) => {
      if (e.key !== 'Enter') return;
      if (activeZone === 'player') return;
      if (activeZone === 'back') {
        e.preventDefault();
        backRef.current?.click();
      } else if (activeZone === 'controls') {
        e.preventDefault();
        controlsRefs.current[focusIndex]?.click();
      } else if (activeZone === 'episodes') {
        e.preventDefault();
        episodeRefs.current[focusIndex]?.click();
      }
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [activeZone, focusIndex, isSpatialMode, hasSeries]);

  return { backRef, playRef, controlsRefs, episodeRefs };
}
