import { useCallback, useEffect, useRef, useState } from 'react';

export type WatchZone = 'back' | 'player' | 'controls' | 'episodes';

export interface UseWatchNavOptions {
  controlsCount?: number;
  episodesCount?: number;
  iframeRef?: React.RefObject<HTMLIFrameElement | null>;
}

export interface UseWatchNavReturn {
  activeZone: WatchZone;
  focusIndex: number;
  setActiveZone: (zone: WatchZone) => void;
  setFocusIndex: (index: number) => void;
}

function dispatchToIframe(
  iframeRef: React.RefObject<HTMLIFrameElement | null> | undefined,
  key: string
) {
  try {
    const iframe =
      iframeRef?.current ??
      (document.querySelector('[data-testid="watch-player"]') as HTMLIFrameElement | null);
    const cw = (iframe as unknown as { contentWindow?: Window | null })?.contentWindow;
    if (!cw) return;
    const event = new KeyboardEvent('keydown', { key, bubbles: true });
    cw.dispatchEvent(event);
  } catch {
    // cross-origin or missing iframe - silently ignore
  }
}

function focusIframe(iframeRef: React.RefObject<HTMLIFrameElement | null> | undefined) {
  try {
    const iframe =
      iframeRef?.current ??
      (document.querySelector('[data-testid="watch-player"]') as HTMLIFrameElement | null);
    (iframe as unknown as HTMLElement | null)?.focus();
  } catch {
    // ignore focus errors
  }
}

export function useWatchNav(options?: UseWatchNavOptions): UseWatchNavReturn {
  const controlsCount = options?.controlsCount ?? 4;
  const episodesCount = options?.episodesCount ?? 10;
  const iframeRef = options?.iframeRef;

  const [activeZone, setActiveZone] = useState<WatchZone>('controls');
  const [focusIndex, setFocusIndex] = useState(0);

  const activeZoneRef = useRef(activeZone);
  const focusIndexRef = useRef(focusIndex);
  const iframeRefRef = useRef(iframeRef);

  useEffect(() => {
    activeZoneRef.current = activeZone;
  }, [activeZone]);

  useEffect(() => {
    focusIndexRef.current = focusIndex;
  }, [focusIndex]);

  useEffect(() => {
    iframeRefRef.current = iframeRef;
  }, [iframeRef]);

  const handleFullscreenChange = useCallback(() => {
    try {
      const isFullscreen = Boolean(document.fullscreenElement);
      if (!isFullscreen && activeZoneRef.current === 'player') {
        setActiveZone('controls');
        setFocusIndex(0);
        try {
          const firstControl =
            document.querySelector<HTMLElement>('[data-testid="watch-controls"] button') ??
            document.querySelector<HTMLElement>('[aria-label="Prev episode"]') ??
            document.querySelector<HTMLElement>('button[aria-label*="Prev"]');
          firstControl?.focus();
        } catch {
          // ignore focus errors
        }
      }
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const zone = activeZoneRef.current;
      const idx = focusIndexRef.current;

      switch (zone) {
        case 'back': {
          if (event.key === 'ArrowDown') {
            setActiveZone('player');
            setFocusIndex(0);
            dispatchToIframe(iframeRefRef.current, 'f');
            focusIframe(iframeRefRef.current);
          }
          break;
        }
        case 'player': {
          if (event.key === 'ArrowUp') {
            setActiveZone('back');
            setFocusIndex(0);
          } else if (event.key === 'ArrowDown') {
            setActiveZone('controls');
            setFocusIndex(0);
          } else if (event.key === 'ArrowRight') {
            dispatchToIframe(iframeRefRef.current, 'ArrowRight');
            setActiveZone('episodes');
            setFocusIndex(0);
          } else if (event.key === 'ArrowLeft') {
            dispatchToIframe(iframeRefRef.current, 'ArrowLeft');
          } else if (event.key === 'Enter') {
            // Standard KeyboardEvent key value for space bar is ' ' (single space character).
            dispatchToIframe(iframeRefRef.current, ' ');
          }
          break;
        }
        case 'controls': {
          if (event.key === 'ArrowUp') {
            setActiveZone('player');
            setFocusIndex(0);
            dispatchToIframe(iframeRefRef.current, 'f');
            focusIframe(iframeRefRef.current);
          } else if (event.key === 'ArrowLeft') {
            setFocusIndex(Math.max(0, idx - 1));
          } else if (event.key === 'ArrowRight') {
            if (idx >= controlsCount - 1) {
              setActiveZone('episodes');
              setFocusIndex(0);
            } else {
              setFocusIndex(idx + 1);
            }
          }
          break;
        }
        case 'episodes': {
          if (event.key === 'ArrowLeft') {
            setActiveZone('controls');
            setFocusIndex(0);
          } else if (event.key === 'ArrowUp') {
            setFocusIndex(Math.max(0, idx - 1));
          } else if (event.key === 'ArrowDown') {
            setFocusIndex(Math.min(episodesCount - 1, idx + 1));
          }
          break;
        }
        default:
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    document.addEventListener('fullscreenchange', handleFullscreenChange);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
    };
  }, [controlsCount, episodesCount, handleFullscreenChange]);

  return { activeZone, focusIndex, setActiveZone, setFocusIndex };
}
