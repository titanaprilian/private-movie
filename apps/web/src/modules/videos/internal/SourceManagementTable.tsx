import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Play,
  Activity,
  Plus,
  Trash2,
  Edit2,
  Copy,
  Check,
  UploadCloud,
  Layers,
  CheckCircle2,
  AlertCircle,
  Loader2,
  X,
} from 'lucide-react';
import { toast } from 'sonner';
import { ChunkyButton } from '@/components/ui/chunky-button';
import { ChunkyCard } from '@/components/ui/chunky-card';
import { ChunkyInput } from '@/components/ui/chunky-input';
import {
  ChunkySelect,
  ChunkySelectContent,
  ChunkySelectItem,
  ChunkySelectTrigger,
  ChunkySelectValue,
} from '@/components/ui/chunky-select';
import {
  type Episode,
  type VideoSource,
  type VideoSourceInput,
  addVideoSource,
  updateVideoSource,
  deleteVideoSource,
  checkVideoSource,
  type CheckVideoSourceResult,
} from './api';
import { VideoPreviewModal } from './VideoPreviewModal';

export interface SourceManagementTableProps {
  episode: Episode;
  onOpenAdvancedIngest?: (tab: 'remote-ingest' | 'upload-s3') => void;
}

const SOURCE_TYPES = [
  { value: 'direct', label: 'Direct' },
  { value: 'embed', label: 'Embed' },
  { value: 's3', label: 'S3 Storage' },
] as const;

