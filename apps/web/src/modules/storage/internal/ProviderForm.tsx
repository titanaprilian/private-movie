import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
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
  onSave: (data: CreateStorageProviderRequest | UpdateStorageProviderRequest) => Promise<void>;
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
  const [publicBaseUrl, setPublicBaseUrl] = useState(initialProvider?.publicBaseUrl || '');
  const [forcePathStyle, setForcePathStyle] = useState(initialProvider?.forcePathStyle || false);
  const [storageLimitGb, setStorageLimitGb] = useState<number>(
    initialProvider?.storageLimitGb ?? 50
  );
  const [isDefault, setIsDefault] = useState(initialProvider?.isDefault || false);
  const [isEnabled, setIsEnabled] = useState(initialProvider?.isEnabled ?? true);

  // Test connection state
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<{
    success: boolean;
    message?: string;
  } | null>(null);

  // Set default values when preset changes (only when creating or explicitly changed)
  const handlePresetChange = (newType: StorageProviderType) => {
    setProviderType(newType);
    const preset = PROVIDER_PRESETS[newType];
    if (!name || Object.values(PROVIDER_PRESETS).some((p) => p.name === name)) {
      setName(preset.name);
    }
    if (!endpoint || Object.values(PROVIDER_PRESETS).some((p) => p.endpoint === endpoint)) {
      setEndpoint(preset.endpoint);
    }
    if (!region || Object.values(PROVIDER_PRESETS).some((p) => p.region === region)) {
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
          description: res.message || 'Check endpoint, credentials, and bucket name.',
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
      toast.error('Access Key ID and Secret Access Key are required for new providers');
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
    <form onSubmit={handleSubmit} className="space-y-4 text-xs" data-testid="provider-form">
      {/* Preset Selector */}
      <div className="space-y-1">
        <Label htmlFor="provider-preset" className="text-[11px] font-medium text-fg">
          Provider Preset
        </Label>
        <select
          id="provider-preset"
          data-testid="provider-preset-select"
          value={providerType}
          onChange={(e) => handlePresetChange(e.target.value as StorageProviderType)}
          className="w-full h-8 px-2 rounded border border-c bg-card text-xs mono focus:outline-none focus:border-primary"
        >
          <option value="backblaze">Backblaze B2</option>
          <option value="cloudflare_r2">Cloudflare R2</option>
          <option value="aws_s3">AWS S3</option>
          <option value="wasabi">Wasabi</option>
          <option value="minio">MinIO</option>
          <option value="custom">Custom S3</option>
        </select>
      </div>

      {/* Provider Name */}
      <div className="space-y-1">
        <Label htmlFor="provider-name" className="text-[11px] font-medium text-fg">
          Friendly Name *
        </Label>
        <Input
          id="provider-name"
          data-testid="provider-name-input"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Backblaze B2 Main"
          className="h-8 text-xs"
          required
        />
      </div>

      {/* Endpoint & Region */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <div className="space-y-1">
          <Label htmlFor="provider-endpoint" className="text-[11px] font-medium text-fg">
            Endpoint URL *
          </Label>
          <Input
            id="provider-endpoint"
            data-testid="provider-endpoint-input"
            value={endpoint}
            onChange={(e) => setEndpoint(e.target.value)}
            placeholder="https://s3.us-west-002.backblazeb2.com"
            className="h-8 text-xs mono"
            required
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="provider-region" className="text-[11px] font-medium text-fg">
            Region *
          </Label>
          <Input
            id="provider-region"
            data-testid="provider-region-input"
            value={region}
            onChange={(e) => setRegion(e.target.value)}
            placeholder="us-west-002"
            className="h-8 text-xs mono"
            required
          />
        </div>
      </div>

      {/* Bucket & Quota */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <div className="space-y-1">
          <Label htmlFor="provider-bucket" className="text-[11px] font-medium text-fg">
            Bucket Name *
          </Label>
          <Input
            id="provider-bucket"
            data-testid="provider-bucket-input"
            value={bucket}
            onChange={(e) => setBucket(e.target.value)}
            placeholder="my-media-bucket"
            className="h-8 text-xs mono"
            required
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="provider-quota" className="text-[11px] font-medium text-fg">
            Quota Limit (GB)
          </Label>
          <Input
            id="provider-quota"
            data-testid="provider-quota-input"
            type="number"
            min={1}
            value={storageLimitGb}
            onChange={(e) => setStorageLimitGb(Number(e.target.value))}
            className="h-8 text-xs mono"
          />
        </div>
      </div>

      {/* Public CDN Base URL */}
      <div className="space-y-1">
        <Label htmlFor="provider-cdn" className="text-[11px] font-medium text-fg">
          Public CDN / Streaming Domain (optional)
        </Label>
        <Input
          id="provider-cdn"
          data-testid="provider-cdn-input"
          value={publicBaseUrl}
          onChange={(e) => setPublicBaseUrl(e.target.value)}
          placeholder="https://cdn.example.com"
          className="h-8 text-xs mono"
        />
        <p className="text-[10px] text-muted">
          If set, videos from this provider stream directly through this CDN base URL.
        </p>
      </div>

      {/* Credentials */}
      <div className="space-y-2 p-3 border border-c rounded bg-sidebar/50">
        <div className="text-[11px] font-semibold text-fg">Authentication Credentials</div>
        <div className="space-y-1">
          <Label htmlFor="provider-key" className="text-[10px] text-muted">
            Access Key ID {isEditing ? `(current: ${initialProvider?.accessKeyIdMasked})` : '*'}
          </Label>
          <Input
            id="provider-key"
            data-testid="provider-access-key-input"
            value={accessKeyId}
            onChange={(e) => setAccessKeyId(e.target.value)}
            placeholder={isEditing ? 'Leave blank to keep unchanged' : 'AKIA...'}
            className="h-8 text-xs mono"
            required={!isEditing}
          />
        </div>

        <div className="space-y-1">
          <Label htmlFor="provider-secret" className="text-[10px] text-muted">
            Secret Access Key {isEditing ? '(hidden / encrypted)' : '*'}
          </Label>
          <Input
            id="provider-secret"
            data-testid="provider-secret-key-input"
            type="password"
            value={secretAccessKey}
            onChange={(e) => setSecretAccessKey(e.target.value)}
            placeholder={isEditing ? 'Leave blank to keep unchanged' : '••••••••'}
            className="h-8 text-xs mono"
            required={!isEditing}
          />
        </div>
      </div>

      {/* Toggles */}
      <div className="space-y-2 pt-1">
        <label className="flex items-center gap-2 cursor-pointer">
          <Checkbox
            checked={forcePathStyle}
            onCheckedChange={(c) => setForcePathStyle(Boolean(c))}
            data-testid="provider-path-style-toggle"
          />
          <span className="text-xs text-fg">Force Path-Style Addressing (required for MinIO/Local S3)</span>
        </label>

        <label className="flex items-center gap-2 cursor-pointer">
          <Checkbox
            checked={isDefault}
            onCheckedChange={(c) => setIsDefault(Boolean(c))}
            data-testid="provider-default-toggle"
          />
          <span className="text-xs text-fg">Designate as Default Storage Provider</span>
        </label>

        <label className="flex items-center gap-2 cursor-pointer">
          <Checkbox
            checked={isEnabled}
            onCheckedChange={(c) => setIsEnabled(Boolean(c))}
            data-testid="provider-enabled-toggle"
          />
          <span className="text-xs text-fg">Enable Provider for Uploads & Ingests</span>
        </label>
      </div>

      {/* Test Connection Feedback */}
      {testResult && (
        <div
          data-testid="connection-test-result"
          className={`p-2.5 rounded border text-xs flex items-start gap-2 ${
            testResult.success
              ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300 border-green-200 dark:border-green-800'
              : 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300 border-red-200 dark:border-red-800'
          }`}
        >
          {testResult.success ? (
            <CheckCircle2 className="w-4 h-4 text-green-600 dark:text-green-400 shrink-0 mt-0.5" />
          ) : (
            <AlertCircle className="w-4 h-4 text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
          )}
          <div>
            <div className="font-semibold">
              {testResult.success ? 'Connection Successful' : 'Connection Failed'}
            </div>
            <div className="text-[11px] mt-0.5">{testResult.message}</div>
          </div>
        </div>
      )}

      {/* Form Action Buttons */}
      <div className="flex items-center justify-between pt-2 border-t border-c gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={handleTestConnection}
          disabled={isTesting || (!endpoint && !initialProvider?.endpoint)}
          data-testid="test-connection-btn"
          className="text-xs h-8"
        >
          {isTesting ? (
            <>
              <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" />
              Testing...
            </>
          ) : (
            'Test Connection'
          )}
        </Button>

        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={onCancel}
            disabled={isSaving}
            className="text-xs h-8"
          >
            Cancel
          </Button>
          <Button
            type="submit"
            size="sm"
            disabled={isSaving}
            data-testid="save-provider-btn"
            className="text-xs h-8"
          >
            {isSaving ? 'Saving...' : isEditing ? 'Update Provider' : 'Create Provider'}
          </Button>
        </div>
      </div>
    </form>
  );
}
