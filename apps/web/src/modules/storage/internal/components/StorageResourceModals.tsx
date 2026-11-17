import type { StorageModals } from '../hooks/useStorageModals';
import { EditSourceModal } from './dialogs/EditSourceModal';
import { AttachOrphanDialog } from './dialogs/AttachOrphanDialog';
import { DeleteConfirmDialog } from './dialogs/DeleteConfirmDialog';
import { VideoPreviewModal } from './dialogs/VideoPreviewModal';

interface StorageResourceModalsProps {
  modals: StorageModals;
  allOrphansCount?: number;
  allOrphansSizeBytes?: number;
}

export function StorageResourceModals({
  modals,
  allOrphansCount = 0,
  allOrphansSizeBytes = 0,
}: StorageResourceModalsProps) {
  return (
    <>
      <EditSourceModal
        open={Boolean(modals.editingSource)}
        onOpenChange={(open) => {
          if (!open) modals.setEditingSource(null);
        }}
        videoSource={modals.editingSource}
        onSave={modals.handleSaveSourceMetadata}
      />

      <AttachOrphanDialog
        open={Boolean(modals.attachingResource)}
        onOpenChange={(open) => {
          if (!open) modals.setAttachingResource(null);
        }}
        fileKey={modals.attachingResource?.key ?? null}
        filename={modals.attachingResource?.filename}
        onAttach={modals.handleAttachOrphan}
      />

      <DeleteConfirmDialog
        open={Boolean(modals.deleteTargetType)}
        onOpenChange={(open) => {
          if (!open) modals.closeDeleteDialog();
        }}
        targetType={modals.deleteTargetType}
        targetResource={modals.deleteSingleResource}
        selectedResources={modals.deleteBatchResources}
        allOrphansCount={allOrphansCount}
        allOrphansSizeBytes={allOrphansSizeBytes}
        onConfirm={modals.handleConfirmDelete}
      />

      <VideoPreviewModal
        open={Boolean(modals.previewResource)}
        onOpenChange={(open) => {
          if (!open) modals.setPreviewResource(null);
        }}
        fileKey={modals.previewResource?.key ?? null}
        filename={modals.previewResource?.filename}
      />
    </>
  );
}
