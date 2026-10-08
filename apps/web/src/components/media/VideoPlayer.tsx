import { useState, useRef, useEffect, useCallback } from 'react';
import {
  Play,
  Pause,
  Volume1,
  Volume2,
  VolumeX,
  Maximize,
  Minimize,
  RotateCcw,
  RotateCw,
} from 'lucide-react';
import { VideoScrubber, BufferedRange } from './VideoScrubber';
import { useVideoGestures } from './useVideoGestures';
import { VideoNextEpisodeCard } from './VideoNextEpisodeCard';
import {
  VideoSettingsPopover,
  type QualityOption,
  type SubtitleOption,
} from './VideoSettingsPopover';
import { useVideoShortcuts } from './useVideoShortcuts';

export interface VideoPlayerProps {
  src: string;
  title?: string;
  onEnded?: () => void;
  autoPlay?: boolean;
  onNextEpisode?: () => void;
  hasNextEpisode?: boolean;
  /** Available video quality options. The Quality section renders when 2+ exist. */
  qualities?: QualityOption[];
  onQualityChange?: (id: string) => void;
  /** Available subtitle tracks. The Subtitles section renders when entries exist. */
  subtitles?: SubtitleOption[];
  onSubtitleChange?: (id: string | null) => void;
}

function formatTime(seconds: number): string {
  if (isNaN(seconds) || seconds < 0) return '00:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

export function VideoPlayer({
  src,
  title,
  onEnded,
  autoPlay = false,
  onNextEpisode,
  hasNextEpisode = false,
  qualities,
  onQualityChange,
  subtitles,
  onSubtitleChange,
}: VideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [bufferedRanges, setBufferedRanges] = useState<BufferedRange[]>([]);
  const [volume, setVolume] = useState(1);
  const [prevVolume, setPrevVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isPseudoFullscreen, setIsPseudoFullscreen] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [isMobileSettingsOpen, setIsMobileSettingsOpen] = useState(false);
  const [isDesktopSettingsOpen, setIsDesktopSettingsOpen] = useState(false);
  // Either popover (mobile or desktop bar instance) suppresses auto-hide.
  const isSettingsOpen = isMobileSettingsOpen || isDesktopSettingsOpen;
  const portalContainer = isFullscreen || isPseudoFullscreen ? containerRef.current : undefined;
  const [isShortcutsOpen, setIsShortcutsOpen] = useState(false);
  const [selectedQualityId, setSelectedQualityId] = useState<string | undefined>(
    qualities && qualities.length > 0 ? qualities[0].id : undefined,
  );
  const [selectedSubtitleId, setSelectedSubtitleId] = useState<string | null>(null);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [cancelledNextEpisode, setCancelledNextEpisode] = useState(false);
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
    if (hasNextEpisode && !cancelledNextEpisode) {
      triggerNextNavigation();
    }
  };

  const handleCancelNextEpisode = () => {
    setCancelledNextEpisode(true);
    setCountdown(null);
  };

  useEffect(() => {
    setCountdown(null);
    setCancelledNextEpisode(false);
  }, [src]);

  const showNextEpisodeCard =
    hasNextEpisode &&
    !cancelledNextEpisode &&
    duration > 0 &&
    currentTime >= duration - 25;

  useEffect(() => {
    if (showNextEpisodeCard && countdown === null) {
      setCountdown(5);
    }
    if (!showNextEpisodeCard && countdown !== null) {
      setCountdown(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showNextEpisodeCard]);

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

  const updateProgressAndBuffer = useCallback(() => {
    if (!videoRef.current) return;
    const video = videoRef.current;
    setCurrentTime(video.currentTime);

    try {
      if (video.buffered && video.buffered.length > 0) {
        const ranges: BufferedRange[] = [];
        for (let i = 0; i < video.buffered.length; i++) {
          const start = video.buffered.start(i);
          const end = video.buffered.end(i);
          if (!isNaN(start) && !isNaN(end)) {
            ranges.push({ start, end });
          }
        }
        setBufferedRanges(ranges);
      } else {
        setBufferedRanges([]);
      }
    } catch {
      setBufferedRanges([]);
    }
  }, []);

  const handleTimeUpdate = () => {
    updateProgressAndBuffer();
  };

  const handleProgress = () => {
    updateProgressAndBuffer();
  };

  const handleLoadedMetadata = () => {
    if (!videoRef.current) return;
    setDuration(videoRef.current.duration);
    updateProgressAndBuffer();
  };

  const handleSeek = (time: number) => {
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
    if (val > 0) {
      setPrevVolume(val);
      setIsMuted(false);
    } else {
      setIsMuted(true);
    }
    if (videoRef.current) {
      videoRef.current.volume = val;
      videoRef.current.muted = val === 0;
    }
  };

  const toggleMute = () => {
    if (!videoRef.current) return;
    if (isMuted || volume === 0) {
      // Unmute: restore previous non-zero volume (or default 1 if prev was 0)
      const restoredVolume = prevVolume > 0 ? prevVolume : 1;
      setVolume(restoredVolume);
      setIsMuted(false);
      videoRef.current.muted = false;
      videoRef.current.volume = restoredVolume;
    } else {
      // Mute: record current volume and set muted
      if (volume > 0) {
        setPrevVolume(volume);
      }
      setIsMuted(true);
      videoRef.current.muted = true;
    }
  };

  const handleSpeedChange = (speed: number) => {
    setPlaybackSpeed(speed);
    if (videoRef.current) {
      videoRef.current.playbackRate = speed;
    }
    setIsMobileSettingsOpen(false);
    setIsDesktopSettingsOpen(false);
  };

  const handleQualityChange = (id: string) => {
    setSelectedQualityId(id);
    onQualityChange?.(id);
  };

  const handleSubtitleChange = (id: string | null) => {
    setSelectedSubtitleId(id);
    onSubtitleChange?.(id);
  };

  const toggleFullscreen = () => {
    if (isPseudoFullscreen) {
      setIsPseudoFullscreen(false);
      return;
    }
    if (!containerRef.current) return;
    if (typeof containerRef.current.requestFullscreen === 'function') {
      if (!document.fullscreenElement) {
        containerRef.current
          .requestFullscreen()
          .then(() => {
            setIsFullscreen(true);
          })
          .catch(() => {
            // Fullscreen request rejected or unsupported on iOS Safari
            setIsPseudoFullscreen(true);
          });
      } else {
        document
          .exitFullscreen()
          .then(() => {
            setIsFullscreen(false);
          })
          .catch(() => {});
      }
    } else {
      // requestFullscreen is unsupported (e.g. iOS Safari)
      setIsPseudoFullscreen(true);
    }
  };

  const seekBy = useCallback((seconds: number) => {
    if (!videoRef.current) return;
    // Read from the element, not React state: state can lag behind seeks
    // made through the scrubber or consecutive rapid taps.
    const max = videoRef.current.duration || 100;
    const next = Math.min(Math.max(0, videoRef.current.currentTime + seconds), max);
    setCurrentTime(next);
    videoRef.current.currentTime = next;
  }, []);

  const gestures = useVideoGestures({
    onSeekRelative: seekBy,
    onToggleFullscreen: toggleFullscreen,
  });

  const adjustVolume = useCallback(
    (delta: number) => {
      if (!videoRef.current) return;
      const next = Math.min(1, Math.max(0, volume + delta));
      setVolume(next);
      if (next > 0) {
        setPrevVolume(next);
        setIsMuted(false);
      } else {
        setIsMuted(true);
      }
      videoRef.current.volume = next;
      videoRef.current.muted = next === 0;
    },
    [volume],
  );

  useVideoShortcuts({
    onTogglePlay: togglePlay,
    onSeekRelative: seekBy,
    onAdjustVolume: adjustVolume,
    onToggleMute: toggleMute,
    onToggleFullscreen: toggleFullscreen,
  });

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
  // visible while playing (and the settings popover / shortcuts dialog is
  // closed), hide them after 3s of inactivity. Any wake/toggle resets the
  // timer by re-running this effect.
  useEffect(() => {
    if (controlsTimeoutRef.current) {
      clearTimeout(controlsTimeoutRef.current);
      controlsTimeoutRef.current = null;
    }
    if (showControls && isPlaying && !isSettingsOpen && !isShortcutsOpen) {
      controlsTimeoutRef.current = setTimeout(() => {
        setShowControls(false);
      }, 3000);
    }
  }, [showControls, isPlaying, isSettingsOpen, isShortcutsOpen]);

  const handleMouseMove = () => {
    wakeControls();
  };

  const isInsideControlBar = (target: EventTarget | null) =>
    target instanceof Element &&
    (target.closest('[data-testid="video-control-bar"]') !== null ||
      target.closest('[data-testid="video-mobile-bar"]') !== null ||
      target.closest('[data-testid="video-center-controls"]') !== null ||
      target.closest('[data-testid="next-episode-card"]') !== null ||
      target.closest('[data-testid="video-settings-popover"]') !== null ||
      target.closest('[role="dialog"]') !== null);

  const toggleControlsForTouch = useCallback(
    (target: EventTarget | null) => {
      if (isInsideControlBar(target)) return;
      lastTouchRef.current = Date.now();
      setShowControls((prev) => !prev);
    },
    [],
  );

  const handleTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    if (isSettingsOpen && !isInsideControlBar(e.target)) {
      setIsMobileSettingsOpen(false);
      setIsDesktopSettingsOpen(false);
      // Suppress further tap handling
      lastTouchRef.current = Date.now();
      return;
    }
    // Double-tap on the side zones seeks instead of toggling controls, so it
    // must be checked before the single-tap visibility toggle.
    const touch = e.touches?.[0] as unknown as { clientX?: number } | undefined;
    const clientX =
      touch?.clientX ?? (e.target instanceof Element ? e.target.getBoundingClientRect().left : 0);
    const width = containerRef.current?.getBoundingClientRect().width ?? 0;
    const pointerType =
      (e as unknown as { pointerType?: string }).pointerType ?? 'touch';
    if (gestures.handleTap(clientX, width, pointerType)) {
      lastTouchRef.current = Date.now();
      wakeControls();
      return;
    }
    toggleControlsForTouch(e.target);
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (isSettingsOpen && !isInsideControlBar(e.target)) {
      setIsMobileSettingsOpen(false);
      setIsDesktopSettingsOpen(false);
      lastTouchRef.current = Date.now();
      return;
    }
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

  const handleVideoClick = (e: React.MouseEvent<HTMLVideoElement>) => {
    if (isSettingsOpen) {
      setIsMobileSettingsOpen(false);
      setIsDesktopSettingsOpen(false);
      return;
    }
    // The second click of a double-click is handled by onDoubleClick
    // (fullscreen); only single clicks toggle play/pause.
    if (e.detail > 1) return;
    // Suppress the synthesized click that follows a touch tap: taps toggle
    // controls visibility only and must not pause playback.
    if (Date.now() - lastTouchRef.current < 700) return;
    togglePlay();
  };

  const handleDoubleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (isInsideControlBar(e.target)) return;
    const nativePointerType = (
      e.nativeEvent as globalThis.MouseEvent & { pointerType?: string }
    ).pointerType;
    const pointerType =
      (e as React.MouseEvent<HTMLDivElement> & { pointerType?: string }).pointerType ??
      nativePointerType;
    gestures.handleDoubleClick(pointerType ?? 'mouse');
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
      data-testid="video-player-container"
      onMouseMove={handleMouseMove}
      onTouchStart={handleTouchStart}
      onPointerDown={handlePointerDown}
      onDoubleClick={handleDoubleClick}
      onMouseLeave={() => isPlaying && !isSettingsOpen && !isShortcutsOpen && setShowControls(false)}
      className={`relative aspect-video w-full @container bg-black overflow-hidden group select-none flex flex-col justify-end ${
        isPseudoFullscreen
          ? 'fixed inset-0 z-50 rounded-none border-0'
          : 'rounded-2xl sm:rounded-[20px] border-2 border-[var(--border)]'
      }`}
    >
      <video
        ref={videoRef}
        src={src}
        data-testid="custom-video-element"
        autoPlay={autoPlay}
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
        onTimeUpdate={handleTimeUpdate}
        onProgress={handleProgress}
        onLoadedMetadata={handleLoadedMetadata}
        onEnded={handleVideoEnded}
        onClick={handleVideoClick}
        className="w-full h-full object-contain cursor-pointer"
      />

      {/* Floating corner Next Episode card (last 25s) */}
      {showNextEpisodeCard && countdown !== null && (
        <VideoNextEpisodeCard
          countdown={countdown}
          onPlayNow={triggerNextNavigation}
          onCancel={handleCancelNextEpisode}
        />
      )}

      {/* Double-tap ripple pill overlay */}
      {gestures.ripple && (
        <div
          key={gestures.ripple.key}
          data-testid={
            gestures.ripple.direction === 'backward'
              ? 'gesture-ripple-backward'
              : 'gesture-ripple-forward'
          }
          className={`absolute top-1/2 -translate-y-1/2 z-20 pointer-events-none px-4 py-2 rounded-full bg-zinc-950/80 backdrop-blur-md border-2 border-[var(--border-strong)]/60 text-white text-sm font-extrabold flex items-center gap-1.5 animate-[gesture-ripple_600ms_ease-out_forwards] ${
            gestures.ripple.direction === 'backward' ? 'left-6' : 'right-6'
          }`}
          style={{ animationName: 'gesture-ripple' }}
        >
          {gestures.ripple.direction === 'backward' ? '⏪ -10s' : '⏩ +10s'}
        </div>
      )}

      {/* First-time mobile gesture hint */}
      {gestures.hintVisible && (
        <div
          data-testid="gesture-hint"
          className="absolute top-4 left-1/2 -translate-x-1/2 z-20 pointer-events-none px-3 py-1.5 rounded-full bg-zinc-950/80 backdrop-blur-md text-zinc-200 text-[11px] font-bold whitespace-nowrap"
        >
          Double tap sides to skip 10s
        </div>
      )}

      {/* Mobile center overlay: right-sized semi-transparent transport buttons */}
      <div
        data-testid="video-center-controls"
        className={`@md:hidden absolute inset-0 z-10 flex items-center justify-center gap-4 pointer-events-none transition-all duration-300 ${
          showControls || !isPlaying ? 'opacity-100' : 'opacity-0'
        }`}
      >
        {/* Skip Backward Button (36px, min 40px touch target) */}
        <button
          type="button"
          onClick={() => seekBy(-10)}
          aria-label="Skip back 10 seconds"
          className="pointer-events-auto w-9 h-9 min-w-[40px] min-h-[40px] rounded-full bg-black/55 backdrop-blur-sm text-white flex items-center justify-center active:scale-95 hover:bg-black/70 transition-all duration-75 cursor-pointer shrink-0 text-[11px] font-bold"
        >
          <RotateCcw className="w-4 h-4" />
          <span className="sr-only">-10s</span>
        </button>

        {/* Play/Pause Button (48px, min 48px touch target) */}
        <button
          type="button"
          onClick={togglePlay}
          aria-label={isPlaying ? 'Pause' : 'Play'}
          className="pointer-events-auto w-12 h-12 min-w-[48px] min-h-[48px] rounded-full bg-[var(--green)]/90 backdrop-blur-sm text-white flex items-center justify-center active:scale-95 hover:bg-[var(--green)] transition-all duration-75 cursor-pointer shrink-0 shadow-lg"
        >
          {isPlaying ? (
            <Pause className="w-5 h-5 fill-white stroke-none" />
          ) : (
            <Play className="w-5 h-5 fill-white stroke-none ml-0.5" />
          )}
        </button>

        {/* Skip Forward Button (36px, min 40px touch target) */}
        <button
          type="button"
          onClick={() => seekBy(10)}
          aria-label="Skip forward 10 seconds"
          className="pointer-events-auto w-9 h-9 min-w-[40px] min-h-[40px] rounded-full bg-black/55 backdrop-blur-sm text-white flex items-center justify-center active:scale-95 hover:bg-black/70 transition-all duration-75 cursor-pointer shrink-0 text-[11px] font-bold"
        >
          <RotateCw className="w-4 h-4" />
          <span className="sr-only">+10s</span>
        </button>
      </div>

      {/* Mobile edge-to-edge gradient scrim: seek bar + time / settings / fullscreen */}
      <div
        data-testid="video-mobile-bar"
        className={`@md:hidden absolute inset-x-0 bottom-0 z-20 bg-gradient-to-t from-black/85 via-black/40 to-transparent px-3 pb-2 pt-6 transition-all duration-300 flex flex-col gap-1 min-w-0 ${
          showControls || !isPlaying || isSettingsOpen || isShortcutsOpen
            ? 'opacity-100 translate-y-0'
            : 'opacity-0 translate-y-2 pointer-events-none'
        }`}
      >
        <VideoScrubber
          currentTime={currentTime}
          duration={duration}
          bufferedRanges={bufferedRanges}
          onSeek={handleSeek}
          onKeyDown={handleSeekKeyDown}
        />
        <div className="flex items-center justify-between gap-2 text-white font-sans text-xs min-w-0">
          <span className="text-zinc-200 font-bold text-[11px] mono whitespace-nowrap tabular-nums shrink-0">
            {formatTime(currentTime)} / {formatTime(duration)}
          </span>
          <div className="flex items-center gap-2 shrink-0">
            <VideoSettingsPopover
              container={portalContainer}
              playbackSpeed={playbackSpeed}
              onSpeedChange={handleSpeedChange}
              qualities={qualities}
              selectedQualityId={selectedQualityId}
              onQualityChange={handleQualityChange}
              subtitles={subtitles}
              selectedSubtitleId={selectedSubtitleId}
              onSubtitleChange={handleSubtitleChange}
              open={isMobileSettingsOpen}
              onOpenChange={setIsMobileSettingsOpen}
              onShortcutsOpenChange={setIsShortcutsOpen}
            />
            <button
              type="button"
              onClick={toggleFullscreen}
              aria-label={isFullscreen || isPseudoFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
              className="min-w-[40px] min-h-[40px] flex items-center justify-center text-zinc-300 hover:text-white transition cursor-pointer shrink-0"
            >
              {isFullscreen || isPseudoFullscreen ? (
                <Minimize className="w-4 h-4" />
              ) : (
                <Maximize className="w-4 h-4" />
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Desktop unified bottom bar (wide containers only) */}
      <div
        data-testid="video-control-bar"
        className={`hidden @md:flex absolute inset-x-3 sm:inset-x-6 bottom-3 sm:bottom-6 z-20 rounded-full border-2 border-[var(--border-strong)]/80 bg-zinc-950/85 backdrop-blur-md px-3 sm:px-5 py-2 sm:py-2.5 shadow-2xl transition-all duration-300 flex-col gap-2 min-w-0 ${
          showControls || !isPlaying || isSettingsOpen || isShortcutsOpen ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2 pointer-events-none'
        }`}
      >
        {/* Chunky 3-Layer Progress Scrubber Bar */}
        <VideoScrubber
          currentTime={currentTime}
          duration={duration}
          bufferedRanges={bufferedRanges}
          onSeek={handleSeek}
          onKeyDown={handleSeekKeyDown}
        />

        {/* Controls Row */}
        <div className="flex items-center justify-between gap-2 text-white font-sans text-xs min-w-0">
          {/* Left Controls: 3D Play Button, Skips, Volume, Time */}
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            {/* Tactile 3D Circular Skip Backward Button */}
            <button
              type="button"
              onClick={() => seekBy(-10)}
              aria-label="Skip back 10 seconds"
              className="w-10 h-10 min-w-[40px] min-h-[40px] rounded-full bg-zinc-800 text-white flex items-center justify-center border-2 border-[var(--border-strong)] shadow-[0_3px_0_var(--border-strong)] active:translate-y-[2px] active:shadow-[0_1px_0_var(--border-strong)] hover:brightness-110 transition-all duration-75 cursor-pointer shrink-0 text-[10px] sm:text-[11px] font-extrabold"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span className="sr-only">-10s</span>
            </button>

            {/* Tactile 3D Circular Play/Pause Button */}
            <button
              type="button"
              onClick={togglePlay}
              aria-label={isPlaying ? 'Pause' : 'Play'}
              className="w-10 h-10 min-w-[40px] min-h-[40px] rounded-full bg-[var(--green)] text-white flex items-center justify-center shadow-[0_3px_0_var(--green-dark)] active:translate-y-[2px] active:shadow-[0_1px_0_var(--green-dark)] hover:brightness-105 transition-all duration-75 cursor-pointer shrink-0"
            >
              {isPlaying ? (
                <Pause className="w-4 h-4 fill-white stroke-none" />
              ) : (
                <Play className="w-4 h-4 fill-white stroke-none ml-0.5" />
              )}
            </button>

            {/* Tactile 3D Circular Skip Forward Button */}
            <button
              type="button"
              onClick={() => seekBy(10)}
              aria-label="Skip forward 10 seconds"
              className="w-10 h-10 min-w-[40px] min-h-[40px] rounded-full bg-zinc-800 text-white flex items-center justify-center border-2 border-[var(--border-strong)] shadow-[0_3px_0_var(--border-strong)] active:translate-y-[2px] active:shadow-[0_1px_0_var(--border-strong)] hover:brightness-110 transition-all duration-75 cursor-pointer shrink-0 text-[10px] sm:text-[11px] font-extrabold"
            >
              <RotateCw className="w-3.5 h-3.5" />
              <span className="sr-only">+10s</span>
            </button>

            {/* Multi-state Volume toggle + slider */}
            <div className="flex items-center gap-1.5 group/vol">
              <button
                type="button"
                onClick={toggleMute}
                aria-label={isMuted || volume === 0 ? 'Unmute' : 'Mute'}
                className="min-w-[40px] min-h-[40px] flex items-center justify-center text-zinc-300 hover:text-white transition cursor-pointer shrink-0"
              >
                {isMuted || volume === 0 ? (
                  <VolumeX data-testid="volume-icon-muted" className="w-4 h-4" />
                ) : volume <= 0.5 ? (
                  <Volume1 data-testid="volume-icon-low" className="w-4 h-4" />
                ) : (
                  <Volume2 data-testid="volume-icon-high" className="w-4 h-4" />
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
            <span className="text-zinc-200 font-bold text-[11px] sm:text-xs mono ml-1 whitespace-nowrap tabular-nums shrink-0">
              {formatTime(currentTime)} / {formatTime(duration)}
            </span>
          </div>

          {/* Right Controls: Title, Settings Popover, Fullscreen */}
          <div className="flex items-center gap-2 sm:gap-3 min-w-0 shrink-0">
            {title && (
              <span className="text-zinc-400 text-xs font-bold truncate max-w-[140px] sm:max-w-[220px] hidden md:inline">
                {title}
              </span>
            )}

            {/* Unified settings popover: speed, quality, subtitles, shortcuts */}
            <VideoSettingsPopover
              container={portalContainer}
              playbackSpeed={playbackSpeed}
              onSpeedChange={handleSpeedChange}
              qualities={qualities}
              selectedQualityId={selectedQualityId}
              onQualityChange={handleQualityChange}
              subtitles={subtitles}
              selectedSubtitleId={selectedSubtitleId}
              onSubtitleChange={handleSubtitleChange}
              open={isDesktopSettingsOpen}
              onOpenChange={setIsDesktopSettingsOpen}
              onShortcutsOpenChange={setIsShortcutsOpen}
            />

            {/* Fullscreen Button */}
            <button
              type="button"
              onClick={toggleFullscreen}
              aria-label={isFullscreen || isPseudoFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
              className="min-w-[40px] min-h-[40px] flex items-center justify-center text-zinc-300 hover:text-white transition cursor-pointer shrink-0"
            >
              {isFullscreen || isPseudoFullscreen ? (
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
