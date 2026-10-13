import {
  ChunkyDialogBody,
  ChunkyDialogFooter,
} from '@/components/ui/chunky-dialog';
import { ChunkyButton } from '@/components/ui/chunky-button';
import { ChunkyInput } from '@/components/ui/chunky-input';
import { ChunkyCard } from '@/components/ui/chunky-card';
import { TargetEpisodeCombobox } from '../../../scrape/components/TargetEpisodeCombobox';
import { formatBytes } from '../../utils/parseIngestUrl';
import {
  PillBadge,
  ProviderBadge,
  WarningBadge,
} from '../../../components/IngestionBadges';
import type {
  ArchiveReviewItem,
  LocalEpisodeItem,
  SeasonGroupOption,
} from '../../../types';

function isSampleFilename(filename: string): boolean {
  return /sample/i.test(filename);
}

export interface ArchiveStep2Props {
  reviewItems: ArchiveReviewItem[];
  totalCount: number;
  matchedCount: number;
  needsReviewCount: number;
  selectedProviderName: string | null;
  updateReviewMapping: (index: number, episodeId: string | null) => void;
  updateReviewLabel: (index: number, label: string) => void;
  updateReviewQuality: (index: number, quality: string) => void;
  toggleReviewIgnore: (index: number) => void;
  seasons: SeasonGroupOption[];
  localEpisodes: LocalEpisodeItem[];
  onBack: () => void;
  onCommit: () => void;
  onCancelJob: () => void;
}

export function ArchiveStep2({
  reviewItems,
  totalCount,
  matchedCount,
  needsReviewCount,
  selectedProviderName,
  updateReviewMapping,
  updateReviewLabel,
  updateReviewQuality,
  toggleReviewIgnore,
  seasons,
  localEpisodes,
  onBack,
  onCommit,
  onCancelJob,
}: ArchiveStep2Props) {
  return (
    <>
      <ChunkyDialogBody className="space-y-4">
        {/* Header counters */}
        <ChunkyCard className="flex items-center justify-between gap-2 flex-wrap p-3 text-sm font-bold text-[var(--muted)]">
          <div className="flex items-center gap-4 flex-wrap">
            <span>
              Total Files: <strong className="text-[var(--ink)]">{totalCount}</strong>
            </span>
            <span>
              Matched:{' '}
              <strong className="text-[var(--green)]">{matchedCount}</strong>
            </span>
            <span>
              Needs Review:{' '}
              <strong className="text-[var(--gold)]">{needsReviewCount}</strong>
            </span>
          </div>
          {selectedProviderName && (
            <ProviderBadge data-testid="archive-ingest-target-provider-badge">
              Target: {selectedProviderName}
            </ProviderBadge>
          )}
        </ChunkyCard>

        {/* Review items list */}
        <div className="grid grid-cols-1 gap-2 max-h-[380px] overflow-y-auto pr-1">
          {reviewItems.map((item, index) => (
            <ChunkyCard
              key={item.fileId}
              data-testid={`archive-review-row-${index}`}
              className={`p-3 flex flex-col gap-2.5 text-sm ${
                item.isIgnored ? 'opacity-50' : ''
              }`}
            >
              {/* Top line: Filename & Status Badges */}
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div className="flex items-center gap-2 flex-wrap min-w-0 flex-1">
                  <span
                    className="font-bold text-[var(--ink)] truncate max-w-sm"
                    title={item.filename}
                  >
                    {item.filename}
                  </span>
                  {item.detectedEpisodeNumber !== null && (
                    <PillBadge>Detected Ep #{item.detectedEpisodeNumber}</PillBadge>
                  )}
                  {item.needsReview && !item.isIgnored && (
                    <WarningBadge>Needs Review</WarningBadge>
                  )}
                  {isSampleFilename(item.filename) && (
                    <PillBadge>Sample</PillBadge>
                  )}
                  {item.hasSizeAnomaly && !item.isIgnored && (
                    <WarningBadge>Size anomaly — differs from siblings</WarningBadge>
                  )}
                  {item.isIgnored && <PillBadge>Ignored</PillBadge>}
                  {item.fileSizeBytes > 0 && (
                    <PillBadge>{formatBytes(item.fileSizeBytes)}</PillBadge>
                  )}
                </div>

                <ChunkyButton
                  type="button"
                  variant={item.isIgnored ? 'outline' : 'blue'}
                  size="sm"
                  onClick={() => toggleReviewIgnore(index)}
                  className="shrink-0"
                >
                  {item.isIgnored ? 'Include' : 'Ignore'}
                </ChunkyButton>
              </div>

              {/* Bottom line: Target Episode + Label + Quality */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 items-center">
                <div>
                  <TargetEpisodeCombobox
                    scrapedTitle={item.filename}
                    value={item.matchedEpisodeId}
                    disabled={item.isIgnored}
                    onValueChange={(newId) => updateReviewMapping(index, newId)}
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
                    onChange={(e) => updateReviewLabel(index, e.target.value)}
                    disabled={item.isIgnored}
                  />
                </div>

                <div>
                  <ChunkyInput
                    type="text"
                    aria-label={`Quality for ${item.filename}`}
                    placeholder="Quality (e.g. 1080p)"
                    value={item.quality || ''}
                    onChange={(e) => updateReviewQuality(index, e.target.value)}
                    disabled={item.isIgnored}
                  />
                </div>
              </div>
            </ChunkyCard>
          ))}
        </div>
      </ChunkyDialogBody>

      <ChunkyDialogFooter>
        <ChunkyButton type="button" variant="outline" onClick={onBack}>
          Back
        </ChunkyButton>
        <ChunkyButton
          type="button"
          variant="danger"
          data-testid="archive-cancel-job-btn"
          onClick={onCancelJob}
        >
          Cancel
        </ChunkyButton>
        <ChunkyButton
          type="button"
          variant="primary"
          data-testid="archive-commit-btn"
          onClick={onCommit}
          disabled={matchedCount === 0}
        >
          Commit to S3 ({matchedCount})
        </ChunkyButton>
      </ChunkyDialogFooter>
    </>
  );
}
