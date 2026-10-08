import { useState, useRef, useCallback } from 'react';

export interface BufferedRange {
  start: number;
  end: number;
}

export interface VideoScrubberProps {
  currentTime: number;
  duration: number;
  bufferedRanges?: BufferedRange[];
  onSeek: (time: number) => void;
  onKeyDown?: (e: React.KeyboardEvent<HTMLInputElement>) => void;
}

function formatTime(seconds: number): string {
  if (isNaN(seconds) || seconds < 0) return '00:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

export function VideoScrubber({
  currentTime,
  duration,
  bufferedRanges = [],
  onSeek,
  onKeyDown,
}: VideoScrubberProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [hoverPosition, setHoverPosition] = useState<{ xPercent: number; time: number } | null>(null);

  const validDuration = typeof duration === 'number' && !isNaN(duration) && duration > 0 ? duration : 0;
  const validCurrentTime = typeof currentTime === 'number' && !isNaN(currentTime) && currentTime >= 0 ? currentTime : 0;

  const playedPercent = validDuration > 0 ? Math.min(100, Math.max(0, (validCurrentTime / validDuration) * 100)) : 0;

  // Calculate highest buffered end range
  const maxBufferedEnd = bufferedRanges.length > 0
    ? Math.max(...bufferedRanges.map((r) => (typeof r.end === 'number' && !isNaN(r.end) ? r.end : 0)))
    : 0;

  const bufferedPercent = validDuration > 0
    ? Math.min(100, Math.max(0, (maxBufferedEnd / validDuration) * 100))
    : 0;

  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (!containerRef.current || validDuration <= 0) return;
      const rect = containerRef.current.getBoundingClientRect();
      if (rect.width <= 0) return;

      const clientX = e.clientX;
      const offsetX = Math.max(0, Math.min(clientX - rect.left, rect.width));
      const xPercent = (offsetX / rect.width) * 100;
      const hoverTime = (xPercent / 100) * validDuration;

      setHoverPosition({ xPercent, time: hoverTime });
    },
    [validDuration]
  );

  const handleMouseLeave = useCallback(() => {
    setHoverPosition(null);
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const time = parseFloat(e.target.value);
    onSeek(time);
  };

  return (
    <div
      ref={containerRef}
      data-testid="video-scrubber"
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      className="relative flex items-center w-full group/scrubber py-2 cursor-pointer select-none"
    >
      {/* Hover timestamp tooltip pill */}
      {hoverPosition !== null && (
        <div
          data-testid="video-scrubber-tooltip"
          className="absolute bottom-full mb-2 -translate-x-1/2 px-2 py-0.5 rounded-full bg-zinc-900/95 border-2 border-[var(--border-strong)] text-white text-[11px] font-extrabold mono shadow-lg pointer-events-none z-30 transition-transform whitespace-nowrap"
          style={{ left: `${hoverPosition.xPercent}%` }}
        >
          {formatTime(hoverPosition.time)}
        </div>
      )}

      {/* 3-Layer 10px rounded track: 1. Background, 2. Buffered progress, 3. Played progress */}
      <div
        data-testid="video-scrubber-track-bg"
        className="relative w-full h-2.5 rounded-full bg-zinc-800 overflow-hidden pointer-events-none"
      >
        {/* Layer 2: Buffered progress bar */}
        <div
          data-testid="video-scrubber-buffered"
          className="absolute inset-y-0 left-0 bg-zinc-600/80 rounded-full transition-all duration-150"
          style={{ width: `${bufferedPercent}%` }}
        />
        {/* Layer 3: Played progress bar */}
        <div
          data-testid="video-scrubber-played"
          className="absolute inset-y-0 left-0 bg-[var(--green)] rounded-full transition-all duration-75"
          style={{ width: `${playedPercent}%` }}
        />
      </div>

      {/* Enlarged 16px 3D thumb handle expanding to 20px on hover/drag */}
      <div
        data-testid="video-scrubber-thumb"
        className="absolute top-1/2 -translate-y-1/2 w-4 h-4 bg-white rounded-full shadow-[0_2px_4px_rgba(0,0,0,0.5)] border-2 border-[var(--green-dark)] pointer-events-none transition-transform duration-100 group-hover/scrubber:scale-125"
        style={{
          left: `calc(${playedPercent}% - 8px)`,
        }}
      />

      {/* Native range input for accessible touch & keyboard control */}
      <input
        type="range"
        min="0"
        max={validDuration || 100}
        step="0.1"
        value={validCurrentTime}
        onChange={handleChange}
        onKeyDown={onKeyDown}
        aria-label="Progress"
        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
      />
    </div>
  );
}
