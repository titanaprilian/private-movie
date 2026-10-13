import { AlertTriangle } from 'lucide-react';
import { ChunkyButton } from '@/components/ui/chunky-button';
import { ChunkyInput } from '@/components/ui/chunky-input';
import { ChunkySpinner } from '@/components/ui/chunky-spinner';
import {
  ChunkySelect,
  ChunkySelectContent,
  ChunkySelectItem,
  ChunkySelectTrigger,
  ChunkySelectValue,
} from '@/components/ui/chunky-select';
import { useS3Upload } from '../../hooks/useS3Upload';
import type { S3UploadTabProps } from '../../types';

export type { S3UploadTabProps } from '../../types';

export function S3UploadTab({
  episodeId,
  seriesId,
  providers,
  defaultProvider,
  onSuccess,
}: S3UploadTabProps) {
  const {
    selectedFile,
    uploadLabel,
    setUploadLabel,
    uploadQuality,
    setUploadQuality,
    uploadProviderId,
    setUploadProviderId,
    uploadPhase,
    uploadProgress,
    s3Warning,
    isUploading,
    fileInputRef,
    handleFileSelect,
    cancelUpload,
    handleUpload,
  } = useS3Upload({ episodeId, seriesId, defaultProvider, onSuccess });

  return (
    <div className="p-3 border border-c rounded bg-card space-y-3">
      <div className="text-xs font-medium mono text-muted uppercase">Upload Video to S3</div>

      {s3Warning && (
        <div className="p-2.5 rounded border border-amber-200 dark:border-amber-900/50 bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-300 text-xs flex items-start gap-2">
          <AlertTriangle
            className="w-4 h-4 shrink-0 mt-0.5 text-amber-600 dark:text-amber-400"
            aria-hidden="true"
          />
          <div>
            <div className="font-semibold">S3 Storage Unconfigured</div>
            <div className="text-[11px] mt-0.5">{s3Warning}</div>
          </div>
        </div>
      )}

      {/* File Dropzone / Picker */}
      <div>
        <span className="mb-1.5 block font-sans text-xs font-extrabold uppercase tracking-wider text-[var(--muted)]">
          Video File (.mp4, .mkv, .webm)
        </span>
        <input
          type="file"
          ref={fileInputRef}
          accept="video/mp4,video/webm,video/x-matroska,.mp4,.mkv,.webm"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0] || null;
            handleFileSelect(file);
          }}
          disabled={isUploading}
        />
        <div
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            if (isUploading) return;
            const file = e.dataTransfer.files?.[0] || null;
            handleFileSelect(file);
          }}
          onClick={() => {
            if (!isUploading && fileInputRef.current) {
              fileInputRef.current.click();
            }
          }}
          className={`mt-1 border-2 border-dashed border-c rounded p-4 text-center cursor-pointer hover:border-primary transition-colors ${
            isUploading ? 'opacity-50 cursor-not-allowed' : ''
          }`}
        >
          {selectedFile ? (
            <div className="text-xs mono space-y-1">
              <div className="font-semibold text-foreground truncate">{selectedFile.name}</div>
              <div className="text-muted text-[11px]">
                {(selectedFile.size / (1024 * 1024)).toFixed(1)} MB
              </div>
            </div>
          ) : (
            <div className="text-xs text-muted space-y-1">
              <div className="font-medium text-foreground">Click to select or drag video here</div>
              <div className="text-[10px]">Supports MP4, MKV, WebM</div>
            </div>
          )}
        </div>
      </div>

      {/* Form Fields */}
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label
            htmlFor="upload-label"
            className="mb-1.5 block font-sans text-xs font-extrabold uppercase tracking-wider text-[var(--muted)]"
          >
            Label
          </label>
          <ChunkyInput
            id="upload-label"
            placeholder="e.g. S3 High Quality"
            value={uploadLabel}
            onChange={(e) => setUploadLabel(e.target.value)}
            disabled={isUploading}
          />
        </div>
        <div>
          <label
            htmlFor="upload-quality"
            className="mb-1.5 block font-sans text-xs font-extrabold uppercase tracking-wider text-[var(--muted)]"
          >
            Quality
          </label>
          <ChunkyInput
            id="upload-quality"
            placeholder="e.g. 1080p"
            value={uploadQuality}
            onChange={(e) => setUploadQuality(e.target.value)}
            disabled={isUploading}
          />
        </div>
      </div>

      {/* Target S3 Provider Selector for Upload */}
      {providers.length > 0 && (
        <div>
          <label
            htmlFor="upload-provider-select"
            className="mb-1.5 block font-sans text-xs font-extrabold uppercase tracking-wider text-[var(--muted)]"
          >
            Target S3 Storage Provider
          </label>
          <ChunkySelect
            value={uploadProviderId || defaultProvider?.id || ''}
            onValueChange={(val) => setUploadProviderId(val)}
            disabled={isUploading}
          >
            <ChunkySelectTrigger
              id="upload-provider-select"
              data-testid="upload-provider-select"
            >
              <ChunkySelectValue placeholder="Select storage provider" />
            </ChunkySelectTrigger>
            <ChunkySelectContent>
              {providers.map((p) => (
                <ChunkySelectItem key={p.id} value={p.id}>
                  {p.name} {p.isDefault ? '(Default)' : ''}
                </ChunkySelectItem>
              ))}
            </ChunkySelectContent>
          </ChunkySelect>
        </div>
      )}

      {/* Upload Progress Display */}
      {isUploading && (
        <div className="p-2.5 border border-c rounded bg-sidebar space-y-2 text-xs">
          <div className="flex items-center justify-between mono">
            <span className="font-semibold text-foreground flex items-center gap-1.5">
              {uploadPhase === 'cloud' ? (
                <>
                  <ChunkySpinner size="xs" className="h-3 w-3 text-primary" />
                  <span>Uploading to cloud storage...</span>
                </>
              ) : (
                'Uploading...'
              )}
            </span>
            <span className="text-muted text-[11px]">
              {(uploadProgress.loaded / (1024 * 1024)).toFixed(1)} MB /{' '}
              {(uploadProgress.total / (1024 * 1024)).toFixed(1)} MB ({uploadProgress.percent}%)
            </span>
          </div>
          <div className="w-full bg-secondary rounded-full h-2 overflow-hidden">
            <div
              className="bg-primary h-2 transition-all duration-150"
              style={{ width: `${uploadProgress.percent}%` }}
            />
          </div>
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex gap-2">
        {isUploading ? (
          <ChunkyButton
            type="button"
            size="sm"
            variant="danger"
            className="w-full"
            onClick={cancelUpload}
          >
            Cancel
          </ChunkyButton>
        ) : (
          <ChunkyButton
            type="button"
            size="sm"
            variant="primary"
            className="w-full"
            disabled={!selectedFile || !uploadLabel.trim()}
            onClick={handleUpload}
          >
            Upload
          </ChunkyButton>
        )}
      </div>
    </div>
  );
}
