import { ChunkyButton } from '@/components/ui/chunky-button';
import { ChunkyCard } from '@/components/ui/chunky-card';
import type {
  LocalEpisodeItem,
  ScrapedEpisodePreviewItem,
  SeasonGroupOption,
} from '../../types';
import { PillBadge, WarningBadge } from '../../components/IngestionBadges';
import { TargetEpisodeCombobox } from './TargetEpisodeCombobox';

export interface BulkScrapeStepReviewProps {
  previewItems: ScrapedEpisodePreviewItem[];
  targetSeasonEpisodes: LocalEpisodeItem[];
  seasons?: SeasonGroupOption[];
  localEpisodes?: LocalEpisodeItem[];
  selectedSeasonId: string;
  isSaving: boolean;
  isEpisodeHasSources: (episodeId: string | null) => boolean;
  onUpdateMapping: (index: number, localEpisodeId: string | null) => void;
  onToggleIgnore: (index: number) => void;
  onAutoAlign: () => void;
}

export function BulkScrapeStepReview({
  previewItems,
  targetSeasonEpisodes,
  seasons,
  localEpisodes,
  selectedSeasonId,
  isSaving,
  isEpisodeHasSources,
  onUpdateMapping,
  onToggleIgnore,
  onAutoAlign,
}: BulkScrapeStepReviewProps) {
  return (
    <div className="space-y-4">
      <ChunkyCard className="flex flex-wrap items-center justify-between gap-2 p-3 text-sm font-bold text-[var(--muted)]">
        <span>
          Total Scraped: <strong className="text-[var(--ink)]">{previewItems.length}</strong>
        </span>
        <span>
          Pending Review:{' '}
          <strong className="text-[var(--gold)]">
            {previewItems.filter((i) => i.needsReview && !i.isIgnored).length}
          </strong>
        </span>
        <ChunkyButton
          type="button"
          variant="blue"
          size="sm"
          onClick={onAutoAlign}
          disabled={isSaving || previewItems.length === 0 || targetSeasonEpisodes.length === 0}
        >
          Auto-align sequentially (1..{targetSeasonEpisodes.length})
        </ChunkyButton>
      </ChunkyCard>

      <div className="space-y-2">
        <div className="grid grid-cols-1 gap-2 max-h-[360px] overflow-y-auto pr-1">
          {previewItems.map((item, index) => {
            const isConflict =
              !item.isIgnored &&
              Boolean(item.matchedLocalEpisodeId) &&
              isEpisodeHasSources(item.matchedLocalEpisodeId);

            return (
              <ChunkyCard
                key={item.id}
                className={`p-3 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-sm ${
                  item.isIgnored ? 'opacity-50' : ''
                }`}
              >
                <div className="flex-1 min-w-0 space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-bold text-[var(--ink)]">{item.scrapedTitle}</span>
                    <PillBadge>Ep #{item.rawEpisodeNumber}</PillBadge>
                    {item.needsReview && !item.isIgnored && (
                      <WarningBadge>Needs Review</WarningBadge>
                    )}
                    {isConflict && <WarningBadge>⚠️ Overwrites existing sources</WarningBadge>}
                    {item.isIgnored && <PillBadge>Ignored</PillBadge>}
                  </div>
                </div>

                <div className="w-full sm:w-64">
                  <TargetEpisodeCombobox
                    scrapedTitle={item.scrapedTitle}
                    value={item.matchedLocalEpisodeId}
                    disabled={item.isIgnored || isSaving}
                    onValueChange={(newId) => onUpdateMapping(index, newId)}
                    seasons={seasons}
                    localEpisodes={localEpisodes}
                    targetSeasonId={selectedSeasonId}
                  />
                </div>

                <ChunkyButton
                  type="button"
                  variant={item.isIgnored ? 'outline' : 'blue'}
                  size="sm"
                  aria-label={`Ignore ${item.scrapedTitle}`}
                  onClick={() => onToggleIgnore(index)}
                  disabled={isSaving}
                  className="shrink-0"
                >
                  {item.isIgnored ? 'Include' : 'Ignore'}
                </ChunkyButton>
              </ChunkyCard>
            );
          })}
        </div>
      </div>
    </div>
  );
}
