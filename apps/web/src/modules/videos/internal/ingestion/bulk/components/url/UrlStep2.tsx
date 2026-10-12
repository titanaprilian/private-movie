import {
  ChunkyDialogBody,
  ChunkyDialogFooter,
} from '@/components/ui/chunky-dialog';
import { ChunkyButton } from '@/components/ui/chunky-button';
import { ChunkyInput } from '@/components/ui/chunky-input';
import { ChunkyCard } from '@/components/ui/chunky-card';
import { TargetEpisodeCombobox } from '../../../scrape/components/TargetEpisodeCombobox';
import {
  PillBadge,
  ProviderBadge,
  WarningBadge,
} from '../../../components/IngestionBadges';
import type {
  BulkIngestItem,
  LocalEpisodeItem,
  SeasonGroupOption,
} from '../../../types';

export interface UrlStep2Props {
  items: BulkIngestItem[];
  urlTotalCount: number;
  urlMatchedCount: number;
  urlNeedsReviewCount: number;
  urlSelectedProviderName: string | null;
  updateMapping: (index: number, episodeId: string | null) => void;
  updateLabel: (index: number, label: string) => void;
  updateQuality: (index: number, quality: string) => void;
  toggleIgnore: (index: number) => void;
  seasons: SeasonGroupOption[];
  localEpisodes: LocalEpisodeItem[];
  onBack: () => void;
  onStart: () => void;
}

export function UrlStep2({
  items,
  urlTotalCount,
  urlMatchedCount,
  urlNeedsReviewCount,
  urlSelectedProviderName,
  updateMapping,
  updateLabel,
  updateQuality,
  toggleIgnore,
  seasons,
  localEpisodes,
  onBack,
  onStart,
}: UrlStep2Props) {
  return (
    <>
      <ChunkyDialogBody className="space-y-4">
        {/* Header counters */}
        <ChunkyCard className="flex items-center justify-between gap-2 flex-wrap p-3 text-sm font-bold text-[var(--muted)]">
          <div className="flex items-center gap-4 flex-wrap">
            <span>
              Total URLs: <strong className="text-[var(--ink)]">{urlTotalCount}</strong>
            </span>
            <span>
              Matched:{' '}
              <strong className="text-[var(--green)]">
                {urlMatchedCount}
              </strong>
            </span>
            <span>
              Needs Review:{' '}
              <strong className="text-[var(--gold)]">
                {urlNeedsReviewCount}
              </strong>
            </span>
          </div>
          {urlSelectedProviderName && (
            <ProviderBadge data-testid="bulk-ingest-target-provider-badge">
              Target: {urlSelectedProviderName}
            </ProviderBadge>
          )}
        </ChunkyCard>

        {/* List of URLs for matching & editing */}
        <div className="grid grid-cols-1 gap-2 max-h-[380px] overflow-y-auto pr-1">
          {items.map((item, index) => (
            <ChunkyCard
              key={item.id}
              data-testid={`bulk-ingest-row-${index}`}
              className={`p-3 flex flex-col gap-2.5 text-sm ${
                item.isIgnored ? 'opacity-50' : ''
              }`}
            >
              {/* Top line: Filename & Status Badges */}
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div className="flex items-center gap-2 flex-wrap min-w-0 flex-1">
                  <span
                    className="font-bold text-[var(--ink)] truncate max-w-sm"
                    title={item.url}
                  >
                    {item.filename}
                  </span>
                  {item.detectedEpisodeNumber !== null && (
                    <PillBadge>
                      Detected Ep #{item.detectedEpisodeNumber}
                    </PillBadge>
                  )}
                  {item.needsReview && !item.isIgnored && (
                    <WarningBadge>Needs Review</WarningBadge>
                  )}
                  {item.isIgnored && (
                    <PillBadge>Ignored</PillBadge>
                  )}
                </div>

                <ChunkyButton
                  type="button"
                  variant={item.isIgnored ? 'outline' : 'blue'}
                  size="sm"
                  onClick={() => toggleIgnore(index)}
                  className="shrink-0"
                >
                  {item.isIgnored ? 'Include' : 'Ignore'}
                </ChunkyButton>
              </div>

              {/* Bottom line: Target Episode Combobox + Label + Quality */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 items-center">
                <div>
                  <TargetEpisodeCombobox
                    scrapedTitle={item.filename}
                    value={item.matchedLocalEpisodeId}
                    disabled={item.isIgnored}
                    onValueChange={(newId) => updateMapping(index, newId)}
                    seasons={seasons}
                    localEpisodes={localEpisodes}
                  />
                </div>

                <div>
                  <ChunkyInput
                    type="text"
                    aria-label={`Label for ${item.filename}`}
                    placeholder="Label"
                    value={item.label}
                    onChange={(e) => updateLabel(index, e.target.value)}
                    disabled={item.isIgnored}
                  />
                </div>

                <div>
                  <ChunkyInput
                    type="text"
                    aria-label={`Quality for ${item.filename}`}
                    placeholder="Quality (e.g. 1080p)"
                    value={item.quality || ''}
                    onChange={(e) => updateQuality(index, e.target.value)}
                    disabled={item.isIgnored}
                  />
                </div>
              </div>
            </ChunkyCard>
          ))}
        </div>
      </ChunkyDialogBody>

      <ChunkyDialogFooter>
        <ChunkyButton
          type="button"
          variant="outline"
          onClick={onBack}
        >
          Back
        </ChunkyButton>
        <ChunkyButton
          type="button"
          variant="primary"
          data-testid="bulk-ingest-start-btn"
          onClick={onStart}
        >
          Start Bulk Ingestion ({urlMatchedCount})
        </ChunkyButton>
      </ChunkyDialogFooter>
    </>
  );
}
