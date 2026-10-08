import { useEffect } from 'react';

export interface VideoShortcutsHandlers {
  onTogglePlay?: () => void;
  onSeekRelative?: (seconds: number) => void;
  onAdjustVolume?: (delta: number) => void;
  onToggleMute?: () => void;
  onToggleFullscreen?: () => void;
}

function isFormElementFocused(): boolean {
  const el = document.activeElement as HTMLElement | null;
  if (!el) return false;
  const tag = el.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true;
  if (el.isContentEditable === true) return true;
  return false;
}

export function useVideoShortcuts({
  onTogglePlay,
  onSeekRelative,
  onAdjustVolume,
  onToggleMute,
  onToggleFullscreen,
}: VideoShortcutsHandlers): void {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (isFormElementFocused()) return;

      switch (e.key) {
        case ' ':
          e.preventDefault();
          onTogglePlay?.();
          break;
        case 'k':
        case 'K':
          onTogglePlay?.();
          break;
        case 'j':
        case 'J':
          onSeekRelative?.(-10);
          break;
        case 'l':
        case 'L':
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
        case 'M':
          onToggleMute?.();
          break;
        case 'f':
        case 'F':
          onToggleFullscreen?.();
          break;
        default:
          break;
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onTogglePlay, onSeekRelative, onAdjustVolume, onToggleMute, onToggleFullscreen]);
}
