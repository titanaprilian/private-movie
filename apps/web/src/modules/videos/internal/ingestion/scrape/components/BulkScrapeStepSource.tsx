import {
  ChunkySelect,
  ChunkySelectContent,
  ChunkySelectItem,
  ChunkySelectTrigger,
  ChunkySelectValue,
} from '@/components/ui/chunky-select';
import { ChunkyInput } from '@/components/ui/chunky-input';
import { labelClassName } from '../../components/StorageProviderSelect';

export interface BulkScrapeStepSourceProps {
  sourceUrl: string;
  sourceType: string;
  seasonOptions: Array<{ id: string; label: string }>;
  selectedSeasonId: string;
  isFetchingPreview: boolean;
  onSourceUrlChange: (url: string) => void;
  onSourceTypeChange: (type: string) => void;
  onSelectSeason: (seasonId: string) => void;
}

export function BulkScrapeStepSource({
  sourceUrl,
  sourceType,
  seasonOptions,
  selectedSeasonId,
  isFetchingPreview,
  onSourceUrlChange,
  onSourceTypeChange,
  onSelectSeason,
}: BulkScrapeStepSourceProps) {
  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <label htmlFor="bulk-scrape-url" className={labelClassName}>
          Season / Scraper URL
        </label>
        <ChunkyInput
          id="bulk-scrape-url"
          type="url"
          placeholder="https://otakudesu.cloud/anime/example-season"
          value={sourceUrl}
          onChange={(e) => onSourceUrlChange(e.target.value)}
          disabled={isFetchingPreview}
          required
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <label htmlFor="bulk-scrape-source-type" className={labelClassName}>
            Source Type
          </label>
          <ChunkySelect
            value={sourceType}
            onValueChange={onSourceTypeChange}
            disabled={isFetchingPreview}
          >
            <ChunkySelectTrigger id="bulk-scrape-source-type" aria-label="Source Type">
              <ChunkySelectValue placeholder="Select source type" />
            </ChunkySelectTrigger>
            <ChunkySelectContent>
              <ChunkySelectItem value="otakudesu">Otakudesu</ChunkySelectItem>
              <ChunkySelectItem value="dramula">Dramula</ChunkySelectItem>
              <ChunkySelectItem value="direct">Direct Link</ChunkySelectItem>
              <ChunkySelectItem value="embed">Embed</ChunkySelectItem>
            </ChunkySelectContent>
          </ChunkySelect>
        </div>

        <div className="space-y-1.5">
          <label htmlFor="bulk-scrape-target-season" className={labelClassName}>
            Target Season
          </label>
          <ChunkySelect
            value={selectedSeasonId || (seasonOptions.length === 0 ? 'empty' : undefined)}
            onValueChange={(val) => {
              if (val !== 'empty') onSelectSeason(val);
            }}
            disabled={isFetchingPreview || seasonOptions.length === 0}
          >
            <ChunkySelectTrigger id="bulk-scrape-target-season" aria-label="Target Season">
              <ChunkySelectValue placeholder="Select target season" />
            </ChunkySelectTrigger>
            <ChunkySelectContent>
              {seasonOptions.length > 0 ? (
                seasonOptions.map((season) => (
                  <ChunkySelectItem key={season.id} value={season.id}>
                    {season.label}
                  </ChunkySelectItem>
                ))
              ) : (
                <ChunkySelectItem value="empty">-- No Seasons --</ChunkySelectItem>
              )}
            </ChunkySelectContent>
          </ChunkySelect>
        </div>
      </div>
    </div>
  );
}