export function SourceManagementTable({
  episode,
  onOpenAdvancedIngest,
}: SourceManagementTableProps) {
  const queryClient = useQueryClient();

  // Selected source for preview modal
  const [previewSource, setPreviewSource] = useState<VideoSource | null>(null);

  // Inline Add Form state
  const [isAddingSource, setIsAddingSource] = useState(false);
  const [newType, setNewType] = useState<'direct' | 'embed' | 's3'>('direct');
  const [newLabel, setNewLabel] = useState('');
  const [newUrl, setNewUrl] = useState('');
  const [newQuality, setNewQuality] = useState('');

  // Inline Edit State (sourceId being edited)
  const [editingSourceId, setEditingSourceId] = useState<string | null>(null);
  const [editLabel, setEditLabel] = useState('');
  const [editUrl, setEditUrl] = useState('');
  const [editType, setEditType] = useState<'direct' | 'embed' | 's3'>('direct');
  const [editQuality, setEditQuality] = useState('');

  // Source deletion confirmation modal/row state
  const [deletingSourceId, setDeletingSourceId] = useState<string | null>(null);

  // Copied URL feedback tracker
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Manual probe loading state for individual rows
  const [manualTestingIds, setManualTestingIds] = useState<Record<string, boolean>>({});

  const handleCopyUrl = (id: string, url: string) => {
    navigator.clipboard.writeText(url);
    setCopiedId(id);
    setTimeout(() => {
      setCopiedId((current) => (current === id ? null : current));
    }, 2000);
  };

  // Add source mutation
  const addMutation = useMutation({
    mutationFn: (sourceInput: VideoSourceInput) =>
      addVideoSource(episode.id, sourceInput),
    onSuccess: () => {
      toast.success('Source added successfully');
      queryClient.invalidateQueries({ queryKey: ['series'] });
      queryClient.invalidateQueries({ queryKey: ['episodes'] });
      setIsAddingSource(false);
      setNewLabel('');
      setNewUrl('');
      setNewQuality('');
      setNewType('direct');
    },
    onError: (err: Error) => {
      toast.error(`Failed to add source: ${err.message}`);
    },
  });

  // Edit source mutation
  const editMutation = useMutation({
    mutationFn: ({
      sourceId,
      updates,
    }: {
      sourceId: string;
      updates: { type: 'direct' | 'embed' | 's3'; label: string; url: string; quality?: string | null };
    }) => updateVideoSource(episode.id, sourceId, updates),
    onSuccess: () => {
      toast.success('Source updated');
      queryClient.invalidateQueries({ queryKey: ['series'] });
      queryClient.invalidateQueries({ queryKey: ['episodes'] });
      setEditingSourceId(null);
    },
    onError: (err: Error) => {
      toast.error(`Failed to update source: ${err.message}`);
    },
  });

  // Delete source mutation
  const deleteMutation = useMutation({
    mutationFn: (sourceId: string) => deleteVideoSource(episode.id, sourceId),
    onSuccess: () => {
      toast.success('Source removed');
      queryClient.invalidateQueries({ queryKey: ['series'] });
      queryClient.invalidateQueries({ queryKey: ['episodes'] });
      setDeletingSourceId(null);
    },
    onError: (err: Error) => {
      toast.error(`Failed to delete source: ${err.message}`);
    },
  });

  const startEdit = (source: VideoSource) => {
    setEditingSourceId(source.id);
    setEditLabel(source.label);
    setEditUrl(source.url);
    setEditType(source.type);
    setEditQuality(source.quality ?? '');
  };

  const handleSaveEdit = (sourceId: string) => {
    if (!editUrl.trim() || !editLabel.trim()) {
      toast.error('Label and URL are required');
      return;
    }
    editMutation.mutate({
      sourceId,
      updates: {
        label: editLabel.trim(),
        url: editUrl.trim(),
        type: editType,
        quality: editQuality.trim() || null,
      },
    });
  };

  const handleSaveNewSource = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUrl.trim() || !newLabel.trim()) {
      toast.error('Label and URL are required');
      return;
    }
    addMutation.mutate({
      label: newLabel.trim(),
      url: newUrl.trim(),
      type: newType,
      quality: newQuality.trim() || null,
    });
  };

  const sources = episode.videoSources ?? [];

  return (
    <div className="space-y-3">
      {/* Table Header Section */}
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
              <ChunkyButton
                type="button"
                variant="outline"
                size="sm"
                onClick={() => onOpenAdvancedIngest('remote-ingest')}
                title="Remote Ingest to S3"
              >
                <Layers aria-hidden="true" />
                Ingest
              </ChunkyButton>
              <ChunkyButton
                type="button"
                variant="outline"
                size="sm"
                onClick={() => onOpenAdvancedIngest('upload-s3')}
                title="Upload Video File to S3"
              >
                <UploadCloud aria-hidden="true" />
                Upload
              </ChunkyButton>
            </>
          )}

          {!isAddingSource && (
            <ChunkyButton
              type="button"
              size="sm"
              onClick={() => setIsAddingSource(true)}
            >
              <Plus aria-hidden="true" />
              Add Source
            </ChunkyButton>
          )}
        </div>
      </div>

      {/* Inline Add Source Form */}
      {isAddingSource && (
        <ChunkyCard className="p-4 space-y-3">
          <form onSubmit={handleSaveNewSource} className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-extrabold text-[var(--ink)]">New Video Source</span>
              <ChunkyButton
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setIsAddingSource(false)}
                aria-label="Close add source form"
              >
                <X aria-hidden="true" />
              </ChunkyButton>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1.5">
                <label
                  htmlFor="add-source-type"
                  className="text-xs font-extrabold text-[var(--ink)]"
                >
                  Type
                </label>
                <ChunkySelect
                  value={newType}
                  onValueChange={(val) =>
                    setNewType(val as 'direct' | 'embed' | 's3')
                  }
                >
                  <ChunkySelectTrigger id="add-source-type" aria-label="Type">
                    <ChunkySelectValue placeholder="Select type" />
                  </ChunkySelectTrigger>
                  <ChunkySelectContent>
                    {SOURCE_TYPES.map((t) => (
                      <ChunkySelectItem key={t.value} value={t.value}>
                        {t.label}
                      </ChunkySelectItem>
                    ))}
                  </ChunkySelectContent>
                </ChunkySelect>
              </div>

              <div className="space-y-1.5">
                <label
                  htmlFor="add-source-label"
                  className="text-xs font-extrabold text-[var(--ink)]"
                >
                  Label
                </label>
                <ChunkyInput
                  id="add-source-label"
                  value={newLabel}
                  onChange={(e) => setNewLabel(e.target.value)}
                  placeholder="e.g. Server 1 or 1080p Stream"
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2">
              <div className="col-span-2 space-y-1.5">
                <label
                  htmlFor="add-source-url"
                  className="text-xs font-extrabold text-[var(--ink)]"
                >
                  URL / Embed / Key
                </label>
                <ChunkyInput
                  id="add-source-url"
                  value={newUrl}
                  onChange={(e) => setNewUrl(e.target.value)}
                  placeholder="https://... or S3 key"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <label
                  htmlFor="add-source-quality"
                  className="text-xs font-extrabold text-[var(--ink)]"
                >
                  Quality
                </label>
                <ChunkyInput
                  id="add-source-quality"
                  value={newQuality}
                  onChange={(e) => setNewQuality(e.target.value)}
                  placeholder="1080p, 720p"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-1">
              <ChunkyButton
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setIsAddingSource(false)}
              >
                Cancel
              </ChunkyButton>
              <ChunkyButton
                type="submit"
                size="sm"
                disabled={addMutation.isPending}
              >
                {addMutation.isPending ? 'Saving...' : 'Add Source'}
              </ChunkyButton>
            </div>
          </form>
        </ChunkyCard>
      )}

      {/* Sources List / Empty State */}
      {sources.length === 0 && !isAddingSource ? (
        <ChunkyCard className="p-4 text-center space-y-2 border-dashed">
          <p className="text-xs font-bold text-[var(--muted)]">No video sources configured for this episode.</p>
          <ChunkyButton
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setIsAddingSource(true)}
          >
            <Plus aria-hidden="true" />
            Add First Source
          </ChunkyButton>
        </ChunkyCard>
      ) : (
        <div className="space-y-2">
          {sources.map((source) => (
            <SourceRowItem
              key={source.id}
              source={source}
              isEditing={editingSourceId === source.id}
              editState={{
                label: editLabel,
                url: editUrl,
                type: editType,
                quality: editQuality,
              }}
              onEditStateChange={{
                setLabel: setEditLabel,
                setUrl: setEditUrl,
                setType: setEditType,
                setQuality: setEditQuality,
              }}
              onStartEdit={() => startEdit(source)}
              onCancelEdit={() => setEditingSourceId(null)}
              onSaveEdit={() => handleSaveEdit(source.id)}
              isSavingEdit={editMutation.isPending}
              isDeleting={deletingSourceId === source.id}
              onConfirmDelete={() => deleteMutation.mutate(source.id)}
              onCancelDelete={() => setDeletingSourceId(null)}
              onRequestDelete={() => setDeletingSourceId(source.id)}
              isDeletePending={deleteMutation.isPending}
              onPreview={() => setPreviewSource(source)}
              copied={copiedId === source.id}
              onCopy={() => handleCopyUrl(source.id, source.url)}
              isManualTesting={Boolean(manualTestingIds[source.id])}
              onManualTestStart={() =>
                setManualTestingIds((prev) => ({ ...prev, [source.id]: true }))
              }
              onManualTestEnd={() =>
                setManualTestingIds((prev) => ({ ...prev, [source.id]: false }))
              }
            />
          ))}
        </div>
      )}

      {/* Preview Modal */}
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

