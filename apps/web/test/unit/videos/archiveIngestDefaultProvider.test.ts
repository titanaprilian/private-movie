import { describe, expect, it } from 'vitest';
import type { StorageProviderItem } from '@repo/contracts';
import { pickDefaultStorageProvider } from '@/modules/videos/internal/useArchiveIngestSources';

function makeProvider(overrides: Partial<StorageProviderItem> & { id: string }): StorageProviderItem {
  return {
    name: `Provider ${overrides.id}`,
    providerType: 'custom',
    endpoint: 'https://s3.example.com',
    region: 'us-east-1',
    bucket: 'videos',
    accessKeyIdMasked: '****',
    publicBaseUrl: null,
    forcePathStyle: false,
    storageLimitGb: 50,
    isDefault: false,
    isEnabled: true,
    linkedSourcesCount: 0,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('pickDefaultStorageProvider (ticket 693)', () => {
  it('returns null when no providers exist', () => {
    expect(pickDefaultStorageProvider([])).toBeNull();
  });

  it('prefers the enabled provider marked as default', () => {
    const providers = [
      makeProvider({ id: 'plain', isDefault: false }),
      makeProvider({ id: 'default', isDefault: true }),
    ];
    expect(pickDefaultStorageProvider(providers)?.id).toBe('default');
  });

  it('skips a disabled default in favor of an enabled provider', () => {
    const providers = [
      makeProvider({ id: 'disabled-default', isDefault: true, isEnabled: false }),
      makeProvider({ id: 'plain-enabled', isDefault: false, isEnabled: true }),
    ];
    expect(pickDefaultStorageProvider(providers)?.id).toBe('plain-enabled');
  });

  it('falls back to the first enabled provider when none is marked default', () => {
    const providers = [
      makeProvider({ id: 'first', isDefault: false }),
      makeProvider({ id: 'second', isDefault: false }),
    ];
    expect(pickDefaultStorageProvider(providers)?.id).toBe('first');
  });
});
