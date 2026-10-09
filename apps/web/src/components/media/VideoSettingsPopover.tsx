import { useState } from 'react';
import { Settings, Check, Keyboard } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  ChunkyDialog,
  ChunkyDialogContent,
  ChunkyDialogHeader,
  ChunkyDialogTitle,
  ChunkyDialogBody,
} from '@/components/ui/chunky-dialog';

export const PLAYBACK_SPEEDS = [0.5, 1, 1.25, 1.5, 2];

export interface QualityOption {
  id: string;
  label: string;
}

export interface SubtitleOption {
  id: string;
  label: string;
}

export interface VideoSettingsPopoverProps {
  playbackSpeed: number;
  onSpeedChange: (speed: number) => void;
  /** When 2+ entries exist, the Quality section renders. */
  qualities?: QualityOption[];
  selectedQualityId?: string;
  onQualityChange?: (id: string) => void;
  /** When entries exist, the Subtitles section renders. */
  subtitles?: SubtitleOption[];
  /** Currently selected subtitle track id, or null for Off. */
  selectedSubtitleId?: string | null;
  onSubtitleChange?: (id: string | null) => void;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  /** Notifies the parent when the Shortcuts dialog opens/closes so the
   * controls auto-hide timer can stay suppressed while it is visible. */
  onShortcutsOpenChange?: (open: boolean) => void;
  container?: HTMLElement | null;
}

const KEYBOARD_SHORTCUTS: Array<{ keys: string; action: string }> = [
  { keys: 'Space / K', action: 'Play / Pause' },
  { keys: 'J / L', action: 'Rewind / Forward 10s' },
  { keys: 'ArrowLeft / ArrowRight', action: 'Seek ∓ 5s' },
  { keys: 'ArrowUp / ArrowDown', action: 'Volume Up / Down' },
  { keys: 'M', action: 'Mute / Unmute' },
  { keys: 'F', action: 'Toggle Fullscreen' },
];

const TOUCH_GESTURES: Array<{ gesture: string; action: string }> = [
  { gesture: 'Single tap', action: 'Show / hide controls' },
  { gesture: 'Tap video', action: 'Play / pause (desktop click)' },
  { gesture: 'Drag scrubber', action: 'Seek through video' },
];

