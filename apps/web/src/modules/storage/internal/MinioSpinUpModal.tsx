import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { AlertTriangle, Eye, EyeOff, Loader2, Rocket } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  DEFAULT_MINIO_BUCKET,
  deriveMinioEndpoint,
  generateMinioSecret,
  spinMinioUp,
  type MinioSpinUpResponseData,
} from './api';

export interface MinioSpinUpModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  providerCount: number;
  onSuccess?: (data: MinioSpinUpResponseData) => void;
}

const SPIN_UP_STAGES = ['Starting container', 'Verifying health', 'Ready'] as const;

function stageIndex(isPending: boolean, isSuccess: boolean): number {
  if (isSuccess) return 2;
  if (isPending) return 1;
  return 0;
}

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
  const [secretAccessKey, setSecretAccessKey] = useState(() => generateMinioSecret());
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
      queryClient.invalidateQueries({ queryKey: ['storage', 'minio', 'status'] });
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
    <Dialog open={open} onOpenChange={(next) => !mutation.isPending && onOpenChange(next)}>
      <DialogContent data-testid="minio-spinup-modal" className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-sm">
            <Rocket className="w-4 h-4 text-primary" />
            Spin Up Local MinIO
          </DialogTitle>
          <DialogDescription className="text-xs">
            Review the auto-generated settings below, then confirm to provision a local
            MinIO object storage container.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="minio-endpoint" className="text-xs">
              S3 Endpoint
            </Label>
            <Input
              id="minio-endpoint"
              data-testid="minio-endpoint-input"
              value={endpoint}
              onChange={(e) => setEndpoint(e.target.value)}
              disabled={mutation.isPending}
              className="h-8 text-xs mono"
              placeholder="http://localhost:9000"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="minio-bucket" className="text-xs">
              Bucket Name
            </Label>
            <Input
              id="minio-bucket"
              data-testid="minio-bucket-input"
              value={bucket}
              onChange={(e) => setBucket(e.target.value)}
              disabled={mutation.isPending}
              className="h-8 text-xs mono"
              placeholder={DEFAULT_MINIO_BUCKET}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="minio-access-key" className="text-xs">
                Access Key
              </Label>
              <Input
                id="minio-access-key"
                data-testid="minio-access-key-input"
                value={accessKeyId}
                onChange={(e) => setAccessKeyId(e.target.value)}
                disabled={mutation.isPending}
                className="h-8 text-xs mono"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="minio-secret-key" className="text-xs">
                Secret Key
              </Label>
              <div className="relative">
                <Input
                  id="minio-secret-key"
                  data-testid="minio-secret-key-input"
                  value={secretAccessKey}
                  onChange={(e) => setSecretAccessKey(e.target.value)}
                  disabled={mutation.isPending}
                  className="h-8 text-xs mono pr-8"
                  type={showSecretKey ? 'text' : 'password'}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowSecretKey((v) => !v)}
                  disabled={mutation.isPending}
                  data-testid="minio-toggle-secret-visibility-btn"
                  aria-label={showSecretKey ? 'Hide secret key' : 'Show secret key'}
                  className="absolute right-0.5 top-1/2 h-7 w-7 -translate-y-1/2 px-0"
                >
                  {showSecretKey ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                </Button>
              </div>
            </div>
          </div>

          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleRegenerateSecret}
            disabled={mutation.isPending}
            data-testid="minio-regenerate-secret-btn"
            className="h-7 text-[11px] px-2"
          >
            Regenerate secret key
          </Button>

          <label className="flex items-center gap-2 text-xs text-muted cursor-pointer">
            <Checkbox
              checked={isDefault}
              onCheckedChange={(checked) => setIsDefault(checked === true)}
              disabled={mutation.isPending}
              data-testid="minio-default-checkbox"
            />
            Set as default storage provider
          </label>

          {mutation.isPending && (
            <div data-testid="minio-spinup-progress" className="space-y-1.5 rounded border border-c bg-sidebar p-3">
              {SPIN_UP_STAGES.map((stage, i) => (
                <div
                  key={stage}
                  data-testid={`minio-spinup-stage-${i}`}
                  data-active={i <= currentStage}
                  className={`flex items-center gap-2 text-[11px] ${
                    i <= currentStage ? 'text-fg font-medium' : 'text-muted'
                  }`}
                >
                  {i < currentStage || (i === 2 && mutation.isSuccess) ? (
                    <span className="text-green-600">✓</span>
                  ) : i === currentStage ? (
                    <Loader2 className="w-3 h-3 animate-spin" />
                  ) : (
                    <span className="text-muted">○</span>
                  )}
                  {stage}
                  {i === currentStage && i < 2 ? '…' : ''}
                </div>
              ))}
            </div>
          )}

          {errorMessage && (
            <div
              data-testid="minio-spinup-error"
              className="flex items-start gap-2 rounded border border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-950/30 p-3 text-[11px] text-red-800 dark:text-red-300"
            >
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{errorMessage}</span>
            </div>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => onOpenChange(false)}
            disabled={mutation.isPending}
            data-testid="minio-spinup-cancel-btn"
            className="h-8 text-xs"
          >
            Cancel
          </Button>
          <Button
            size="sm"
            onClick={handleSubmit}
            disabled={mutation.isPending}
            data-testid="minio-spinup-submit-btn"
            className="h-8 text-xs gap-1.5"
          >
            {mutation.isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            {mutation.isPending ? 'Provisioning…' : 'Spin Up MinIO'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
