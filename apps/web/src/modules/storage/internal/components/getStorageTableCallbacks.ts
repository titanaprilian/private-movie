import type { StorageModals } from '../hooks/useStorageModals';
import type { StorageResource } from '../api';

export function getStorageTableCallbacks(modals: StorageModals) {
  return {
    onRefreshScan: () => modals.refreshScanMutation.mutate(),
    isRefreshing: modals.refreshScanMutation.isPending,
    onPreview: (res: StorageResource) => modals.setPreviewResource(res),
    onEditSource: (res: StorageResource) => {
      if (res.videoSource) {
        modals.setEditingSource({ ...res.videoSource, key: res.key });
      }
    },
    onAttachOrphan: (res: StorageResource) => modals.setAttachingResource(res),
    onDeleteSingle: (res: StorageResource) => {
      modals.setDeleteSingleResource(res);
      modals.setDeleteTargetType('single');
    },
    onDeleteBatch: (selected: StorageResource[]) => {
      modals.setDeleteBatchResources(selected);
      modals.setDeleteTargetType('batch');
    },
    onPurgeOrphans: () => {
      modals.setDeleteTargetType('purge');
    },
  };
}
