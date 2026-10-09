import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { AlertTriangle, Eye, EyeOff, Loader2, Rocket } from 'lucide-react';
import { ChunkyButton } from '@/components/ui/chunky-button';
import { ChunkyInput } from '@/components/ui/chunky-input';
import { ChunkyCheckbox } from '@/components/ui/chunky-checkbox';
import { ChunkyCard } from '@/components/ui/chunky-card';
import {
  ChunkyDialog,
  ChunkyDialogContent,
  ChunkyDialogDescription,
  ChunkyDialogFooter,
  ChunkyDialogHeader,
  ChunkyDialogTitle,
  ChunkyDialogBody,
} from '@/components/ui/chunky-dialog';
import {
  DEFAULT_MINIO_BUCKET,
  deriveMinioEndpoint,
  generateMinioSecret,
  spinMinioUp,
  type MinioSpinUpResponseData,
} from '../../api';

export interface MinioSpinUpModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  providerCount: number;
  onSuccess?: (data: MinioSpinUpResponseData) => void;
}

const SPIN_UP_STAGES = [
  'Starting container',
  'Verifying health',
  'Ready',
] as const;

function stageIndex(isPending: boolean, isSuccess: boolean): number {
  if (isSuccess) return 2;
  if (isPending) return 1;
  return 0;
}

const labelClassName =
  'font-sans text-[11px] font-extrabold uppercase tracking-wider text-[var(--ink)]';

