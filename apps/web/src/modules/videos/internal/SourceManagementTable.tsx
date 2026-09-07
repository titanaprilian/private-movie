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
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
    <div className="space-y-3.5">
      {/* Table Header Section */}
      <div className="flex items-center justify-between gap-2 border-b border-c pb-2">
        <div className="flex items-center gap-2">
          <span className="font-medium mono text-[11px] uppercase tracking-wider text-muted">
            Video Sources
          </span>
          <span className="text-[10px] mono px-1.5 py-0.5 rounded border border-c bg-sidebar text-muted">
            {sources.length}
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          {onOpenAdvancedIngest && (
            <>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => onOpenAdvancedIngest('remote-ingest')}
                className="h-7 px-2 text-[11px] mono border-c hover-bg text-muted hover:text-fg"
                title="Remote Ingest to S3"
              >
                <Layers className="h-3 w-3 mr-1" />
                Ingest
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => onOpenAdvancedIngest('upload-s3')}
                className="h-7 px-2 text-[11px] mono border-c hover-bg text-muted hover:text-fg"
                title="Upload Video File to S3"
              >
                <UploadCloud className="h-3 w-3 mr-1" />
                Upload
              </Button>
            </>
          )}

          {!isAddingSource && (
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => setIsAddingSource(true)}
              className="h-7 px-2 text-[11px] font-medium"
            >
              <Plus className="h-3 w-3 mr-1" />
              Add Source
            </Button>
          )}
        </div>
      </div>

      {/* Inline Add Source Form */}
      {isAddingSource && (
        <form
          onSubmit={handleSaveNewSource}
          className="p-3 border border-primary/30 rounded bg-card/60 space-y-3 animate-in fade-in duration-150"
        >
          <div className="flex items-center justify-between text-xs font-semibold">
            <span>New Video Source</span>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setIsAddingSource(false)}
              className="h-6 w-6 p-0 text-muted hover:text-fg"
            >
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>

          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="space-y-1">
              <Label className="text-[10px] text-muted">Type</Label>
              <select
                value={newType}
                onChange={(e) =>
                  setNewType(e.target.value as 'direct' | 'embed' | 's3')
                }
                className="w-full h-7 px-2 rounded border border-c bg-card text-xs mono focus:outline-none focus:border-primary"
              >
                <option value="direct">Direct</option>
                <option value="embed">Embed</option>
                <option value="s3">S3 Storage</option>
              </select>
            </div>

            <div className="space-y-1">
              <Label className="text-[10px] text-muted">Label</Label>
              <Input
                value={newLabel}
                onChange={(e) => setNewLabel(e.target.value)}
                placeholder="e.g. Server 1 or 1080p Stream"
                className="h-7 text-xs"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2 text-xs">
            <div className="col-span-2 space-y-1">
              <Label className="text-[10px] text-muted">URL / Embed / Key</Label>
              <Input
                value={newUrl}
                onChange={(e) => setNewUrl(e.target.value)}
                placeholder="https://... or S3 key"
                className="h-7 text-xs mono"
                required
              />
            </div>

            <div className="space-y-1">
              <Label className="text-[10px] text-muted">Quality</Label>
              <Input
                value={newQuality}
                onChange={(e) => setNewQuality(e.target.value)}
                placeholder="1080p, 720p"
                className="h-7 text-xs mono"
              />
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 pt-1">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setIsAddingSource(false)}
              className="h-7 text-xs"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={addMutation.isPending}
              className="h-7 text-xs"
            >
              {addMutation.isPending ? 'Saving...' : 'Add Source'}
            </Button>
          </div>
        </form>
      )}

      {/* Sources List / Empty State */}
      {sources.length === 0 && !isAddingSource ? (
        <div className="p-4 rounded border border-dashed border-c text-center text-muted space-y-2">
          <p className="text-xs">No video sources configured for this episode.</p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setIsAddingSource(true)}
            className="h-7 text-xs"
          >
            <Plus className="h-3 w-3 mr-1" />
            Add First Source
          </Button>
        </div>
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
      <div className="p-3 border border-primary/40 rounded bg-card space-y-2 text-xs animate-in fade-in duration-100">
        <div className="flex items-center justify-between">
          <span className="font-semibold text-xs text-fg">Edit Source</span>
          <span className="mono text-[10px] text-muted">{source.id}</span>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1">
            <Label className="text-[10px] text-muted">Type</Label>
            <select
              value={editState.type}
              onChange={(e) =>
                onEditStateChange.setType(
                  e.target.value as 'direct' | 'embed' | 's3'
                )
              }
              className="w-full h-7 px-2 rounded border border-c bg-card text-xs mono focus:outline-none focus:border-primary"
            >
              <option value="direct">Direct</option>
              <option value="embed">Embed</option>
              <option value="s3">S3 Storage</option>
            </select>
          </div>

          <div className="space-y-1">
            <Label className="text-[10px] text-muted">Label</Label>
            <Input
              value={editState.label}
              onChange={(e) => onEditStateChange.setLabel(e.target.value)}
              className="h-7 text-xs"
              required
            />
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2">
          <div className="col-span-2 space-y-1">
            <Label className="text-[10px] text-muted">URL</Label>
            <Input
              value={editState.url}
              onChange={(e) => onEditStateChange.setUrl(e.target.value)}
              className="h-7 text-xs mono"
              required
            />
          </div>

          <div className="space-y-1">
            <Label className="text-[10px] text-muted">Quality</Label>
            <Input
              value={editState.quality}
              onChange={(e) => onEditStateChange.setQuality(e.target.value)}
              placeholder="e.g. 1080p"
              className="h-7 text-xs mono"
            />
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 pt-1">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onCancelEdit}
            className="h-7 text-xs"
          >
            Cancel
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={onSaveEdit}
            disabled={isSavingEdit}
            className="h-7 text-xs"
          >
            {isSavingEdit ? 'Saving...' : 'Save'}
          </Button>
        </div>
      </div>
    );
  }

  // Render delete confirmation mode if active
  if (isDeleting) {
    return (
      <div className="p-3 border border-red-500/40 rounded bg-red-500/5 text-xs flex items-center justify-between gap-3 animate-in fade-in duration-100">
        <div className="min-w-0">
          <p className="font-medium text-red-600 dark:text-red-400">
            Remove "{source.label}"?
          </p>
          <p className="text-[11px] mono text-muted truncate">{source.url}</p>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onCancelDelete}
            disabled={isDeletePending}
            className="h-7 px-2 text-xs"
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="destructive"
            size="sm"
            onClick={onConfirmDelete}
            disabled={isDeletePending}
            className="h-7 px-2 text-xs"
          >
            {isDeletePending ? 'Removing...' : 'Delete'}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-2.5 rounded border border-c bg-card hover:border-c-hover transition-colors space-y-2 text-xs">
      {/* Top Row: Provider/Type Pill, Quality, Health Badge, Actions */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 min-w-0 flex-wrap">
          {/* Provider / Type pill */}
          <span
            className={`text-[10px] mono uppercase font-medium px-1.5 py-0.5 rounded border ${
              source.type === 's3'
                ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400 border-purple-300 dark:border-purple-800'
                : source.type === 'direct'
                ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 border-emerald-300 dark:border-emerald-800'
                : 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 border-blue-300 dark:border-blue-800'
            }`}
          >
            {source.type}
          </span>

          {/* Quality Pill */}
          {source.quality && (
            <span className="text-[10px] mono px-1.5 py-0.5 rounded border border-c bg-sidebar text-muted">
              {source.quality}
            </span>
          )}

          {/* Label */}
          <span className="font-semibold text-fg truncate text-xs">
            {source.label}
          </span>
        </div>

        {/* Health Status Badge */}
        <div className="shrink-0 flex items-center gap-1">
          {isTesting ? (
            <span
              className="inline-flex items-center gap-1 text-[10px] mono px-1.5 py-0.5 rounded border border-c bg-sidebar text-muted"
              title="Testing source health..."
            >
              <Loader2 className="h-3 w-3 animate-spin text-muted" />
              Testing
            </span>
          ) : healthResult?.status === 'working' ? (
            <span
              className="inline-flex items-center gap-1 text-[10px] mono font-medium px-1.5 py-0.5 rounded border border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
              title={
                healthResult.latencyMs
                  ? `Status 200 OK (${healthResult.latencyMs}ms)`
                  : 'Working'
              }
            >
              <CheckCircle2 className="h-3 w-3 text-emerald-600 dark:text-emerald-400" />
              Working
            </span>
          ) : healthResult?.status === 'broken' ? (
            <span
              className="inline-flex items-center gap-1 text-[10px] mono font-medium px-1.5 py-0.5 rounded border border-red-500/30 bg-red-500/10 text-red-600 dark:text-red-400"
              title={healthResult.error || 'Source probe failed or returned 404'}
            >
              <AlertCircle className="h-3 w-3 text-red-600 dark:text-red-400" />
              Broken
            </span>
          ) : (
            <span
              className="inline-flex items-center gap-1 text-[10px] mono px-1.5 py-0.5 rounded border border-c bg-sidebar text-muted"
              title="Health check pending or unknown"
            >
              Unknown
            </span>
          )}
        </div>
      </div>

      {/* URL / Key Row with Copy Option */}
      <div className="flex items-center justify-between gap-2 bg-sidebar/50 px-2 py-1 rounded border border-c">
        <span
          className="mono text-[11px] text-muted truncate select-all flex-1 min-w-0"
          title={source.url}
        >
          {source.url}
        </span>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={onCopy}
          className="h-5 w-5 p-0 text-muted hover:text-fg shrink-0"
          title={copied ? 'Copied to clipboard' : 'Copy URL'}
          aria-label={copied ? 'Copied' : `Copy URL for ${source.label}`}
        >
          {copied ? (
            <Check className="h-3 w-3 text-emerald-500" />
          ) : (
            <Copy className="h-3 w-3" />
          )}
        </Button>
      </div>

      {/* Actions Strip: Preview, Test, Edit, Delete */}
      <div className="flex items-center justify-between gap-1 pt-0.5 border-t border-c/50">
        <div className="flex items-center gap-1">
          {/* Preview button */}
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={onPreview}
            className="h-6 px-2 text-[11px] mono flex items-center gap-1"
            title="Preview stream playback in modal"
          >
            <Play className="h-2.5 w-2.5 fill-current" />
            Preview
          </Button>

          {/* Test button */}
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleTestProbe}
            disabled={isTesting}
            className="h-6 px-2 text-[11px] mono border-c hover-bg flex items-center gap-1"
            title="Run on-demand health probe"
          >
            <Activity className="h-2.5 w-2.5" />
            {isTesting ? 'Probing...' : 'Test'}
          </Button>
        </div>

        <div className="flex items-center gap-1">
          {/* Edit button */}
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onStartEdit}
            className="h-6 w-6 p-0 text-muted hover:text-fg"
            title="Edit source details"
            aria-label={`Edit ${source.label}`}
          >
            <Edit2 className="h-3 w-3" />
          </Button>

          {/* Delete button */}
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onRequestDelete}
            className="h-6 w-6 p-0 text-red-600 dark:text-red-400 hover:text-red-700 hover:bg-red-500/10"
            title="Remove source"
            aria-label={`Delete ${source.label}`}
          >
            <Trash2 className="h-3 w-3" />
          </Button>
        </div>
      </div>
    </div>
  );
}
