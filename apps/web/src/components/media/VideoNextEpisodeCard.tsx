export interface VideoNextEpisodeCardProps {
  countdown: number;
  onPlayNow: () => void;
  onCancel: () => void;
}

export function VideoNextEpisodeCard({ countdown, onPlayNow, onCancel }: VideoNextEpisodeCardProps) {
  return (
    <div
      data-testid="next-episode-card"
      className="absolute bottom-20 sm:bottom-24 right-3 sm:right-6 z-30 w-64 sm:w-72 rounded-2xl border-2 border-[var(--border-strong)]/80 bg-zinc-950/90 backdrop-blur-md p-4 shadow-2xl text-white"
    >
      <p className="text-[10px] uppercase tracking-wider text-zinc-400 font-bold font-sans">
        Up Next
      </p>
      <p className="mt-1 text-sm font-bold font-sans">Next episode in {countdown}s</p>
      <div className="mt-3 flex items-center gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="flex-1 px-4 py-2.5 min-h-[44px] rounded-2xl border-2 border-[var(--border)] bg-[var(--surface)] text-[var(--ink)] dark:text-white text-xs font-bold shadow-[0_4px_0_var(--border)] active:translate-y-1 active:shadow-[0_1px_0_var(--border)] transition cursor-pointer"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={onPlayNow}
          className="flex-1 px-4 py-2.5 min-h-[44px] rounded-2xl bg-[var(--green)] text-white text-xs font-bold shadow-[0_4px_0_var(--green-dark)] active:translate-y-1 active:shadow-[0_1px_0_var(--green-dark)] hover:brightness-105 transition cursor-pointer"
        >
          Play Now
        </button>
      </div>
    </div>
  );
}
