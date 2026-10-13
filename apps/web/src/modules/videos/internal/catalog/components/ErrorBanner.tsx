import { AlertCircle } from 'lucide-react';

export function ErrorBanner({ message }: { message: string }) {
  return (
    <div className="p-3 rounded-2xl border-2 border-[var(--red)] bg-[var(--red)]/10 text-[var(--red)] text-sm font-bold flex items-center gap-2">
      <AlertCircle className="w-4 h-4 shrink-0" aria-hidden="true" />
      <span>{message}</span>
    </div>
  );
}