export function VideoSettingsPopover({
  playbackSpeed,
  onSpeedChange,
  qualities,
  selectedQualityId,
  onQualityChange,
  subtitles,
  selectedSubtitleId = null,
  onSubtitleChange,
  open,
  onOpenChange,
  onShortcutsOpenChange,
  container,
}: VideoSettingsPopoverProps) {
  const [shortcutsOpen, setShortcutsOpen] = useState(false);

  const showQuality = qualities !== undefined && qualities.length > 1;
  const showSubtitles = subtitles !== undefined && subtitles.length > 0;

  const handleShortcutsOpenChange = (next: boolean) => {
    setShortcutsOpen(next);
    onShortcutsOpenChange?.(next);
  };

  return (
    <>
      <Popover open={open} onOpenChange={onOpenChange}>
        <PopoverTrigger asChild>
          <button
            type="button"
            aria-label="Video settings"
            className="w-10 h-10 min-w-[40px] min-h-[40px] rounded-full bg-zinc-900/90 border border-zinc-700 text-zinc-200 hover:text-white hover:bg-zinc-800 flex items-center justify-center shadow-[0_3px_0_rgba(0,0,0,0.6)] active:translate-y-[2px] active:shadow-[0_1px_0_rgba(0,0,0,0.6)] transition-all duration-75 cursor-pointer shrink-0"
          >
            <Settings className="w-4 h-4" />
          </button>
        </PopoverTrigger>
        <PopoverContent
          container={container}
          side="top"
          align="end"
          data-testid="video-settings-popover"
          className="w-56 max-h-80 overflow-y-auto p-1.5 rounded-2xl border-2 border-[var(--border-strong)] bg-zinc-950/95 backdrop-blur-md text-white shadow-xl space-y-1"
        >
          <p className="text-[10px] font-extrabold text-zinc-400 uppercase tracking-wider px-2 py-1">
            Playback Speed
          </p>
          {PLAYBACK_SPEEDS.map((speed) => {
            const isSelected = playbackSpeed === speed;
            return (
              <button
                key={speed}
                type="button"
                onClick={() => onSpeedChange(speed)}
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

          {showQuality && (
            <>
              <p className="text-[10px] font-extrabold text-zinc-400 uppercase tracking-wider px-2 pt-2 pb-1">
                Quality
              </p>
              {qualities!.map((q) => {
                const isSelected =
                  selectedQualityId !== undefined ? selectedQualityId === q.id : false;
                return (
                  <button
                    key={q.id}
                    type="button"
                    onClick={() => onQualityChange?.(q.id)}
                    aria-label={q.label}
                    className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                      isSelected
                        ? 'bg-[var(--green)] text-white'
                        : 'text-zinc-300 hover:bg-zinc-800 hover:text-white'
                    }`}
                  >
                    <span>{q.label}</span>
                    {isSelected && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                  </button>
                );
              })}
            </>
          )}

          {showSubtitles && (
            <>
              <p className="text-[10px] font-extrabold text-zinc-400 uppercase tracking-wider px-2 pt-2 pb-1">
                Subtitles
              </p>
              <button
                type="button"
                onClick={() => onSubtitleChange?.(null)}
                aria-label="Subtitles Off"
                className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                  selectedSubtitleId === null
                    ? 'bg-[var(--green)] text-white'
                    : 'text-zinc-300 hover:bg-zinc-800 hover:text-white'
                }`}
              >
                <span>Off</span>
                {selectedSubtitleId === null && (
                  <Check className="w-3.5 h-3.5 stroke-[3]" />
                )}
              </button>
              {subtitles!.map((s) => {
                const isSelected = selectedSubtitleId === s.id;
                return (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => onSubtitleChange?.(s.id)}
                    aria-label={s.label}
                    className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                      isSelected
                        ? 'bg-[var(--green)] text-white'
                        : 'text-zinc-300 hover:bg-zinc-800 hover:text-white'
                    }`}
                  >
                    <span>{s.label}</span>
                    {isSelected && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                  </button>
                );
              })}
            </>
          )}

          <button
            type="button"
            onClick={() => handleShortcutsOpenChange(true)}
            className="w-full flex items-center gap-2 px-2.5 py-1.5 mt-1 rounded-xl text-xs font-bold text-zinc-300 hover:bg-zinc-800 hover:text-white transition cursor-pointer border-t border-zinc-800"
          >
            <Keyboard className="w-3.5 h-3.5" />
            <span>Shortcuts &amp; Gestures</span>
          </button>
        </PopoverContent>
      </Popover>

      <ChunkyDialog open={shortcutsOpen} onOpenChange={handleShortcutsOpenChange}>
        <ChunkyDialogContent
          container={container}
          aria-label="Shortcuts and gestures"
          className="max-w-md border-[var(--border-strong)] bg-zinc-950/95 text-white"
          data-testid="shortcuts-dialog"
        >
          <ChunkyDialogHeader className="border-zinc-800">
            <ChunkyDialogTitle className="text-white text-base font-extrabold">
              Shortcuts &amp; Gestures
            </ChunkyDialogTitle>
          </ChunkyDialogHeader>
          <ChunkyDialogBody>
          <div className="space-y-4">
            <div>
              <p className="text-[10px] font-extrabold text-zinc-400 uppercase tracking-wider pb-2">
                Keyboard Shortcuts
              </p>
              <dl className="space-y-1.5">
                {KEYBOARD_SHORTCUTS.map((row) => (
                  <div key={row.keys} className="flex items-center justify-between gap-3 text-xs">
                    <dt className="px-2 py-1 rounded-lg bg-zinc-800 border border-zinc-700 font-mono font-bold text-zinc-100 whitespace-nowrap">
                      {row.keys}
                    </dt>
                    <dd className="text-zinc-300 font-semibold text-right">{row.action}</dd>
                  </div>
                ))}
              </dl>
            </div>
            <div>
              <p className="text-[10px] font-extrabold text-zinc-400 uppercase tracking-wider pb-2">
                Mobile Touch Gestures
              </p>
              <dl className="space-y-1.5">
                {TOUCH_GESTURES.map((row) => (
                  <div
                    key={row.gesture}
                    className="flex items-center justify-between gap-3 text-xs"
                  >
                    <dt className="px-2 py-1 rounded-lg bg-zinc-800 border border-zinc-700 font-bold text-zinc-100 whitespace-nowrap">
                      {row.gesture}
                    </dt>
                    <dd className="text-zinc-300 font-semibold text-right">{row.action}</dd>
                  </div>
                ))}
              </dl>
            </div>
          </div>
          </ChunkyDialogBody>
        </ChunkyDialogContent>
      </ChunkyDialog>
    </>
  );
}
