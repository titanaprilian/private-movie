import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  refreshStorageScan,
  updateStorageLimit,
  updateSourceMetadata,
  attachOrphanFile,
  deleteStorageResources,
  purgeOrphanFiles,
  type StorageResource,
  type VideoSourceMetadata,
  type AttachOrphanInput,
} from '../api';
import type { DeleteTargetType } from '../components/dialogs/DeleteConfirmDialog';

/**
 * Dialog/drawer visibility state, selection tracking, and mutation callbacks
 * for the storage module.
 */
export function useStorageModals(selectedProviderId: string | null) {
  const queryClient = useQueryClient();

  const [isLimitDialogOpen, setIsLimitDialogOpen] = useState(false);
  const [isProvidersDrawerOpen, setIsProvidersDrawerOpen] = useState(false);
  const [isSpinUpModalOpen, setIsSpinUpModalOpen] = useState(false);
  const [previewResource, setPreviewResource] =
    useState<StorageResource | null>(null);
  const [editingSource, setEditingSource] = useState<
    (VideoSourceMetadata & { key?: string }) | null
  >(null);
  const [attachingResource, setAttachingResource] =
    useState<StorageResource | null>(null);

  const [deleteTargetType, setDeleteTargetType] =
    useState<DeleteTargetType | null>(null);
  const [deleteSingleResource, setDeleteSingleResource] =
    useState<StorageResource | null>(null);
  const [deleteBatchResources, setDeleteBatchResources] = useState<
    StorageResource[]
  >([]);

  const refreshScanMutation = useMutation({
    mutationFn: () => refreshStorageScan(selectedProviderId || undefined),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['storage'] });
      toast.success('S3 bucket scan refreshed successfully');
    },
    onError: (err: unknown) => {
      const msg =
        err instanceof Error ? err.message : 'Failed to refresh bucket scan';
      toast.error(msg);
    },
  });

  const handleSaveLimit = async (limitGb: number) => {
    await updateStorageLimit(limitGb, selectedProviderId || undefined);
    queryClient.invalidateQueries({ queryKey: ['storage'] });
    toast.success(`Storage limit updated to ${limitGb} GB`);
  };

  const handleSaveSourceMetadata = async (
    sourceId: string,
    input: { label: string; quality: string },
  ) => {
    await updateSourceMetadata(sourceId, input);
    queryClient.invalidateQueries({ queryKey: ['storage'] });
    toast.success('Source metadata updated successfully');
  };

  const handleAttachOrphan = async (input: AttachOrphanInput) => {
    await attachOrphanFile({
      ...input,
      providerId: selectedProviderId || undefined,
    });
    queryClient.invalidateQueries({ queryKey: ['storage'] });
    toast.success('Orphaned file attached to episode successfully');
  };

  const handleConfirmDelete = async () => {
    const provId = selectedProviderId || undefined;
    if (deleteTargetType === 'single' && deleteSingleResource) {
      await deleteStorageResources([deleteSingleResource.key], provId);
      toast.success(`Deleted file: ${deleteSingleResource.filename}`);
    } else if (
      deleteTargetType === 'batch' &&
      deleteBatchResources.length > 0
    ) {
      const keys = deleteBatchResources.map((r) => r.key);
      const res = await deleteStorageResources(keys, provId);
      toast.success(`Deleted ${res.deletedKeys?.length ?? keys.length} files`);
    } else if (deleteTargetType === 'purge') {
      const res = await purgeOrphanFiles(provId);
      toast.success(
        `Purged ${res.deletedKeys?.length ?? 'all'} orphaned files`,
      );
    }
    queryClient.invalidateQueries({ queryKey: ['storage'] });
  };

  const closeDeleteDialog = () => {
    setDeleteTargetType(null);
    setDeleteSingleResource(null);
    setDeleteBatchResources([]);
  };

  return {
    isLimitDialogOpen,
    setIsLimitDialogOpen,
    isProvidersDrawerOpen,
    setIsProvidersDrawerOpen,
    isSpinUpModalOpen,
    setIsSpinUpModalOpen,
    previewResource,
    setPreviewResource,
    editingSource,
    setEditingSource,
    attachingResource,
    setAttachingResource,
    deleteTargetType,
    setDeleteTargetType,
    deleteSingleResource,
    setDeleteSingleResource,
    deleteBatchResources,
    setDeleteBatchResources,
    refreshScanMutation,
    handleSaveLimit,
    handleSaveSourceMetadata,
    handleAttachOrphan,
    handleConfirmDelete,
    closeDeleteDialog,
  };
}

export type StorageModals = ReturnType<typeof useStorageModals>;