interface SourceRowItemProps {
  source: VideoSource;
  isEditing: boolean;
  editState: {
    label: string;
    url: string;
    type: 'direct' | 'embed' | 's3';
    quality: string;
  };
  onEditStateChange: {
    setLabel: (val: string) => void;
    setUrl: (val: string) => void;
    setType: (val: 'direct' | 'embed' | 's3') => void;
    setQuality: (val: string) => void;
  };
  onStartEdit: () => void;
  onCancelEdit: () => void;
  onSaveEdit: () => void;
  isSavingEdit: boolean;
  isDeleting: boolean;
  onConfirmDelete: () => void;
  onCancelDelete: () => void;
  onRequestDelete: () => void;
  isDeletePending: boolean;
  onPreview: () => void;
  copied: boolean;
  onCopy: () => void;
  isManualTesting: boolean;
  onManualTestStart: () => void;
  onManualTestEnd: () => void;
}

function SourceTypeBadge({ type }: { type: VideoSource['type'] }) {
  return (
    <span
      className={`rounded-xl border-2 border-b-4 px-2 py-0.5 font-mono text-[11px] font-extrabold uppercase ${
        type === 's3'
          ? 'border-[var(--purple-dark)] bg-[var(--purple)] text-white'
          : type === 'direct'
            ? 'border-[var(--green-dark)] bg-[var(--green)] text-white'
            : 'border-[var(--blue-dark)] bg-[var(--blue)] text-white'
      }`}
    >
      {type}
    </span>
  );
}

