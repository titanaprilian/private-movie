import { useEffect } from 'react';

export interface VideoShortcutsHandlers {
  onTogglePlay?: () => void;
  onSeekRelative?: (seconds: number) => void;
  onAdjustVolume?: (delta: number) => void;
  onToggleMute?: () => void;
  onToggleFullscreen?: () => void;
  onNextEpisode?: () => void;
  onPrevEpisode?: () => void;
}

function isFormElementFocused(): boolean {
  const el = document.activeElement as HTMLElement | null;
  if (!el) return false;
  const tag = el.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true;
  if (el.isContentEditable === true) return true;
  return false;
}

function handleEpisodeShortcuts(
  e: KeyboardEvent,
  onNextEpisode?: () => void,
  onPrevEpisode?: () => void
): boolean {
  if (!e.shiftKey) return false;
  const key = e.key.toUpperCase();
  if (key === 'N') {
    e.preventDefault();
    onNextEpisode?.();
    return true;
  }
  if (key === 'P') {
    e.preventDefault();
    onPrevEpisode?.();
    return true;
  }
  return false;
}

export function useVideoShortcuts({
  onTogglePlay,
  onSeekRelative,
  onAdjustVolume,
  onToggleMute,
  onToggleFullscreen,
  onNextEpisode,
  onPrevEpisode,
}: VideoShortcutsHandlers): void {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (isFormElementFocused()) return;

      if (handleEpisodeShortcuts(e, onNextEpisode, onPrevEpisode)) {
        return;
      }

      const key = e.key.length === 1 ? e.key.toLowerCase() : e.key;

      switch (key) {
        case ' ':
          e.preventDefault();
          onTogglePlay?.();
          break;
        case 'k':
          onTogglePlay?.();
          break;
        case 'j':
          onSeekRelative?.(-10);
          break;
        case 'l':
          onSeekRelative?.(10);
          break;
        case 'ArrowLeft':
          onSeekRelative?.(-5);
          break;
        case 'ArrowRight':
          onSeekRelative?.(5);
          break;
        case 'ArrowUp':
          e.preventDefault();
          onAdjustVolume?.(0.1);
          break;
        case 'ArrowDown':
          e.preventDefault();
          onAdjustVolume?.(-0.1);
          break;
        case 'm':
          onToggleMute?.();
          break;
        case 'f':
          onToggleFullscreen?.();
          break;
        default:
          break;
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [
    onTogglePlay,
    onSeekRelative,
    onAdjustVolume,
    onToggleMute,
    onToggleFullscreen,
    onNextEpisode,
    onPrevEpisode,
  ]);
}
