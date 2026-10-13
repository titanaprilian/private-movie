import {
  ChunkySelect,
  ChunkySelectContent,
  ChunkySelectItem,
  ChunkySelectTrigger,
  ChunkySelectValue,
} from '@/components/ui/chunky-select';
import { ChunkyInput } from '@/components/ui/chunky-input';
import { ChunkyCheckbox } from '@/components/ui/chunky-checkbox';
import { ErrorBanner } from '../../components/ErrorBanner';
export { ErrorBanner } from '../../components/ErrorBanner';
import type { AddMediaStepInputProps } from '../../types';
export type { AddMediaStepInputProps } from '../../types';

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