function SourceHealthBadge({
  status,
  title,
}: {
  status: 'working' | 'broken' | 'testing' | 'unknown';
  title?: string;
}) {
  if (status === 'testing') {
    return (
      <span
        className="inline-flex items-center gap-1 rounded-xl border-2 border-[var(--border)] bg-[var(--bg)] px-2 py-0.5 font-mono text-[11px] font-extrabold text-[var(--muted)]"
        title={title ?? 'Testing source health...'}
      >
        <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" />
        Testing
      </span>
    );
  }
  if (status === 'working') {
    return (
      <span
        className="inline-flex items-center gap-1 rounded-xl border-2 border-b-4 border-[var(--green-dark)] bg-[var(--green)] px-2 py-0.5 font-mono text-[11px] font-extrabold text-white"
        title={title ?? 'Working'}
      >
        <CheckCircle2 className="h-3 w-3" aria-hidden="true" />
        Working
      </span>
    );
  }
  if (status === 'broken') {
    return (
      <span
        className="inline-flex items-center gap-1 rounded-xl border-2 border-b-4 border-[var(--red-dark)] bg-[var(--red)] px-2 py-0.5 font-mono text-[11px] font-extrabold text-white"
        title={title ?? 'Source probe failed'}
      >
        <AlertCircle className="h-3 w-3" aria-hidden="true" />
        Broken
      </span>
    );
  }
  return (
    <span
      className="inline-flex items-center gap-1 rounded-xl border-2 border-[var(--border)] bg-[var(--bg)] px-2 py-0.5 font-mono text-[11px] font-extrabold text-[var(--muted)]"
      title={title ?? 'Health check pending or unknown'}
    >
      Unknown
    </span>
  );
}