export function MinioSpinUpModal({
  open,
  onOpenChange,
  providerCount,
  onSuccess,
}: MinioSpinUpModalProps) {
  const queryClient = useQueryClient();
  const [endpoint, setEndpoint] = useState(() => deriveMinioEndpoint());
  const [bucket, setBucket] = useState(DEFAULT_MINIO_BUCKET);
  const [accessKeyId, setAccessKeyId] = useState('minioadmin');
  const [secretAccessKey, setSecretAccessKey] = useState(() =>
    generateMinioSecret()
  );
  const [showSecretKey, setShowSecretKey] = useState(false);
  const [isDefault, setIsDefault] = useState(providerCount === 0);

  // Refresh editable defaults each time the modal opens
  useEffect(() => {
    if (open) {
      setEndpoint(deriveMinioEndpoint());
      setSecretAccessKey(generateMinioSecret());
      setBucket(DEFAULT_MINIO_BUCKET);
      setIsDefault(providerCount === 0);
      setShowSecretKey(false);
    }
  }, [open, providerCount]);

  const mutation = useMutation({
    mutationFn: spinMinioUp,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['storage', 'metrics'] });
      queryClient.invalidateQueries({ queryKey: ['storage', 'providers'] });
      queryClient.invalidateQueries({ queryKey: ['storage', 'resources'] });
      queryClient.invalidateQueries({
        queryKey: ['storage', 'minio', 'status'],
      });
      toast.success(`MinIO is ready — console: ${data.consoleUrl}`);
      onOpenChange(false);
      onSuccess?.(data);
    },
  });

  const errorMessage = useMemo(() => {
    if (!mutation.error) return null;
    return mutation.error instanceof Error
      ? mutation.error.message
      : 'Failed to spin up MinIO';
  }, [mutation.error]);

  const currentStage = stageIndex(mutation.isPending, mutation.isSuccess);

  const handleRegenerateSecret = () => {
    setSecretAccessKey(generateMinioSecret());
  };

  const handleSubmit = () => {
    mutation.mutate({
      endpoint: endpoint.trim() || undefined,
      bucket: bucket.trim() || undefined,
      accessKeyId: accessKeyId.trim() || undefined,
      secretAccessKey: secretAccessKey.trim() || undefined,
      isDefault,
    });
  };

  return (
    <ChunkyDialog
      open={open}
      onOpenChange={(next) => !mutation.isPending && onOpenChange(next)}
    >
      <ChunkyDialogContent
        data-testid="minio-spinup-modal"
        aria-label="Spin up local MinIO"
      >
        <ChunkyDialogHeader>
          <span className="flex items-center gap-2.5">
            <span className="w-11 h-11 rounded-2xl border-2 border-b-4 border-[var(--blue-dark)] bg-[var(--blue-soft)] text-[var(--blue)] flex items-center justify-center shrink-0">
              <Rocket className="w-5 h-5" />
            </span>
            <span>
              <ChunkyDialogTitle>Spin Up Local MinIO</ChunkyDialogTitle>
              <ChunkyDialogDescription>
                Review the auto-generated settings below, then confirm to
                provision a local MinIO object storage container.
              </ChunkyDialogDescription>
            </span>
          </span>
        </ChunkyDialogHeader>

        <ChunkyDialogBody className="space-y-3">
          <div className="space-y-1.5">
            <label htmlFor="minio-endpoint" className={labelClassName}>
              S3 Endpoint
            </label>
            <ChunkyInput
              id="minio-endpoint"
              data-testid="minio-endpoint-input"
              value={endpoint}
              onChange={(e) => setEndpoint(e.target.value)}
              disabled={mutation.isPending}
              className="font-mono"
              placeholder="http://localhost:9000"
            />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="minio-bucket" className={labelClassName}>
              Bucket Name
            </label>
            <ChunkyInput
              id="minio-bucket"
              data-testid="minio-bucket-input"
              value={bucket}
              onChange={(e) => setBucket(e.target.value)}
              disabled={mutation.isPending}
              className="font-mono"
              placeholder={DEFAULT_MINIO_BUCKET}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label htmlFor="minio-access-key" className={labelClassName}>
                Access Key
              </label>
              <ChunkyInput
                id="minio-access-key"
                data-testid="minio-access-key-input"
                value={accessKeyId}
                onChange={(e) => setAccessKeyId(e.target.value)}
                disabled={mutation.isPending}
                className="font-mono"
              />
            </div>
            <div className="space-y-1.5">
              <label htmlFor="minio-secret-key" className={labelClassName}>
                Secret Key
              </label>
              <div className="relative">
                <ChunkyInput
                  id="minio-secret-key"
                  data-testid="minio-secret-key-input"
                  value={secretAccessKey}
                  onChange={(e) => setSecretAccessKey(e.target.value)}
                  disabled={mutation.isPending}
                  className="font-mono pr-12"
                  type={showSecretKey ? 'text' : 'password'}
                />
                <ChunkyButton
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setShowSecretKey((v) => !v)}
                  disabled={mutation.isPending}
                  data-testid="minio-toggle-secret-visibility-btn"
                  aria-label={
                    showSecretKey ? 'Hide secret key' : 'Show secret key'
                  }
                  className="absolute right-1 top-1/2 h-9 w-9 -translate-y-1/2 p-0"
                >
                  {showSecretKey ? (
                    <EyeOff className="w-4 h-4" />
                  ) : (
                    <Eye className="w-4 h-4" />
                  )}
                </ChunkyButton>
              </div>
            </div>
          </div>

          <ChunkyButton
            type="button"
            variant="outline"
            size="sm"
            onClick={handleRegenerateSecret}
            disabled={mutation.isPending}
            data-testid="minio-regenerate-secret-btn"
          >
            Regenerate secret key
          </ChunkyButton>

          <label className="flex items-center gap-2.5 cursor-pointer">
            <ChunkyCheckbox
              checked={isDefault}
              onCheckedChange={(checked) => setIsDefault(checked)}
              disabled={mutation.isPending}
              data-testid="minio-default-checkbox"
              aria-label="Set as default storage provider"
            />
            <span className="font-sans text-xs font-bold text-[var(--muted)]">
              Set as default storage provider
            </span>
          </label>

          {mutation.isPending && (
            <ChunkyCard
              data-testid="minio-spinup-progress"
              className="p-3 space-y-1.5"
            >
              {SPIN_UP_STAGES.map((stage, i) => (
                <div
                  key={stage}
                  data-testid={`minio-spinup-stage-${i}`}
                  data-active={i <= currentStage}
                  className={`flex items-center gap-2 font-sans text-[11px] font-bold ${
                    i <= currentStage
                      ? 'text-[var(--ink)]'
                      : 'text-[var(--muted)]'
                  }`}
                >
                  {i < currentStage || (i === 2 && mutation.isSuccess) ? (
                    <span className="text-[var(--green)]">✓</span>
                  ) : i === currentStage ? (
                    <Loader2 className="w-3 h-3 animate-spin" />
                  ) : (
                    <span>○</span>
                  )}
                  {stage}
                  {i === currentStage && i < 2 ? '…' : ''}
                </div>
              ))}
            </ChunkyCard>
          )}

          {errorMessage && (
            <ChunkyCard
              data-testid="minio-spinup-error"
              className="p-3 flex items-start gap-2.5 border-[var(--red-dark)] bg-[var(--red)]/10"
            >
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-[var(--red)]" />
              <span className="font-sans text-[11px] font-bold text-[var(--red)]">
                {errorMessage}
              </span>
            </ChunkyCard>
          )}
        </ChunkyDialogBody>

        <ChunkyDialogFooter>
          <ChunkyButton
            variant="outline"
            size="sm"
            onClick={() => onOpenChange(false)}
            disabled={mutation.isPending}
            data-testid="minio-spinup-cancel-btn"
          >
            Cancel
          </ChunkyButton>
          <ChunkyButton
            size="sm"
            onClick={handleSubmit}
            disabled={mutation.isPending}
            data-testid="minio-spinup-submit-btn"
          >
            {mutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
            {mutation.isPending ? 'Provisioning…' : 'Spin Up MinIO'}
          </ChunkyButton>
        </ChunkyDialogFooter>
      </ChunkyDialogContent>
    </ChunkyDialog>
  );
}
