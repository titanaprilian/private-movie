import type { SourceTypeBadgeProps } from '../types';

export function SourceTypeBadge({ type }: SourceTypeBadgeProps) {
  return (
    <span
      className={`rounded-xl border-2 border-b-4 px-2 py-0.5 font-mono text-[11px] font-extrabold uppercase ${
        type === 's3'
          ? 'border-[var(--purple-dark)] bg-[var(--purple)] text-white'
          : type === 'direct'
            ? 'border-[var(--green-dark)] bg-[var(--green)] text-white'
            : 'border-[var(--blue-dark)] bg-[var(--blue)] text-white'
      }`}
    >
      {type}
    </span>
  );
}
