import { useState, useRef, useEffect, useCallback } from 'react';
import {
  Play,
  Pause,
  Volume2,
  VolumeX,
  Maximize,
  Minimize,
  MoreVertical,
  Check,
} from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

export interface VideoPlayerProps {
  src: string;
  title?: string;
  onEnded?: () => void;
  autoPlay?: boolean;
  onNextEpisode?: () => void;
  hasNextEpisode?: boolean;
}

function formatTime(seconds: number): string {
  if (isNaN(seconds) || seconds < 0) return '00:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

const PLAYBACK_SPEEDS = [0.5, 1, 1.25, 1.5, 2];

export function VideoPlayer({
  src,
  title,
  onEnded,
  autoPlay = false,
  onNextEpisode,
  hasNextEpisode = false,
}: VideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [isSpeedOpen, setIsSpeedOpen] = useState(false);
  const [countdown, setCountdown] = useState<number | null>(null);
  const controlsTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastTouchRef = useRef(0);

  const triggerNextNavigation = useCallback(() => {
    setCountdown(null);
    if (onNextEpisode) {
      onNextEpisode();
    }
  }, [onNextEpisode]);

  const handleVideoEnded = () => {
    if (onEnded) {
      onEnded();
    }
    if (onNextEpisode || hasNextEpisode) {
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

  const handleSeekKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!videoRef.current) return;
    if (e.key === 'ArrowRight') {
      const newTime = Math.min(videoRef.current.duration || 100, currentTime + 5);
      setCurrentTime(newTime);
      videoRef.current.currentTime = newTime;
    } else if (e.key === 'ArrowLeft') {
      const newTime = Math.max(0, currentTime - 5);
      setCurrentTime(newTime);
      videoRef.current.currentTime = newTime;
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

  const handleSpeedChange = (speed: number) => {
    setPlaybackSpeed(speed);
    if (videoRef.current) {
      videoRef.current.playbackRate = speed;
    }
    setIsSpeedOpen(false);
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

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  const wakeControls = useCallback(() => {
    setShowControls(true);
  }, []);

  // Single effect owns the 3-second auto-hide timer: whenever controls are
  // visible while playing (and the settings popover is closed), hide them
  // after 3s of inactivity. Any wake/toggle resets the timer by re-running
  // this effect.
  useEffect(() => {
    if (controlsTimeoutRef.current) {
      clearTimeout(controlsTimeoutRef.current);
      controlsTimeoutRef.current = null;
    }
    if (showControls && isPlaying && !isSpeedOpen) {
      controlsTimeoutRef.current = setTimeout(() => {
        setShowControls(false);
      }, 3000);
    }
  }, [showControls, isPlaying, isSpeedOpen]);

  const handleMouseMove = () => {
    wakeControls();
  };

  const isInsideControlBar = (target: EventTarget | null) =>
    target instanceof HTMLElement &&
    target.closest('[data-testid="video-control-bar"]') !== null;

  const toggleControlsForTouch = useCallback(
    (target: EventTarget | null) => {
      if (isInsideControlBar(target)) return;
      lastTouchRef.current = Date.now();
      setShowControls((prev) => !prev);
    },
    [],
  );

  const handleTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    toggleControlsForTouch(e.target);
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    const pointerType =
      (e as React.PointerEvent<HTMLDivElement> & { pointerType?: string })
        .pointerType ?? e.nativeEvent?.pointerType;
    if (pointerType === 'mouse' || pointerType === undefined) {
      // Desktop pointer: just wake controls, play/pause handled by video onClick.
      wakeControls();
      return;
    }
    // Touch/pen pointer: toggle like a tap. Guard against double-fire when
    // both touchstart and pointerdown fire for the same tap.
    if (Date.now() - lastTouchRef.current < 500) return;
    toggleControlsForTouch(e.target);
  };

  const handleVideoClick = () => {
    // Suppress the synthesized click that follows a touch tap: taps toggle
    // controls visibility only and must not pause playback.
    if (Date.now() - lastTouchRef.current < 700) return;
    togglePlay();
  };

  useEffect(() => {
    return () => {
      if (controlsTimeoutRef.current) {
        clearTimeout(controlsTimeoutRef.current);
      }
    };
  }, []);

  const progressPercent = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div
      ref={containerRef}
      data-testid="video-player-container"
      onMouseMove={handleMouseMove}
      onTouchStart={handleTouchStart}
      onPointerDown={handlePointerDown}
      onMouseLeave={() => isPlaying && !isSpeedOpen && setShowControls(false)}
      className="relative aspect-video w-full rounded-2xl sm:rounded-[20px] border-2 border-[var(--border)] bg-black overflow-hidden group select-none flex flex-col justify-end"
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
        onClick={handleVideoClick}
        className="w-full h-full object-contain cursor-pointer"
      />

      {/* Auto-next countdown overlay */}
      {countdown !== null && (
        <div
          data-testid="auto-next-countdown-overlay"
          className="absolute inset-0 bg-black/85 backdrop-blur-sm flex flex-col items-center justify-center gap-4 z-30 text-white select-none p-4 text-center"
        >
          <div className="space-y-1">
            <p className="text-xs uppercase tracking-wider text-zinc-400 font-bold font-sans">
              Up Next
            </p>
            <h3 className="text-base sm:text-xl font-bold font-display text-[var(--ink)] dark:text-white">
              Next episode in {countdown}s
            </h3>
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setCountdown(null)}
              className="px-4 py-2 rounded-2xl border-2 border-[var(--border)] bg-[var(--surface)] text-[var(--ink)] dark:text-white text-xs font-bold shadow-[0_4px_0_var(--border)] active:translate-y-1 active:shadow-[0_1px_0_var(--border)] transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={triggerNextNavigation}
              className="px-4 py-2 rounded-2xl bg-[var(--green)] text-white text-xs font-bold shadow-[0_4px_0_var(--green-dark)] active:translate-y-1 active:shadow-[0_1px_0_var(--green-dark)] hover:brightness-105 transition cursor-pointer"
            >
              Play Now
            </button>
          </div>
        </div>
      )}

      {/* Floating Rounded Pill Control Bar Overlay */}
      <div
        data-testid="video-control-bar"
        className={`absolute inset-x-3 sm:inset-x-6 bottom-3 sm:bottom-6 z-20 rounded-full border-2 border-[var(--border-strong)]/80 bg-zinc-950/85 backdrop-blur-md px-3 sm:px-5 py-2 sm:py-2.5 shadow-2xl transition-all duration-300 flex flex-col gap-2 ${
          showControls || !isPlaying || isSpeedOpen ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2 pointer-events-none'
        }`}
      >
        {/* Progress Scrubber Bar */}
        <div className="relative flex items-center w-full group/scrubber py-1">
          {/* Custom Track Background */}
          <div className="relative w-full h-2 rounded-full bg-zinc-700/80 overflow-hidden pointer-events-none">
            <div
              className="h-full bg-[var(--green)] rounded-full transition-all duration-75"
              style={{ width: `${progressPercent}%` }}
            />
          </div>

          {/* Scrubber thumb circle */}
          <div
            className="absolute top-1/2 -translate-y-1/2 w-3.5 h-3.5 bg-white rounded-full shadow-[0_2px_4px_rgba(0,0,0,0.5)] border-2 border-[var(--green-dark)] pointer-events-none transition-transform group-hover/scrubber:scale-125"
            style={{
              left: `calc(${progressPercent}% - 7px)`,
            }}
          />

          {/* Native range input for accessible touch & keyboard control */}
          <input
            type="range"
            min="0"
            max={duration || 100}
            step="0.1"
            value={currentTime}
            onChange={handleSeek}
            onKeyDown={handleSeekKeyDown}
            aria-label="Progress"
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
          />
        </div>

        {/* Controls Row */}
        <div className="flex items-center justify-between gap-2 text-white font-sans text-xs">
          {/* Left Controls: 3D Play Button, Volume, Time */}
          <div className="flex items-center gap-2 sm:gap-3">
            {/* Tactile 3D Circular Play/Pause Button */}
            <button
              type="button"
              onClick={togglePlay}
              aria-label={isPlaying ? 'Pause' : 'Play'}
              className="w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-[var(--green)] text-white flex items-center justify-center shadow-[0_3px_0_var(--green-dark)] active:translate-y-[2px] active:shadow-[0_1px_0_var(--green-dark)] hover:brightness-105 transition-all duration-75 cursor-pointer shrink-0"
            >
              {isPlaying ? (
                <Pause className="w-4 h-4 fill-white stroke-none" />
              ) : (
                <Play className="w-4 h-4 fill-white stroke-none ml-0.5" />
              )}
            </button>

            {/* Volume toggle + slider */}
            <div className="flex items-center gap-1.5 group/vol">
              <button
                type="button"
                onClick={toggleMute}
                aria-label={isMuted || volume === 0 ? 'Unmute' : 'Mute'}
                className="p-1 text-zinc-300 hover:text-white transition cursor-pointer"
              >
                {isMuted || volume === 0 ? (
                  <VolumeX className="w-4 h-4" />
                ) : (
                  <Volume2 className="w-4 h-4" />
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
                className="w-12 sm:w-16 h-1.5 bg-zinc-700 accent-[var(--green)] rounded-full appearance-none cursor-pointer focus:outline-none"
              />
            </div>

            {/* Elapsed Time / Duration */}
            <span className="text-zinc-200 font-bold text-[11px] sm:text-xs mono ml-1">
              {formatTime(currentTime)} / {formatTime(duration)}
            </span>
          </div>

          {/* Right Controls: Title, Speed Popover, Fullscreen */}
          <div className="flex items-center gap-2 sm:gap-3">
            {title && (
              <span className="text-zinc-400 text-xs font-bold truncate max-w-[140px] sm:max-w-[220px] hidden md:inline">
                {title}
              </span>
            )}

            {/* Playback speed popover menu */}
            <Popover open={isSpeedOpen} onOpenChange={setIsSpeedOpen}>
              <PopoverTrigger asChild>
                <button
                  type="button"
                  aria-label="Playback speed"
                  className="px-2 py-1 rounded-full border border-zinc-700 bg-zinc-900/90 text-zinc-200 hover:text-white hover:bg-zinc-800 text-[11px] font-extrabold flex items-center gap-1 transition cursor-pointer"
                >
                  <span>{playbackSpeed}x</span>
                  <MoreVertical className="w-3 h-3" />
                </button>
              </PopoverTrigger>
              <PopoverContent
                side="top"
                align="end"
                className="w-36 p-1.5 rounded-2xl border-2 border-[var(--border-strong)] bg-zinc-950/95 backdrop-blur-md text-white shadow-xl space-y-1"
              >
                <p className="text-[10px] font-extrabold text-zinc-400 uppercase tracking-wider px-2 py-1">
                  Speed
                </p>
                {PLAYBACK_SPEEDS.map((speed) => {
                  const isSelected = playbackSpeed === speed;
                  return (
                    <button
                      key={speed}
                      type="button"
                      onClick={() => handleSpeedChange(speed)}
                      aria-label={`${speed}x`}
                      className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                        isSelected
                          ? 'bg-[var(--green)] text-white'
                          : 'text-zinc-300 hover:bg-zinc-800 hover:text-white'
                      }`}
                    >
                      <span>{speed}x</span>
                      {isSelected && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                    </button>
                  );
                })}
              </PopoverContent>
            </Popover>

            {/* Fullscreen Button */}
            <button
              type="button"
              onClick={toggleFullscreen}
              aria-label={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
              className="p-1 text-zinc-300 hover:text-white transition cursor-pointer"
            >
              {isFullscreen ? (
                <Minimize className="w-4 h-4" />
              ) : (
                <Maximize className="w-4 h-4" />
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

