export function ErrorBanner({ message }: { message: string }) {
  return (
    <div className="p-3 rounded-2xl border-2 border-[var(--red)] bg-[var(--red)]/10 text-[var(--red)] text-sm font-bold flex items-center gap-2">
      <svg
        className="w-4 h-4 shrink-0"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        aria-hidden="true"
      >
        <circle cx="12" cy="12" r="10" />
        <line x1="12" y1="8" x2="12" y2="12" />
        <line x1="12" y1="16" x2="12.01" y2="16" />
      </svg>
      <span>{message}</span>
    </div>
  );
}
