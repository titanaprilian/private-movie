import {
  ChunkySelect,
  ChunkySelectContent,
  ChunkySelectItem,
  ChunkySelectTrigger,
  ChunkySelectValue,
} from '@/components/ui/chunky-select';
import type { StorageProviderSelectProps } from '../types';

export const labelClassName = 'mb-1.5 block text-sm font-bold text-[var(--ink)]';

export function StorageProviderSelect({
  storageProviders,
  selectedStorageProviderId,
  setSelectedStorageProviderId,
  disabled,
}: StorageProviderSelectProps) {
  if (storageProviders.length === 0) return null;
  return (
    <div className="space-y-1.5">
      <label htmlFor="bulk-ingest-storage-provider" className={labelClassName}>
        Target S3 Storage Provider
      </label>
      <ChunkySelect
        value={selectedStorageProviderId}
        onValueChange={(val) => setSelectedStorageProviderId(val)}
        disabled={disabled}
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
  );
}
