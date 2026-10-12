import {
  ChunkyDialogBody,
  ChunkyDialogFooter,
} from '@/components/ui/chunky-dialog';
import { ChunkyButton } from '@/components/ui/chunky-button';
import { ChunkyInput } from '@/components/ui/chunky-input';
import { ChunkyTextarea } from '@/components/ui/chunky-textarea';
import {
  ChunkySelect,
  ChunkySelectContent,
  ChunkySelectItem,
  ChunkySelectTrigger,
  ChunkySelectValue,
} from '@/components/ui/chunky-select';
import { labelClassName } from '../../../components/StorageProviderSelect';

export interface UrlStep1Props {
  rawUrlsText: string;
  setRawUrlsText: (v: string) => void;
  urlSelectedSeasonId: string;
  setUrlSelectedSeasonId: (v: string) => void;
  seasonOptions: { id: string; label: string }[];
  defaultQuality: string;
  setDefaultQuality: (v: string) => void;
  storageProviders: { id: string; name: string; isDefault: boolean }[];
  urlStorageProviderId: string;
  setUrlStorageProviderId: (id: string) => void;
  urlDefaultLabel: string;
  setUrlDefaultLabel: (v: string) => void;
  sharedReferer: string;
  setSharedReferer: (v: string) => void;
  isProcessing: boolean;
  onSubmit: (e: React.FormEvent) => void;
  onCancel: () => void;
}

export function UrlStep1({
  rawUrlsText,
  setRawUrlsText,
  urlSelectedSeasonId,
  setUrlSelectedSeasonId,
  seasonOptions,
  defaultQuality,
  setDefaultQuality,
  storageProviders,
  urlStorageProviderId,
  setUrlStorageProviderId,
  urlDefaultLabel,
  setUrlDefaultLabel,
  sharedReferer,
  setSharedReferer,
  isProcessing,
  onSubmit,
  onCancel,
}: UrlStep1Props) {
  return (
    <form
      onSubmit={onSubmit}
      className="flex min-h-0 flex-1 flex-col overflow-hidden"
    >
      <ChunkyDialogBody className="space-y-4">
        <div className="space-y-1.5">
          <label htmlFor="bulk-ingest-urls" className={labelClassName}>
            Video URLs (One per line)
          </label>
          <ChunkyTextarea
            id="bulk-ingest-urls"
            data-testid="bulk-ingest-urls-textarea"
            rows={6}
            placeholder={`https://example.com/videos/Teach.You.a.Lesson.E01.1080p.mp4\nhttps://example.com/videos/Teach.You.a.Lesson.E02.1080p.mp4`}
            value={rawUrlsText}
            onChange={(e) => setRawUrlsText(e.target.value)}
            required
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label htmlFor="bulk-ingest-target-season" className={labelClassName}>
              Target Season
            </label>
            <ChunkySelect
              value={urlSelectedSeasonId || (seasonOptions.length === 0 ? 'empty' : undefined)}
              onValueChange={(val) => {
                if (val !== 'empty') {
                  setUrlSelectedSeasonId(val);
                }
              }}
              disabled={seasonOptions.length === 0}
            >
              <ChunkySelectTrigger
                id="bulk-ingest-target-season"
                aria-label="Target Season"
              >
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
                  <ChunkySelectItem value="empty">-- Default Season --</ChunkySelectItem>
                )}
              </ChunkySelectContent>
            </ChunkySelect>
          </div>

          <div className="space-y-1.5">
            <label htmlFor="bulk-ingest-default-quality" className={labelClassName}>
              Default Quality
            </label>
            <ChunkySelect
              value={defaultQuality || 'auto'}
              onValueChange={(val) => setDefaultQuality(val === 'auto' ? '' : val)}
            >
              <ChunkySelectTrigger
                id="bulk-ingest-default-quality"
                aria-label="Default Quality"
              >
                <ChunkySelectValue placeholder="Select default quality" />
              </ChunkySelectTrigger>
              <ChunkySelectContent>
                <ChunkySelectItem value="auto">Auto / Extracted</ChunkySelectItem>
                <ChunkySelectItem value="2160p">2160p (4K)</ChunkySelectItem>
                <ChunkySelectItem value="1080p">1080p</ChunkySelectItem>
                <ChunkySelectItem value="720p">720p</ChunkySelectItem>
                <ChunkySelectItem value="480p">480p</ChunkySelectItem>
                <ChunkySelectItem value="360p">360p</ChunkySelectItem>
              </ChunkySelectContent>
            </ChunkySelect>
          </div>
        </div>

        {/* Target S3 Storage Provider (Conditional) */}
        {storageProviders.length > 0 && (
          <div className="space-y-1.5">
            <label htmlFor="bulk-ingest-storage-provider" className={labelClassName}>
              Target S3 Storage Provider
            </label>
            <ChunkySelect
              value={urlStorageProviderId}
              onValueChange={(val) => setUrlStorageProviderId(val)}
              disabled={isProcessing}
            >
              <ChunkySelectTrigger
                id="bulk-ingest-storage-provider"
                data-testid="bulk-ingest-storage-provider-select"
                aria-label="Target S3 Storage Provider"
              >
                <ChunkySelectValue placeholder="Select storage provider" />
              </ChunkySelectTrigger>
              <ChunkySelectContent>
                {storageProviders.map((provider) => (
                  <ChunkySelectItem key={provider.id} value={provider.id}>
                    {provider.name}
                    {provider.isDefault ? ' (Default)' : ''}
                  </ChunkySelectItem>
                ))}
              </ChunkySelectContent>
            </ChunkySelect>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label htmlFor="bulk-ingest-default-label" className={labelClassName}>
              Default Source Label
            </label>
            <ChunkyInput
              id="bulk-ingest-default-label"
              type="text"
              placeholder="S3 Video"
              value={urlDefaultLabel}
              onChange={(e) => setUrlDefaultLabel(e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="bulk-ingest-referer" className={labelClassName}>
              Shared HTTP Referer{' '}
              <span className="text-[var(--muted)] font-semibold">(Optional)</span>
            </label>
            <ChunkyInput
              id="bulk-ingest-referer"
              type="text"
              placeholder="https://referer-site.com"
              value={sharedReferer}
              onChange={(e) => setSharedReferer(e.target.value)}
            />
          </div>
        </div>
      </ChunkyDialogBody>

      <ChunkyDialogFooter>
        <ChunkyButton
          type="button"
          variant="outline"
          onClick={onCancel}
        >
          Cancel
        </ChunkyButton>
        <ChunkyButton type="submit" variant="primary" data-testid="bulk-ingest-parse-btn">
          Parse & Review URLs
        </ChunkyButton>
      </ChunkyDialogFooter>
    </form>
  );
}
