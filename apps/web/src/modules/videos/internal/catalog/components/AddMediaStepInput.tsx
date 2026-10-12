import {
  ChunkySelect,
  ChunkySelectContent,
  ChunkySelectItem,
  ChunkySelectTrigger,
  ChunkySelectValue,
} from '@/components/ui/chunky-select';
import { ChunkyInput } from '@/components/ui/chunky-input';
import { ChunkyCheckbox } from '@/components/ui/chunky-checkbox';
import type { AddMediaStepInputProps } from '../types';
export type { AddMediaStepInputProps } from '../types';

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

export function AddMediaStepInput({
  tmdbType,
  tmdbId,
  includeSpecials,
  error,
  onTmdbTypeChange,
  onTmdbIdChange,
  onIncludeSpecialsChange,
}: AddMediaStepInputProps) {
  return (
    <div className="space-y-4">
      <div>
        <label
          htmlFor="media-tmdb-type"
          className="mb-1.5 block text-sm font-bold text-[var(--ink)]"
        >
          Media Type
        </label>
        <ChunkySelect
          value={tmdbType}
          onValueChange={(val) => onTmdbTypeChange(val as 'tv' | 'movie')}
        >
          <ChunkySelectTrigger id="media-tmdb-type" className="w-full">
            <ChunkySelectValue placeholder="Select media type" />
          </ChunkySelectTrigger>
          <ChunkySelectContent>
            <ChunkySelectItem value="tv">TV</ChunkySelectItem>
            <ChunkySelectItem value="movie">Movie</ChunkySelectItem>
          </ChunkySelectContent>
        </ChunkySelect>
      </div>

      <div>
        <label
          htmlFor="media-tmdb-id"
          className="mb-1.5 block text-sm font-bold text-[var(--ink)]"
        >
          TMDB ID
        </label>
        <ChunkyInput
          id="media-tmdb-id"
          type="text"
          value={tmdbId}
          onChange={(e) => onTmdbIdChange(e.target.value)}
          placeholder="e.g. 1399"
        />
      </div>

      <div className="flex items-center gap-2 pt-1">
        <ChunkyCheckbox
          id="media-include-specials"
          checked={includeSpecials}
          onCheckedChange={onIncludeSpecialsChange}
        />
        <label
          htmlFor="media-include-specials"
          className="text-sm font-bold text-[var(--muted)] select-none cursor-pointer"
        >
          Include Specials
        </label>
      </div>

      {error && <ErrorBanner message={error} />}
    </div>
  );
}
