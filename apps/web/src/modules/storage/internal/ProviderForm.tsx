import { useState, useEffect, useMemo } from 'react';
import { ChunkyButton } from '@/components/ui/chunky-button';
import { ChunkyInput } from '@/components/ui/chunky-input';
import { ChunkyCheckbox } from '@/components/ui/chunky-checkbox';
import { ChunkyCard } from '@/components/ui/chunky-card';
import {
  ChunkySelect,
  ChunkySelectContent,
  ChunkySelectItem,
  ChunkySelectTrigger,
  ChunkySelectValue,
} from '@/components/ui/chunky-select';
import {
  type StorageProviderItem,
  type StorageProviderType,
  type CreateStorageProviderRequest,
  type UpdateStorageProviderRequest,
  type TestStorageProviderRequest,
  testStorageProviderConnection,
} from './api';
import { Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';

export interface ProviderFormProps {
  initialProvider?: StorageProviderItem | null;
  onSave: (
    data: CreateStorageProviderRequest | UpdateStorageProviderRequest
  ) => Promise<void>;
  onCancel: () => void;
  isSaving?: boolean;
}

interface ProviderPreset {
  name: string;
  endpoint: string;
  region: string;
  forcePathStyle: boolean;
}

const PROVIDER_PRESETS: Record<StorageProviderType, ProviderPreset> = {
  backblaze: {
    name: 'Backblaze B2',
    endpoint: 'https://s3.us-west-002.backblazeb2.com',
    region: 'us-west-002',
    forcePathStyle: false,
  },
  cloudflare_r2: {
    name: 'Cloudflare R2',
    endpoint: 'https://<accountid>.r2.cloudflarestorage.com',
    region: 'auto',
    forcePathStyle: false,
  },
  aws_s3: {
    name: 'AWS S3',
    endpoint: 'https://s3.us-east-1.amazonaws.com',
    region: 'us-east-1',
    forcePathStyle: false,
  },
  wasabi: {
    name: 'Wasabi',
    endpoint: 'https://s3.wasabisys.com',
    region: 'us-east-1',
    forcePathStyle: false,
  },
  minio: {
    name: 'MinIO',
    endpoint: 'http://localhost:9000',
    region: 'us-east-1',
    forcePathStyle: true,
  },
  custom: {
    name: 'Custom S3',
    endpoint: '',
    region: 'us-east-1',
    forcePathStyle: false,
  },
};

const PROVIDER_TYPE_LABELS: Record<StorageProviderType, string> = {
  backblaze: 'Backblaze B2',
  cloudflare_r2: 'Cloudflare R2',
  aws_s3: 'AWS S3',
  wasabi: 'Wasabi',
  minio: 'MinIO',
  custom: 'Custom S3',
};

const labelClassName =
  'font-sans text-[11px] font-extrabold uppercase tracking-wider text-[var(--ink)]';

export function ProviderForm({
  initialProvider,
  onSave,
  onCancel,
  isSaving = false,
}: ProviderFormProps) {
  const isEditing = Boolean(initialProvider);

  const [providerType, setProviderType] = useState<StorageProviderType>(
    initialProvider?.providerType || 'backblaze'
  );
  const [name, setName] = useState(initialProvider?.name || '');
  const [endpoint, setEndpoint] = useState(initialProvider?.endpoint || '');
  const [region, setRegion] = useState(initialProvider?.region || 'us-east-1');
  const [bucket, setBucket] = useState(initialProvider?.bucket || '');
  const [accessKeyId, setAccessKeyId] = useState('');
  const [secretAccessKey, setSecretAccessKey] = useState('');
  const [publicBaseUrl, setPublicBaseUrl] = useState(
    initialProvider?.publicBaseUrl || ''
  );
  const [forcePathStyle, setForcePathStyle] = useState(
    initialProvider?.forcePathStyle || false
  );
  const [storageLimitGb, setStorageLimitGb] = useState<number>(
    initialProvider?.storageLimitGb ?? 50
  );
  const [isDefault, setIsDefault] = useState(
    initialProvider?.isDefault || false
  );
  const [isEnabled, setIsEnabled] = useState(
    initialProvider?.isEnabled ?? true
  );

  // Test connection state
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<{
    success: boolean;
    message?: string;
  } | null>(null);

  // Region options always include the current value plus every preset region
  const regionOptions = useMemo(() => {
    const presetRegions = Object.values(PROVIDER_PRESETS).map((p) => p.region);
    return Array.from(new Set([region, ...presetRegions].filter(Boolean)));
  }, [region]);

  // Set default values when preset changes (only when creating or explicitly changed)
  const handlePresetChange = (newType: StorageProviderType) => {
    setProviderType(newType);
    const preset = PROVIDER_PRESETS[newType];
    if (!name || Object.values(PROVIDER_PRESETS).some((p) => p.name === name)) {
      setName(preset.name);
    }
    if (
      !endpoint ||
      Object.values(PROVIDER_PRESETS).some((p) => p.endpoint === endpoint)
    ) {
      setEndpoint(preset.endpoint);
    }
    if (
      !region ||
      Object.values(PROVIDER_PRESETS).some((p) => p.region === region)
    ) {
      setRegion(preset.region);
    }
    setForcePathStyle(preset.forcePathStyle);
  };

  useEffect(() => {
    if (!isEditing && !name && !endpoint) {
      handlePresetChange('backblaze');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleTestConnection = async () => {
    setIsTesting(true);
    setTestResult(null);

    const testPayload: TestStorageProviderRequest = {
      providerId: initialProvider?.id,
      endpoint: endpoint.trim() || undefined,
      region: region.trim() || undefined,
      bucket: bucket.trim() || undefined,
      accessKeyId: accessKeyId.trim() || undefined,
      secretAccessKey: secretAccessKey.trim() || undefined,
      forcePathStyle,
    };

    try {
      const res = await testStorageProviderConnection(testPayload);
      if (res.success) {
        setTestResult({
          success: true,
          message: res.message || 'Successfully connected to S3 bucket!',
        });
        toast.success('Connection test succeeded', {
          description: res.message || 'S3 endpoint and credentials verified.',
        });
      } else {
        setTestResult({
          success: false,
          message: res.message || 'Failed to connect to S3 bucket',
        });
        toast.error('Connection test failed', {
          description:
            res.message || 'Check endpoint, credentials, and bucket name.',
        });
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Connection test error';
      setTestResult({
        success: false,
        message: msg,
      });
      toast.error('Connection test failed', {
        description: msg,
      });
    } finally {
      setIsTesting(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !endpoint.trim() || !region.trim() || !bucket.trim()) {
      toast.error('Please fill in all required fields');
      return;
    }

    if (!isEditing && (!accessKeyId.trim() || !secretAccessKey.trim())) {
      toast.error(
        'Access Key ID and Secret Access Key are required for new providers'
      );
      return;
    }

    const payload: CreateStorageProviderRequest = {
      name: name.trim(),
      providerType,
      endpoint: endpoint.trim(),
      region: region.trim(),
      bucket: bucket.trim(),
      accessKeyId: accessKeyId.trim(),
      secretAccessKey: secretAccessKey.trim(),
      publicBaseUrl: publicBaseUrl.trim() ? publicBaseUrl.trim() : null,
      forcePathStyle,
      storageLimitGb: Number(storageLimitGb) || 50,
      isDefault,
      isEnabled,
    };

    await onSave(payload);
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-4"
      data-testid="provider-form"
    >
      {/* Preset Selector */}
      <div className="space-y-1.5">
        <label htmlFor="provider-preset" className={labelClassName}>
          Provider Preset
        </label>
        <ChunkySelect
          value={providerType}
          onValueChange={(val) =>
            handlePresetChange(val as StorageProviderType)
          }
        >
          <ChunkySelectTrigger
            id="provider-preset"
            data-testid="provider-preset-select"
            className="font-mono"
          >
            <ChunkySelectValue placeholder="Select preset" />
          </ChunkySelectTrigger>
          <ChunkySelectContent>
            {(Object.keys(PROVIDER_TYPE_LABELS) as StorageProviderType[]).map(
              (type) => (
                <ChunkySelectItem key={type} value={type} className="font-mono">
                  {PROVIDER_TYPE_LABELS[type]}
                </ChunkySelectItem>
              )
            )}
          </ChunkySelectContent>
        </ChunkySelect>
      </div>

      {/* Provider Name */}
      <div className="space-y-1.5">
        <label htmlFor="provider-name" className={labelClassName}>
          Friendly Name *
        </label>
        <ChunkyInput
          id="provider-name"
          data-testid="provider-name-input"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Backblaze B2 Main"
          required
        />
      </div>

      {/* Endpoint & Region */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <label htmlFor="provider-endpoint" className={labelClassName}>
            Endpoint URL *
          </label>
          <ChunkyInput
            id="provider-endpoint"
            data-testid="provider-endpoint-input"
            value={endpoint}
            onChange={(e) => setEndpoint(e.target.value)}
            placeholder="https://s3.us-west-002.backblazeb2.com"
            className="font-mono"
            required
          />
        </div>
        <div className="space-y-1.5">
          <label htmlFor="provider-region" className={labelClassName}>
            Region *
          </label>
          <ChunkySelect value={region} onValueChange={setRegion}>
            <ChunkySelectTrigger
              id="provider-region"
              data-testid="provider-region-select"
              className="font-mono"
            >
              <ChunkySelectValue placeholder="Select region" />
            </ChunkySelectTrigger>
            <ChunkySelectContent>
              {regionOptions.map((r) => (
                <ChunkySelectItem key={r} value={r} className="font-mono">
                  {r}
                </ChunkySelectItem>
              ))}
            </ChunkySelectContent>
          </ChunkySelect>
        </div>
      </div>

      {/* Bucket & Quota */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <label htmlFor="provider-bucket" className={labelClassName}>
            Bucket Name *
          </label>
          <ChunkyInput
            id="provider-bucket"
            data-testid="provider-bucket-input"
            value={bucket}
            onChange={(e) => setBucket(e.target.value)}
            placeholder="my-media-bucket"
            className="font-mono"
            required
          />
        </div>
        <div className="space-y-1.5">
          <label htmlFor="provider-quota" className={labelClassName}>
            Quota Limit (GB)
          </label>
          <ChunkyInput
            id="provider-quota"
            data-testid="provider-quota-input"
            type="number"
            min={1}
            value={storageLimitGb}
            onChange={(e) => setStorageLimitGb(Number(e.target.value))}
            className="font-mono"
          />
        </div>
      </div>

      {/* Public CDN Base URL */}
      <div className="space-y-1.5">
        <label htmlFor="provider-cdn" className={labelClassName}>
          Public CDN / Streaming Domain (optional)
        </label>
        <ChunkyInput
          id="provider-cdn"
          data-testid="provider-cdn-input"
          value={publicBaseUrl}
          onChange={(e) => setPublicBaseUrl(e.target.value)}
          placeholder="https://cdn.example.com"
          className="font-mono"
        />
        <p className="font-sans text-[11px] font-semibold text-[var(--muted)]">
          If set, videos from this provider stream directly through this CDN
          base URL.
        </p>
      </div>

      {/* Credentials */}
      <ChunkyCard className="p-4 space-y-3">
        <div className="font-display font-bold text-sm text-[var(--ink)]">
          Authentication Credentials
        </div>
        <div className="space-y-1.5">
          <label htmlFor="provider-key" className={labelClassName}>
            Access Key ID{' '}
            {isEditing
              ? `(current: ${initialProvider?.accessKeyIdMasked})`
              : '*'}
          </label>
          <ChunkyInput
            id="provider-key"
            data-testid="provider-access-key-input"
            value={accessKeyId}
            onChange={(e) => setAccessKeyId(e.target.value)}
            placeholder={
              isEditing ? 'Leave blank to keep unchanged' : 'AKIA...'
            }
            className="font-mono"
            required={!isEditing}
          />
        </div>

        <div className="space-y-1.5">
          <label htmlFor="provider-secret" className={labelClassName}>
            Secret Access Key {isEditing ? '(hidden / encrypted)' : '*'}
          </label>
          <ChunkyInput
            id="provider-secret"
            data-testid="provider-secret-key-input"
            type="password"
            value={secretAccessKey}
            onChange={(e) => setSecretAccessKey(e.target.value)}
            placeholder={
              isEditing ? 'Leave blank to keep unchanged' : '••••••••'
            }
            className="font-mono"
            required={!isEditing}
          />
        </div>
      </ChunkyCard>

      {/* Toggles */}
      <div className="space-y-2.5 pt-1">
        <label className="flex items-center gap-2.5 cursor-pointer">
          <ChunkyCheckbox
            checked={forcePathStyle}
            onCheckedChange={(c) => setForcePathStyle(c)}
            data-testid="provider-path-style-toggle"
            aria-label="Force path-style addressing"
          />
          <span className="font-sans text-sm font-bold text-[var(--ink)]">
            Force Path-Style Addressing (required for MinIO/Local S3)
          </span>
        </label>

        <label className="flex items-center gap-2.5 cursor-pointer">
          <ChunkyCheckbox
            checked={isDefault}
            onCheckedChange={(c) => setIsDefault(c)}
            data-testid="provider-default-toggle"
            aria-label="Designate as default storage provider"
          />
          <span className="font-sans text-sm font-bold text-[var(--ink)]">
            Designate as Default Storage Provider
          </span>
        </label>

        <label className="flex items-center gap-2.5 cursor-pointer">
          <ChunkyCheckbox
            checked={isEnabled}
            onCheckedChange={(c) => setIsEnabled(c)}
            data-testid="provider-enabled-toggle"
            aria-label="Enable provider for uploads and ingests"
          />
          <span className="font-sans text-sm font-bold text-[var(--ink)]">
            Enable Provider for Uploads & Ingests
          </span>
        </label>
      </div>

      {/* Test Connection Feedback */}
      {testResult && (
        <ChunkyCard
          data-testid="connection-test-result"
          className={`p-3.5 flex items-start gap-3 ${
            testResult.success
              ? 'border-[var(--green-dark)] bg-[var(--green-soft)]'
              : 'border-[var(--red-dark)] bg-[var(--red)]/10'
          }`}
        >
          <span
            className={`w-11 h-11 rounded-2xl border-2 border-b-4 flex items-center justify-center shrink-0 ${
              testResult.success
                ? 'border-[var(--green-dark)] bg-[var(--green)] text-white'
                : 'border-[var(--red-dark)] bg-[var(--red)] text-white'
            }`}
          >
            {testResult.success ? (
              <CheckCircle2 className="w-5 h-5" />
            ) : (
              <AlertCircle className="w-5 h-5" />
            )}
          </span>
          <div>
            <div className="font-display font-bold text-sm text-[var(--ink)]">
              {testResult.success
                ? 'Connection Successful'
                : 'Connection Failed'}
            </div>
            <div className="font-sans text-xs font-semibold text-[var(--muted)] mt-0.5">
              {testResult.message}
            </div>
          </div>
        </ChunkyCard>
      )}

      {/* Form Action Buttons */}
      <div className="flex items-center justify-between pt-3 border-t-2 border-[var(--border)] gap-2 flex-wrap">
        <ChunkyButton
          type="button"
          variant="outline"
          size="sm"
          onClick={handleTestConnection}
          disabled={isTesting || (!endpoint && !initialProvider?.endpoint)}
          data-testid="test-connection-btn"
        >
          {isTesting ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Testing...
            </>
          ) : (
            'Test Connection'
          )}
        </ChunkyButton>

        <div className="flex items-center gap-2">
          <ChunkyButton
            type="button"
            variant="outline"
            size="sm"
            onClick={onCancel}
            disabled={isSaving}
          >
            Cancel
          </ChunkyButton>
          <ChunkyButton
            type="submit"
            size="sm"
            disabled={isSaving}
            data-testid="save-provider-btn"
          >
            {isSaving
              ? 'Saving...'
              : isEditing
                ? 'Update Provider'
                : 'Create Provider'}
          </ChunkyButton>
        </div>
      </div>
    </form>
  );
}