function SourceRowItem({
  source,
  isEditing,
  editState,
  onEditStateChange,
  onStartEdit,
  onCancelEdit,
  onSaveEdit,
  isSavingEdit,
  isDeleting,
  onConfirmDelete,
  onCancelDelete,
  onRequestDelete,
  isDeletePending,
  onPreview,
  copied,
  onCopy,
  isManualTesting,
  onManualTestStart,
  onManualTestEnd,
}: SourceRowItemProps) {
  const queryClient = useQueryClient();

  // Query health status for this source
  const queryKey = ['source-health', source.url, source.type];
  const {
    data: healthResult,
    isLoading: isHealthLoading,
    refetch: refetchHealth,
  } = useQuery<CheckVideoSourceResult>({
    queryKey,
    queryFn: () => checkVideoSource({ url: source.url, type: source.type }),
    staleTime: 5 * 60 * 1000, // cache for 5 minutes
    retry: 1,
  });

  const handleTestProbe = async () => {
    onManualTestStart();
    try {
      await queryClient.invalidateQueries({ queryKey });
      await refetchHealth();
      toast.info(`Health check finished for "${source.label}"`);
    } catch {
      toast.error('Health probe request failed');
    } finally {
      onManualTestEnd();
    }
  };

  const isTesting = isHealthLoading || isManualTesting;

  // Render inline edit form if active
  if (isEditing) {
    return (
      <ChunkyCard className="p-4 space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-sm font-extrabold text-[var(--ink)]">Edit Source</span>
          <span className="font-mono text-[10px] font-bold text-[var(--muted)]">{source.id}</span>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1.5">
            <label
              htmlFor={`edit-source-type-${source.id}`}
              className="text-xs font-extrabold text-[var(--ink)]"
            >
              Type
            </label>
            <ChunkySelect
              value={editState.type}
              onValueChange={(val) =>
                onEditStateChange.setType(
                  val as 'direct' | 'embed' | 's3'
                )
              }
            >
              <ChunkySelectTrigger id={`edit-source-type-${source.id}`} aria-label="Type">
                <ChunkySelectValue placeholder="Select type" />
              </ChunkySelectTrigger>
              <ChunkySelectContent>
                {SOURCE_TYPES.map((t) => (
                  <ChunkySelectItem key={t.value} value={t.value}>
                    {t.label}
                  </ChunkySelectItem>
                ))}
              </ChunkySelectContent>
            </ChunkySelect>
          </div>

          <div className="space-y-1.5">
            <label
              htmlFor={`edit-source-label-${source.id}`}
              className="text-xs font-extrabold text-[var(--ink)]"
            >
              Label
            </label>
            <ChunkyInput
              id={`edit-source-label-${source.id}`}
              value={editState.label}
              onChange={(e) => onEditStateChange.setLabel(e.target.value)}
              required
            />
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2">
          <div className="col-span-2 space-y-1.5">
            <label
              htmlFor={`edit-source-url-${source.id}`}
              className="text-xs font-extrabold text-[var(--ink)]"
            >
              URL
            </label>
            <ChunkyInput
              id={`edit-source-url-${source.id}`}
              value={editState.url}
              onChange={(e) => onEditStateChange.setUrl(e.target.value)}
              required
            />
          </div>

          <div className="space-y-1.5">
            <label
              htmlFor={`edit-source-quality-${source.id}`}
              className="text-xs font-extrabold text-[var(--ink)]"
            >
              Quality
            </label>
            <ChunkyInput
              id={`edit-source-quality-${source.id}`}
              value={editState.quality}
              onChange={(e) => onEditStateChange.setQuality(e.target.value)}
              placeholder="e.g. 1080p"
            />
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 pt-1">
          <ChunkyButton
            type="button"
            variant="outline"
            size="sm"
            onClick={onCancelEdit}
          >
            Cancel
          </ChunkyButton>
          <ChunkyButton
            type="button"
            size="sm"
            onClick={onSaveEdit}
            disabled={isSavingEdit}
          >
            {isSavingEdit ? 'Saving...' : 'Save'}
          </ChunkyButton>
        </div>
      </ChunkyCard>
    );
  }

  // Render delete confirmation mode if active
  if (isDeleting) {
    return (
      <ChunkyCard className="p-4 border-[var(--red)] bg-[var(--red)]/5 text-xs flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="font-extrabold text-[var(--red)]">
            Remove "{source.label}"?
          </p>
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

  const healthStatus = isTesting
    ? 'testing'
    : healthResult?.status === 'working'
      ? 'working'
      : healthResult?.status === 'broken'
        ? 'broken'
        : 'unknown';

  return (
    <ChunkyCard className="p-3 space-y-2">
      {/* Top Row: Provider/Type Badge, Quality, Health Badge */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 min-w-0 flex-wrap">
          <SourceTypeBadge type={source.type} />

          {source.quality && (
            <span className="rounded-xl border-2 border-[var(--border)] bg-[var(--bg)] px-2 py-0.5 font-mono text-[11px] font-extrabold text-[var(--muted)]">
              {source.quality}
            </span>
          )}

          <span className="font-extrabold text-[var(--ink)] truncate text-xs">
            {source.label}
          </span>
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

      {/* URL / Key Row with Copy Option */}
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

      {/* Actions Strip: Preview, Test, Edit, Delete */}
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
