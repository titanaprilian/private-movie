import { Activity, Check, Copy, Edit2, Play, Trash2 } from 'lucide-react';
import { ChunkyButton } from '@/components/ui/chunky-button';
import { ChunkyCard } from '@/components/ui/chunky-card';
import { useSourceHealthProbe } from '../../hooks/useSourceHealthProbe';
import type { SourceTableRowProps } from '../../types';
import { SourceHealthBadge } from './SourceHealthBadge';
import { SourceInlineEditForm } from './SourceInlineEditForm';
import { SourceTypeBadge } from './SourceTypeBadge';

export function SourceTableRow({
  source,
  isEditing,
  isDeleting,
  copied,
  isSavingEdit,
  isDeletePending,
  onStartEdit,
  onCancelEdit,
  onSaveEdit,
  onRequestDelete,
  onConfirmDelete,
  onCancelDelete,
  onPreview,
  onCopy,
}: SourceTableRowProps) {
  const { healthResult, isTesting, healthStatus, handleTestProbe } = useSourceHealthProbe({
    source,
  });

  if (isEditing) {
    return (
      <SourceInlineEditForm
        source={source}
        isPending={isSavingEdit}
        onCancel={onCancelEdit}
        onSave={onSaveEdit}
      />
    );
  }

  if (isDeleting) {
    return (
      <ChunkyCard className="p-4 border-[var(--red)] bg-[var(--red)]/5 text-xs flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="font-extrabold text-[var(--red)]">Remove "{source.label}"?</p>
          <p className="font-mono text-[11px] text-[var(--muted)] truncate">{source.url}</p>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <ChunkyButton
            type="button"
            variant="outline"
            size="sm"
            onClick={onCancelDelete}
            disabled={isDeletePending}
          >
            Cancel
          </ChunkyButton>
          <ChunkyButton
            type="button"
            variant="danger"
            size="sm"
            onClick={onConfirmDelete}
            disabled={isDeletePending}
          >
            {isDeletePending ? 'Removing...' : 'Delete'}
          </ChunkyButton>
        </div>
      </ChunkyCard>
    );
  }

  return (
    <ChunkyCard className="p-3 space-y-2">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 min-w-0 flex-wrap">
          <SourceTypeBadge type={source.type} />
          {source.quality && (
            <span className="rounded-xl border-2 border-[var(--border)] bg-[var(--bg)] px-2 py-0.5 font-mono text-[11px] font-extrabold text-[var(--muted)]">
              {source.quality}
            </span>
          )}
          <span className="font-extrabold text-[var(--ink)] truncate text-xs">{source.label}</span>
        </div>
        <div className="shrink-0 flex items-center gap-1">
          <SourceHealthBadge
            status={healthStatus}
            title={
              healthStatus === 'working' && healthResult?.latencyMs
                ? `Status 200 OK (${healthResult.latencyMs}ms)`
                : healthStatus === 'broken'
                  ? healthResult?.error || 'Source probe failed or returned 404'
                  : undefined
            }
          />
        </div>
      </div>

      <div className="flex items-center justify-between gap-2 rounded-2xl border-2 border-[var(--border)] bg-[var(--bg)] px-3 py-1.5">
        <span
          className="font-mono text-[11px] font-bold text-[var(--muted)] truncate select-all flex-1 min-w-0"
          title={source.url}
        >
          {source.url}
        </span>
        <ChunkyButton
          type="button"
          variant="outline"
          size="sm"
          onClick={onCopy}
          className="h-7 w-7 shrink-0 px-0"
          title={copied ? 'Copied to clipboard' : 'Copy URL'}
          aria-label={copied ? 'Copied' : `Copy URL for ${source.label}`}
        >
          {copied ? (
            <Check className="text-[var(--green)]" aria-hidden="true" />
          ) : (
            <Copy aria-hidden="true" />
          )}
        </ChunkyButton>
      </div>

      <div className="flex items-center justify-between gap-1 pt-2 border-t-2 border-[var(--border)]">
        <div className="flex items-center gap-1.5">
          <ChunkyButton
            type="button"
            variant="blue"
            size="sm"
            onClick={onPreview}
            title="Preview stream playback in modal"
          >
            <Play aria-hidden="true" />
            Preview
          </ChunkyButton>
          <ChunkyButton
            type="button"
            variant="outline"
            size="sm"
            onClick={handleTestProbe}
            disabled={isTesting}
            title="Run on-demand health probe"
          >
            <Activity aria-hidden="true" />
            {isTesting ? 'Probing...' : 'Test'}
          </ChunkyButton>
        </div>
        <div className="flex items-center gap-1.5">
          <ChunkyButton
            type="button"
            variant="outline"
            size="sm"
            onClick={onStartEdit}
            className="px-2.5"
            title="Edit source details"
            aria-label={`Edit ${source.label}`}
          >
            <Edit2 aria-hidden="true" />
          </ChunkyButton>
          <ChunkyButton
            type="button"
            variant="danger"
            size="sm"
            onClick={onRequestDelete}
            className="px-2.5"
            title="Remove source"
            aria-label={`Delete ${source.label}`}
          >
            <Trash2 aria-hidden="true" />
          </ChunkyButton>
        </div>
      </div>
    </ChunkyCard>
  );
}
