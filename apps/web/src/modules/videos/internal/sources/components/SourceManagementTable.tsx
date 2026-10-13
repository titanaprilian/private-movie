import { useState } from 'react';
import { Layers, Plus, UploadCloud } from 'lucide-react';
import { ChunkyButton } from '@/components/ui/chunky-button';
import { ChunkyCard } from '@/components/ui/chunky-card';
import type { VideoSource } from '../../api';
import { useSourceMutations } from '../hooks/useSourceMutations';
import { SourceAddForm } from './table/SourceAddForm';
import { SourceTableRow } from './table/SourceTableRow';
import type { SourceManagementTableProps, SourceMutationValues } from '../types';
import { VideoPreviewModal } from './VideoPreviewModal';

export type { SourceManagementTableProps };

export function SourceManagementTable({ episode, onOpenAdvancedIngest }: SourceManagementTableProps) {
  const { addMutation, editMutation, deleteMutation } = useSourceMutations({
    episodeId: episode.id,
  });
  const [previewSource, setPreviewSource] = useState<VideoSource | null>(null);
  const [isAddingSource, setIsAddingSource] = useState(false);
  const [editingSourceId, setEditingSourceId] = useState<string | null>(null);
  const [deletingSourceId, setDeletingSourceId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const handleCopyUrl = (id: string, url: string) => {
    navigator.clipboard.writeText(url);
    setCopiedId(id);
    setTimeout(() => setCopiedId((c) => (c === id ? null : c)), 2000);
  };

  const handleAdd = (values: SourceMutationValues) => {
    addMutation.mutate(values, { onSuccess: () => {
      setIsAddingSource(false);
      setEditingSourceId(null);
    } });
  };

  const sources = episode.videoSources ?? [];

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2 border-b-2 border-[var(--border)] pb-2">
        <div className="flex items-center gap-2">
          <span className="text-xs font-extrabold uppercase tracking-wider text-[var(--muted)]">
            Video Sources
          </span>
          <span className="rounded-xl border-2 border-[var(--border)] bg-[var(--bg)] px-2 py-0.5 font-mono text-[11px] font-extrabold text-[var(--muted)]">
            {sources.length}
          </span>
        </div>
        <div className="flex items-center gap-1.5 flex-wrap justify-end">
          {onOpenAdvancedIngest && (
            <>
              <ChunkyButton type="button" variant="outline" size="sm" onClick={() => onOpenAdvancedIngest('remote-ingest')} title="Remote Ingest to S3">
                <Layers aria-hidden="true" />
                Ingest
              </ChunkyButton>
              <ChunkyButton type="button" variant="outline" size="sm" onClick={() => onOpenAdvancedIngest('upload-s3')} title="Upload Video File to S3">
                <UploadCloud aria-hidden="true" />
                Upload
              </ChunkyButton>
            </>
          )}
          {!isAddingSource && (
            <ChunkyButton type="button" size="sm" onClick={() => setIsAddingSource(true)}>
              <Plus aria-hidden="true" />
              Add Source
            </ChunkyButton>
          )}
        </div>
      </div>

      {isAddingSource && (
        <SourceAddForm
          isPending={addMutation.isPending}
          onCancel={() => setIsAddingSource(false)}
          onSave={handleAdd}
        />
      )}

      {sources.length === 0 && !isAddingSource ? (
        <ChunkyCard className="p-4 text-center space-y-2 border-dashed">
          <p className="text-xs font-bold text-[var(--muted)]">No video sources configured for this episode.</p>
          <ChunkyButton type="button" variant="outline" size="sm" onClick={() => setIsAddingSource(true)}>
            <Plus aria-hidden="true" />
            Add First Source
          </ChunkyButton>
        </ChunkyCard>
      ) : (
        <div className="space-y-2">
          {sources.map((source) => (
            <SourceTableRow
              key={source.id}
              source={source}
              isEditing={editingSourceId === source.id}
              isDeleting={deletingSourceId === source.id}
              copied={copiedId === source.id}
              isSavingEdit={editMutation.isPending}
              isDeletePending={deleteMutation.isPending}
              onStartEdit={() => setEditingSourceId(source.id)}
              onCancelEdit={() => setEditingSourceId(null)}
              onSaveEdit={(values) =>
                editMutation.mutate({ sourceId: source.id, updates: values }, {
                  onSuccess: () => setEditingSourceId(null),
                })
              }
              onRequestDelete={() => setDeletingSourceId(source.id)}
              onConfirmDelete={() =>
                deleteMutation.mutate(source.id, {
                  onSuccess: () => setDeletingSourceId(null),
                })
              }
              onCancelDelete={() => setDeletingSourceId(null)}
              onPreview={() => setPreviewSource(source)}
              onCopy={() => handleCopyUrl(source.id, source.url)}
            />
          ))}
        </div>
      )}

      <VideoPreviewModal
        open={Boolean(previewSource)}
        onOpenChange={(open) => {
          if (!open) setPreviewSource(null);
        }}
        source={previewSource}
        episodeTitle={episode.title}
      />
    </div>
  );
}
