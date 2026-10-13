import type { RefObject } from 'react';
import type {
  CheckVideoSourceResult,
  Episode,
  VideoSource,
  VideoSourceInput,
} from '../api';
import type { StorageProviderItem } from '@/modules/storage';

export type { CheckVideoSourceResult, Episode, VideoSource, VideoSourceInput };
export type { StorageProviderItem };

export type SourceType = VideoSource['type'];

export type SourceHealthStatus = 'working' | 'broken' | 'testing' | 'unknown';

export interface SourceFormValues {
  type: SourceType;
  label: string;
  url: string;
  quality: string;
}

export interface SourceMutationValues {
  type: SourceType;
  label: string;
  url: string;
  quality?: string | null;
}

export interface SourceManagementTableProps {
  episode: Episode;
  onOpenAdvancedIngest?: (tab: 'remote-ingest' | 'upload-s3') => void;
}

export const SOURCE_TYPES = [
  { value: 'direct', label: 'Direct' },
  { value: 'embed', label: 'Embed' },
  { value: 's3', label: 'S3 Storage' },
] as const;

export interface SourceTypeBadgeProps {
  type: SourceType;
}

export interface SourceHealthBadgeProps {
  status: SourceHealthStatus;
  title?: string;
}

export interface SourceInlineEditFormProps {
  source: VideoSource;
  isPending: boolean;
  onCancel: () => void;
  onSave: (values: SourceMutationValues) => void;
}

export interface SourceAddFormProps {
  isPending: boolean;
  onCancel: () => void;
  onSave: (values: SourceMutationValues) => void;
}

export interface SourceTableRowProps {
  source: VideoSource;
  isEditing: boolean;
  isDeleting: boolean;
  copied: boolean;
  isSavingEdit: boolean;
  isDeletePending: boolean;
  onStartEdit: () => void;
  onCancelEdit: () => void;
  onSaveEdit: (values: SourceMutationValues) => void;
  onRequestDelete: () => void;
  onConfirmDelete: () => void;
  onCancelDelete: () => void;
  onPreview: () => void;
  onCopy: () => void;
}

export interface UseSourceHealthProbeOptions {
  source: VideoSource;
}

export interface UseSourceHealthProbeReturn {
  healthResult: CheckVideoSourceResult | undefined;
  isTesting: boolean;
  healthStatus: SourceHealthStatus;
  handleTestProbe: () => Promise<void>;
}

export interface UseSourceMutationsOptions {
  episodeId: string;
}

export interface UseSourceMutationsReturn {
  addMutation: {
    isPending: boolean;
    mutate: (
      values: SourceMutationValues,
      options?: { onSuccess?: () => void },
    ) => void;
  };
  editMutation: {
    isPending: boolean;
    mutate: (
      variables: { sourceId: string; updates: SourceMutationValues },
      options?: { onSuccess?: () => void },
    ) => void;
  };
  deleteMutation: {
    isPending: boolean;
    mutate: (sourceId: string, options?: { onSuccess?: () => void }) => void;
  };
}

export type ManageSourcesTab =
  | 'add-url'
  | 'add-direct'
  | 'remote-ingest'
  | 'upload-s3'
  | 'edit-existing';

export interface ManageSourcesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  episode: Episode | null;
  seriesId: string;
  initialTab?: ManageSourcesTab;
}

export interface VideoPreviewModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  source: VideoSource | null;
  episodeTitle?: string;
}

export interface DirectUrlTabProps {
  episodeId: string;
  seriesId: string;
  onSuccess: () => void;
}

export interface ScraperPreviewTabProps {
  episodeId: string;
  seriesId: string;
  onSuccess: () => void;
}

export interface RemoteIngestTabProps {
  episodeId: string;
  seriesId: string;
  providers: StorageProviderItem[];
  defaultProvider: StorageProviderItem | null;
  initialUrl?: string;
  initialLabel?: string;
  initialQuality?: string;
  onSuccess: () => void;
}

export interface S3UploadTabProps {
  episodeId: string;
  seriesId: string;
  providers: StorageProviderItem[];
  defaultProvider: StorageProviderItem | null;
  onSuccess: () => void;
}

export interface EditSourceRowProps {
  source: VideoSource;
  providers?: StorageProviderItem[];
  onUpdate: (updates: {
    type: 'direct' | 'embed' | 's3';
    label: string;
    url: string;
    quality?: string | null;
    storageProviderId?: string | null;
  }) => void;
  onDelete: () => void;
  onIngestToS3?: () => void;
  isPending: boolean;
}

export interface EditExistingSourcesTabProps {
  episode: Episode;
  seriesId: string;
  providers: StorageProviderItem[];
  onIngestShortcut: (source: VideoSource) => void;
}

export type S3UploadStatus = 'idle' | 'uploading';

export type S3UploadPhase = 'browser' | 'cloud';

export interface S3UploadProgress {
  percent: number;
  loaded: number;
  total: number;
}

export interface UseS3UploadOptions {
  episodeId: string;
  seriesId: string;
  defaultProvider: StorageProviderItem | null;
  onSuccess: () => void;
}

export interface UseS3UploadReturn {
  selectedFile: File | null;
  uploadLabel: string;
  setUploadLabel: (value: string) => void;
  uploadQuality: string;
  setUploadQuality: (value: string) => void;
  uploadProviderId: string;
  setUploadProviderId: (value: string) => void;
  uploadStatus: S3UploadStatus;
  uploadPhase: S3UploadPhase;
  uploadProgress: S3UploadProgress;
  s3Warning: string | null;
  isUploading: boolean;
  fileInputRef: RefObject<HTMLInputElement | null>;
  handleFileSelect: (file: File | null) => void;
  cancelUpload: () => void;
  handleUpload: () => Promise<void>;
}

export interface RemotePrefillState {
  url: string;
  label: string;
  quality: string;
}

export interface UseManageSourcesDialogOptions {
  open: boolean;
  initialTab?: ManageSourcesTab;
}

export interface UseManageSourcesDialogReturn {
  activeTab: ManageSourcesTab;
  setActiveTab: (tab: ManageSourcesTab) => void;
  providers: StorageProviderItem[];
  defaultProvider: StorageProviderItem | null;
  remotePrefill: RemotePrefillState;
  handleIngestShortcut: (source: VideoSource) => void;
}

export interface UseSourceManagementTableOptions {
  episodeId: string;
}

export interface UseSourceManagementTableReturn {
  addMutation: UseSourceMutationsReturn['addMutation'];
  editMutation: UseSourceMutationsReturn['editMutation'];
  deleteMutation: UseSourceMutationsReturn['deleteMutation'];
  previewSource: VideoSource | null;
  setPreviewSource: (source: VideoSource | null) => void;
  isAddingSource: boolean;
  setIsAddingSource: (value: boolean) => void;
  editingSourceId: string | null;
  setEditingSourceId: (id: string | null) => void;
  deletingSourceId: string | null;
  setDeletingSourceId: (id: string | null) => void;
  copiedId: string | null;
  handleCopyUrl: (id: string, url: string) => void;
  handleAdd: (values: SourceMutationValues) => void;
}
