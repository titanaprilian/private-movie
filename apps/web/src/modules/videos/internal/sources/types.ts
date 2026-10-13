import type {
  CheckVideoSourceResult,
  Episode,
  VideoSource,
  VideoSourceInput,
} from '../api';

export type { CheckVideoSourceResult, Episode, VideoSource, VideoSourceInput };

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
