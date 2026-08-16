import { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate } from '@tanstack/react-router';

export interface CustomVideoPlayerProps {
  src: string;
  title?: string;
  onEnded?: () => void;
  autoPlay?: boolean;
  seriesId?: string;
  currentOrder?: number;
  onNextEpisode?: () => void;
}

function formatTime(seconds: number): string {
  if (isNaN(seconds) || seconds < 0) return '00:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

export function CustomVideoPlayer({
  src,
  title,
  onEnded,
  autoPlay = false,
  seriesId,
  currentOrder,
  onNextEpisode,
}: CustomVideoPlayerProps) {
  let navigate: ReturnType<typeof useNavigate> | undefined;
  try {
    if (typeof useNavigate === 'function') {
      navigate = useNavigate();
    }
  } catch {
    // optional navigation in non-router contexts
  }

  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [countdown, setCountdown] = useState<number | null>(null);
  const controlsTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const triggerNextNavigation = useCallback(() => {
    setCountdown(null);
    if (onNextEpisode) {
      onNextEpisode();
    }
    const targetOrder = (currentOrder ?? 1) + 1;
    if (seriesId && navigate) {
      navigate({
        to: '/videos/$seriesId',
        params: { seriesId },
        search: { order: targetOrder },
      });
    }
  }, [seriesId, currentOrder, onNextEpisode, navigate]);

  const handleVideoEnded = () => {
    if (onEnded) {
      onEnded();
    }
    if (seriesId || currentOrder !== undefined || onNextEpisode) {
      setCountdown(5);
    }
  };

  useEffect(() => {
    setCountdown(null);
  }, [src]);

  useEffect(() => {
    if (countdown === null) return;

    if (countdown <= 0) {
      triggerNextNavigation();
      return;
    }

    const timer = setTimeout(() => {
      setCountdown((prev) => (prev !== null ? prev - 1 : null));
    }, 1000);

    return () => clearTimeout(timer);
  }, [countdown, triggerNextNavigation]);

  const togglePlay = useCallback(() => {
    if (!videoRef.current) return;
    if (isPlaying) {
      videoRef.current.pause();
    } else {
      videoRef.current.play().catch(() => {
        setIsPlaying(false);
      });
    }
  }, [isPlaying]);

  const handleTimeUpdate = () => {
    if (!videoRef.current) return;
    setCurrentTime(videoRef.current.currentTime);
  };

  const handleLoadedMetadata = () => {
    if (!videoRef.current) return;
    setDuration(videoRef.current.duration);
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const time = parseFloat(e.target.value);
    setCurrentTime(time);
    if (videoRef.current) {
      videoRef.current.currentTime = time;
    }
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    setVolume(val);
    if (videoRef.current) {
      videoRef.current.volume = val;
      videoRef.current.muted = val === 0;
      setIsMuted(val === 0);
    }
  };

  const toggleMute = () => {
    if (!videoRef.current) return;
    const nextMuted = !isMuted;
    setIsMuted(nextMuted);
    videoRef.current.muted = nextMuted;
  };

  const toggleFullscreen = () => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen().then(() => {
        setIsFullscreen(true);
      }).catch(() => {});
    } else {
      document.exitFullscreen().then(() => {
        setIsFullscreen(false);
      }).catch(() => {});
    }
  };

  const handleMouseMove = () => {
    setShowControls(true);
    if (controlsTimeoutRef.current) {
      clearTimeout(controlsTimeoutRef.current);
    }
    if (isPlaying) {
      controlsTimeoutRef.current = setTimeout(() => {
        setShowControls(false);
      }, 3000);
    }
  };

  useEffect(() => {
    return () => {
      if (controlsTimeoutRef.current) {
        clearTimeout(controlsTimeoutRef.current);
      }
    };
  }, []);

  return (
    <div
      ref={containerRef}
      onMouseMove={handleMouseMove}
      onMouseLeave={() => isPlaying && setShowControls(false)}
      className="relative aspect-video w-full rounded border border-c bg-black overflow-hidden group select-none flex flex-col justify-end"
    >
      <video
        ref={videoRef}
        src={src}
        data-testid="custom-video-element"
        autoPlay={autoPlay}
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleLoadedMetadata}
        onEnded={handleVideoEnded}
        onClick={togglePlay}
        className="w-full h-full object-contain cursor-pointer"
      />

      {/* Auto-next countdown overlay */}
      {countdown !== null && (
        <div
          data-testid="auto-next-countdown-overlay"
          className="absolute inset-0 bg-black/85 backdrop-blur-sm flex flex-col items-center justify-center gap-4 z-20 text-white select-none p-4 text-center"
        >
          <div className="space-y-1">
            <p className="text-[11px] uppercase tracking-wider text-zinc-400 mono">
              Up Next
            </p>
            <h3 className="text-base sm:text-lg font-semibold">
              Next episode in {countdown}s
            </h3>
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setCountdown(null)}
              className="px-3.5 py-1.5 rounded border border-zinc-700 bg-zinc-900 text-zinc-200 text-xs font-medium hover:bg-zinc-800 transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={triggerNextNavigation}
              className="px-3.5 py-1.5 rounded bg-[var(--primary)] text-[var(--primary-fg,white)] text-xs font-medium hover:opacity-90 transition cursor-pointer"
            >
              Play Now
            </button>
          </div>
        </div>
      )}

      {/* Control bar overlay */}
      <div
        className={`absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 via-black/50 to-transparent p-3 pt-6 transition-opacity duration-200 flex flex-col gap-2 ${
          showControls || !isPlaying ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
      >
        {/* Progress slider */}
        <div className="flex items-center gap-2">
          <input
            type="range"
            min="0"
            max={duration || 100}
            step="0.1"
            value={currentTime}
            onChange={handleSeek}
            aria-label="Progress"
            className="w-full h-1.5 bg-zinc-700 accent-[var(--primary)] rounded-lg appearance-none cursor-pointer focus:outline-none"
          />
        </div>

        {/* Bottom row controls */}
        <div className="flex items-center justify-between text-xs text-white mono">
          <div className="flex items-center gap-3">
            {/* Play / Pause button */}
            <button
              type="button"
              onClick={togglePlay}
              aria-label={isPlaying ? 'Pause' : 'Play'}
              className="p-1 text-white hover:text-[var(--primary)] transition cursor-pointer"
            >
              {isPlaying ? (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="6" y="4" width="4" height="16" />
                  <rect x="14" y="4" width="4" height="16" />
                </svg>
              ) : (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polygon points="5 3 19 12 5 21 5 3" />
                </svg>
              )}
            </button>

            {/* Volume controls */}
            <div className="flex items-center gap-1.5 group/vol">
              <button
                type="button"
                onClick={toggleMute}
                aria-label={isMuted || volume === 0 ? 'Unmute' : 'Mute'}
                className="p-1 text-white hover:text-[var(--primary)] transition cursor-pointer"
              >
                {isMuted || volume === 0 ? (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <line x1="1" y1="1" x2="23" y2="23" />
                    <path d="M9 9v6a3 3 0 0 0 5.12 2.12M15 9.34V4a3 3 0 0 0-5.94-.6" />
                  </svg>
                ) : (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                    <path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07" />
                  </svg>
                )}
              </button>
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={isMuted ? 0 : volume}
                onChange={handleVolumeChange}
                aria-label="Volume"
                className="w-16 h-1 bg-zinc-700 accent-[var(--primary)] rounded appearance-none cursor-pointer focus:outline-none"
              />
            </div>

            {/* Time display */}
            <span className="text-zinc-300 text-[11px] ml-1">
              {formatTime(currentTime)} / {formatTime(duration)}
            </span>
          </div>

          <div className="flex items-center gap-3">
            {title && <span className="text-zinc-400 text-xs truncate max-w-[200px] hidden sm:inline">{title}</span>}

            {/* Fullscreen button */}
            <button
              type="button"
              onClick={toggleFullscreen}
              aria-label={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
              className="p-1 text-white hover:text-[var(--primary)] transition cursor-pointer"
            >
              {isFullscreen ? (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M8 3v3a2 2 0 0 1-2 2H3m18 0h-3a2 2 0 0 1-2-2V3m0 18v-3a2 2 0 0 1 2-2h3M3 16h3a2 2 0 0 1 2 2v3" />
                </svg>
              ) : (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3" />
                </svg>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
