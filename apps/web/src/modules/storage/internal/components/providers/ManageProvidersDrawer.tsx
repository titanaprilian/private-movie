import { useState, useEffect } from 'react';
import { ChunkyButton } from '@/components/ui/chunky-button';
import { ChunkyCard, ChunkyCardList } from '@/components/ui/chunky-card';
import {
  ChunkyDrawer,
  ChunkyDrawerContent,
  ChunkyDrawerHeader,
  ChunkyDrawerTitle,
  ChunkyDrawerDescription,
  ChunkyDrawerBody,
  ChunkyDrawerFooter,
} from '@/components/ui/chunky-drawer';
import {
  ChunkyDialog,
  ChunkyDialogContent,
  ChunkyDialogHeader,
  ChunkyDialogTitle,
  ChunkyDialogDescription,
  ChunkyDialogBody,
  ChunkyDialogFooter,
} from '@/components/ui/chunky-dialog';
import {
  type StorageProviderItem,
  type CreateStorageProviderRequest,
  type UpdateStorageProviderRequest,
  createStorageProvider,
  updateStorageProvider,
  deleteStorageProvider,
} from '../../api';
import { ProviderForm } from './ProviderForm';
import {
  Server,
  Plus,
  Edit2,
  Trash2,
  AlertTriangle,
  Star,
  ToggleLeft,
  ToggleRight,
  Rocket,
} from 'lucide-react';
import { toast } from 'sonner';

export interface ManageProvidersDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  providers: StorageProviderItem[];
  selectedProviderId?: string | null;
  onSelectProvider?: (id: string) => void;
  onProvidersUpdated: () => void;
  onSpinUpMinio?: () => void;
}

export function ManageProvidersDrawer({
  open,
  onOpenChange,
  providers,
  selectedProviderId,
  onSelectProvider,
  onProvidersUpdated,
  onSpinUpMinio,
}: ManageProvidersDrawerProps) {
  const [viewMode, setViewMode] = useState<'list' | 'create' | 'edit'>('list');
  const [editingProvider, setEditingProvider] =
    useState<StorageProviderItem | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Deletion confirmation state
  const [deletingProvider, setDeletingProvider] =
    useState<StorageProviderItem | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Reset to list when opened
  useEffect(() => {
    if (open) {
      setViewMode('list');
      setEditingProvider(null);
      setDeletingProvider(null);
      setDeleteError(null);
    }
  }, [open]);

  const handleSaveProvider = async (
    data: CreateStorageProviderRequest | UpdateStorageProviderRequest
  ) => {
    setIsSaving(true);
    try {
      if (editingProvider) {
        await updateStorageProvider(editingProvider.id, data);
        toast.success(`Updated provider: ${data.name || editingProvider.name}`);
      } else {
        const created = await createStorageProvider(
          data as CreateStorageProviderRequest
        );
        toast.success(`Registered provider: ${created.name}`);
        if (onSelectProvider) {
          onSelectProvider(created.id);
        }
      }
      onProvidersUpdated();
      setViewMode('list');
      setEditingProvider(null);
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : 'Failed to save provider';
      toast.error(msg);
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggleDefault = async (provider: StorageProviderItem) => {
    if (provider.isDefault) return;
    try {
      await updateStorageProvider(provider.id, { isDefault: true });
      toast.success(`Set ${provider.name} as default provider`);
      onProvidersUpdated();
    } catch (err) {
      const msg =
        err instanceof Error
          ? err.message
          : 'Failed to update default provider';
      toast.error(msg);
    }
  };

  const handleToggleEnabled = async (provider: StorageProviderItem) => {
    try {
      await updateStorageProvider(provider.id, {
        isEnabled: !provider.isEnabled,
      });
      toast.success(
        `${!provider.isEnabled ? 'Enabled' : 'Disabled'} provider: ${provider.name}`
      );
      onProvidersUpdated();
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : 'Failed to toggle provider status';
      toast.error(msg);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!deletingProvider) return;
    setIsDeleting(true);
    setDeleteError(null);

    try {
      await deleteStorageProvider(deletingProvider.id);
      toast.success(`Deleted provider: ${deletingProvider.name}`);
      setDeletingProvider(null);
      onProvidersUpdated();
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : 'Failed to delete provider';
      setDeleteError(msg);
    } finally {
      setIsDeleting(false);
    }
  };

  const closeDeleteDialog = () => {
    setDeletingProvider(null);
    setDeleteError(null);
  };

  return (
    <ChunkyDrawer open={open} onOpenChange={onOpenChange}>
      <ChunkyDrawerContent
        data-testid="manage-providers-drawer"
        aria-label="Manage Storage Providers"
        className="md:max-w-xl"
      >
        {/* Header */}
        <ChunkyDrawerHeader>
          <span className="flex items-center gap-2.5">
            <span className="w-11 h-11 rounded-2xl border-2 border-b-4 border-[var(--green-dark)] bg-[var(--green-soft)] text-[var(--green)] flex items-center justify-center shrink-0">
              <Server className="w-5 h-5" />
            </span>
            <span>
              <ChunkyDrawerTitle>
                {viewMode === 'create'
                  ? 'Register S3 Provider'
                  : viewMode === 'edit'
                    ? `Edit: ${editingProvider?.name}`
                    : 'Storage Providers'}
              </ChunkyDrawerTitle>
              <ChunkyDrawerDescription>
                {viewMode === 'list'
                  ? 'Configure multi-cloud S3 storage buckets and credentials.'
                  : 'Configure bucket endpoints, encryption credentials, and quotas.'}
              </ChunkyDrawerDescription>
            </span>
          </span>
        </ChunkyDrawerHeader>

        {/* Scrollable Body */}
        <ChunkyDrawerBody className="space-y-4">
          {/* View Mode: Create or Edit Form */}
          {(viewMode === 'create' || viewMode === 'edit') && (
            <ProviderForm
              initialProvider={editingProvider}
              onSave={handleSaveProvider}
              onCancel={() => {
                setViewMode('list');
                setEditingProvider(null);
              }}
              isSaving={isSaving}
            />
          )}

          {/* View Mode: Provider List */}
          {viewMode === 'list' && (
            <div className="space-y-3">
              {providers.length === 0 ? (
                <ChunkyCard className="p-8 text-center border-dashed">
                  <p className="font-sans text-sm font-bold text-[var(--muted)]">
                    No storage providers configured yet.
                  </p>
                </ChunkyCard>
              ) : (
                <ChunkyCardList>
                  {providers.map((p) => {
                    const isSelected = selectedProviderId === p.id;

                    return (
                      <ChunkyCard
                        key={p.id}
                        selected={isSelected}
                        data-testid={`provider-card-${p.id}`}
                        className="p-3.5"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="space-y-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-sans font-extrabold text-sm text-[var(--ink)] truncate">
                                {p.name}
                              </span>

                              {/* Badges */}
                              {p.isDefault && (
                                <span
                                  data-testid="badge-default"
                                  className="font-sans text-[10px] font-extrabold uppercase tracking-wider px-1.5 py-0.5 rounded-xl border-2 border-[var(--blue-dark)] bg-[var(--blue-soft)] text-[var(--blue)]"
                                >
                                  Default
                                </span>
                              )}

                              <span
                                className={`font-sans text-[10px] font-extrabold uppercase tracking-wider px-1.5 py-0.5 rounded-xl border-2 ${
                                  p.isEnabled
                                    ? 'border-[var(--green-dark)] bg-[var(--green-soft)] text-[var(--green)]'
                                    : 'border-[var(--border-strong)] bg-[var(--surface-raised)] text-[var(--muted)]'
                                }`}
                              >
                                {p.isEnabled ? 'Enabled' : 'Disabled'}
                              </span>

                              <span className="font-mono text-[10px] font-bold text-[var(--muted)] px-1.5 py-0.5 rounded-xl border-2 border-[var(--border)] bg-[var(--surface-raised)]">
                                {p.providerType}
                              </span>
                            </div>

                            <div className="font-mono text-[11px] font-semibold text-[var(--muted)] truncate">
                              {p.bucket} • {p.endpoint}
                            </div>

                            <div className="font-mono text-[10px] font-semibold text-[var(--muted)] flex items-center gap-3 pt-0.5">
                              <span>Quota: {p.storageLimitGb} GB</span>
                              <span>Sources: {p.linkedSourcesCount}</span>
                              {p.publicBaseUrl && (
                                <span
                                  className="truncate max-w-[180px]"
                                  title={p.publicBaseUrl}
                                >
                                  CDN: {p.publicBaseUrl}
                                </span>
                              )}
                            </div>
                          </div>

                          {/* Chunky actions */}
                          <div className="flex items-center gap-1.5 shrink-0 flex-wrap justify-end">
                            {onSelectProvider && (
                              <ChunkyButton
                                size="sm"
                                variant={isSelected ? 'primary' : 'outline'}
                                onClick={() => onSelectProvider(p.id)}
                                data-testid={`select-provider-btn-${p.id}`}
                                className="h-9 px-2.5 font-mono"
                              >
                                {isSelected ? 'Active' : 'Select'}
                              </ChunkyButton>
                            )}

                            <ChunkyButton
                              size="sm"
                              variant="outline"
                              onClick={() => handleToggleDefault(p)}
                              disabled={p.isDefault}
                              title={
                                p.isDefault
                                  ? 'Default provider'
                                  : 'Set as default'
                              }
                              data-testid={`set-default-btn-${p.id}`}
                              aria-label={
                                p.isDefault
                                  ? 'Default provider'
                                  : `Set ${p.name} as default`
                              }
                              className="h-9 w-9 p-0"
                            >
                              <Star
                                className={`w-4 h-4 ${
                                  p.isDefault
                                    ? 'fill-[var(--gold)] text-[var(--gold-dark)]'
                                    : ''
                                }`}
                              />
                            </ChunkyButton>

                            <ChunkyButton
                              size="sm"
                              variant="outline"
                              onClick={() => handleToggleEnabled(p)}
                              title={
                                p.isEnabled
                                  ? 'Disable provider'
                                  : 'Enable provider'
                              }
                              data-testid={`toggle-enable-btn-${p.id}`}
                              aria-label={
                                p.isEnabled
                                  ? `Disable ${p.name}`
                                  : `Enable ${p.name}`
                              }
                              className="h-9 w-9 p-0"
                            >
                              {p.isEnabled ? (
                                <ToggleRight className="w-4 h-4 text-[var(--green)]" />
                              ) : (
                                <ToggleLeft className="w-4 h-4 text-[var(--muted)]" />
                              )}
                            </ChunkyButton>

                            <ChunkyButton
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                setEditingProvider(p);
                                setViewMode('edit');
                              }}
                              title="Edit provider"
                              data-testid={`edit-provider-btn-${p.id}`}
                              aria-label={`Edit ${p.name}`}
                              className="h-9 w-9 p-0"
                            >
                              <Edit2 className="w-4 h-4" />
                            </ChunkyButton>

                            <ChunkyButton
                              size="sm"
                              variant="danger"
                              onClick={() => {
                                setDeletingProvider(p);
                                setDeleteError(null);
                              }}
                              title="Delete provider"
                              data-testid={`delete-provider-btn-${p.id}`}
                              aria-label={`Delete ${p.name}`}
                              className="h-9 w-9 p-0"
                            >
                              <Trash2 className="w-4 h-4" />
                            </ChunkyButton>
                          </div>
                        </div>
                      </ChunkyCard>
                    );
                  })}
                </ChunkyCardList>
              )}
            </div>
          )}
        </ChunkyDrawerBody>

        {/* Docked Footer */}
        {viewMode === 'list' && (
          <ChunkyDrawerFooter>
            {onSpinUpMinio && (
              <ChunkyButton
                size="sm"
                variant="outline"
                onClick={onSpinUpMinio}
                data-testid="drawer-spin-up-minio-btn"
              >
                <Rocket className="w-4 h-4" />
                Spin Up MinIO
              </ChunkyButton>
            )}
            <ChunkyButton
              size="sm"
              onClick={() => setViewMode('create')}
              data-testid="add-provider-btn"
            >
              <Plus className="w-4 h-4" />
              Add Provider
            </ChunkyButton>
          </ChunkyDrawerFooter>
        )}

        {/* 409 Conflict / Delete Confirmation Dialog (danger styling) */}
        <ChunkyDialog
          open={deletingProvider !== null}
          onOpenChange={(o) => {
            if (!o) closeDeleteDialog();
          }}
        >
          <ChunkyDialogContent
            data-testid="delete-provider-alert"
            aria-label="Delete storage provider"
          >
            <ChunkyDialogHeader>
              <span className="flex items-center gap-2.5">
                <span className="w-11 h-11 rounded-2xl border-2 border-b-4 border-[var(--red-dark)] bg-[var(--red)] text-white flex items-center justify-center shrink-0">
                  <AlertTriangle className="w-5 h-5" />
                </span>
                <span>
                  <ChunkyDialogTitle>
                    Delete {deletingProvider?.name}?
                  </ChunkyDialogTitle>
                  <ChunkyDialogDescription>
                    This action cannot be undone.
                  </ChunkyDialogDescription>
                </span>
              </span>
            </ChunkyDialogHeader>
            <ChunkyDialogBody>
              {deleteError ? (
                <p
                  className="font-sans text-sm font-bold text-[var(--red)]"
                  data-testid="delete-error-message"
                >
                  {deleteError}
                </p>
              ) : (
                <p className="font-sans text-sm font-semibold text-[var(--muted)]">
                  Are you sure you want to delete this storage provider? This
                  action cannot be undone.
                </p>
              )}
            </ChunkyDialogBody>
            <ChunkyDialogFooter>
              <ChunkyButton
                size="sm"
                variant="outline"
                onClick={closeDeleteDialog}
                disabled={isDeleting}
              >
                Cancel
              </ChunkyButton>
              <ChunkyButton
                size="sm"
                variant="danger"
                onClick={handleDeleteConfirm}
                disabled={isDeleting}
                data-testid="confirm-delete-provider-btn"
              >
                {isDeleting ? 'Deleting...' : 'Confirm Delete'}
              </ChunkyButton>
            </ChunkyDialogFooter>
          </ChunkyDialogContent>
        </ChunkyDialog>
      </ChunkyDrawerContent>
    </ChunkyDrawer>
  );
}
