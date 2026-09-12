import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import {
  type StorageProviderItem,
  type CreateStorageProviderRequest,
  type UpdateStorageProviderRequest,
  createStorageProvider,
  updateStorageProvider,
  deleteStorageProvider,
} from './api';
import { ProviderForm } from './ProviderForm';
import {
  Server,
  Plus,
  Edit2,
  Trash2,
  X,
  AlertTriangle,
  Star,
  ToggleLeft,
  ToggleRight,
} from 'lucide-react';
import { toast } from 'sonner';

export interface ManageProvidersDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  providers: StorageProviderItem[];
  selectedProviderId?: string | null;
  onSelectProvider?: (id: string) => void;
  onProvidersUpdated: () => void;
}

export function ManageProvidersDrawer({
  open,
  onOpenChange,
  providers,
  selectedProviderId,
  onSelectProvider,
  onProvidersUpdated,
}: ManageProvidersDrawerProps) {
  const [viewMode, setViewMode] = useState<'list' | 'create' | 'edit'>('list');
  const [editingProvider, setEditingProvider] = useState<StorageProviderItem | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Deletion confirmation state
  const [deletingProvider, setDeletingProvider] = useState<StorageProviderItem | null>(null);
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

  // Handle ESC key
  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (viewMode !== 'list') {
          setViewMode('list');
          setEditingProvider(null);
        } else {
          onOpenChange(false);
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, viewMode, onOpenChange]);

  if (!open) return null;

  const handleSaveProvider = async (
    data: CreateStorageProviderRequest | UpdateStorageProviderRequest
  ) => {
    setIsSaving(true);
    try {
      if (editingProvider) {
        await updateStorageProvider(editingProvider.id, data);
        toast.success(`Updated provider: ${data.name || editingProvider.name}`);
      } else {
        const created = await createStorageProvider(data as CreateStorageProviderRequest);
        toast.success(`Registered provider: ${created.name}`);
        if (onSelectProvider) {
          onSelectProvider(created.id);
        }
      }
      onProvidersUpdated();
      setViewMode('list');
      setEditingProvider(null);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to save provider';
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
      const msg = err instanceof Error ? err.message : 'Failed to update default provider';
      toast.error(msg);
    }
  };

  const handleToggleEnabled = async (provider: StorageProviderItem) => {
    try {
      await updateStorageProvider(provider.id, { isEnabled: !provider.isEnabled });
      toast.success(
        `${!provider.isEnabled ? 'Enabled' : 'Disabled'} provider: ${provider.name}`
      );
      onProvidersUpdated();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to toggle provider status';
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
      const msg = err instanceof Error ? err.message : 'Failed to delete provider';
      setDeleteError(msg);
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-label="Manage Storage Providers"
      className="fixed inset-0 z-50 overflow-hidden"
      data-testid="manage-providers-drawer"
    >
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 transition-opacity animate-in fade-in"
        onClick={() => onOpenChange(false)}
        aria-hidden="true"
        data-testid="providers-drawer-backdrop"
      />

      <div className="fixed inset-y-0 right-0 max-w-full flex pl-10">
        <div className="w-screen max-w-xl bg-card border-l border-c shadow-2xl flex flex-col h-full z-10 animate-in slide-in-from-right duration-200">
          {/* Header */}
          <div className="p-4 border-b border-c flex items-center justify-between gap-3 bg-sidebar/50">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded bg-primary/10 text-primary border border-primary/20 flex items-center justify-center">
                <Server className="w-4 h-4" />
              </div>
              <div>
                <h2 className="text-sm font-semibold text-fg">
                  {viewMode === 'create'
                    ? 'Register S3 Provider'
                    : viewMode === 'edit'
                    ? `Edit: ${editingProvider?.name}`
                    : 'Storage Providers'}
                </h2>
                <p className="text-[11px] text-muted">
                  {viewMode === 'list'
                    ? 'Configure multi-cloud S3 storage buckets and credentials.'
                    : 'Configure bucket endpoints, encryption credentials, and quotas.'}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {viewMode === 'list' && (
                <Button
                  size="sm"
                  variant="default"
                  onClick={() => setViewMode('create')}
                  data-testid="add-provider-btn"
                  className="h-7 text-xs gap-1"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Add Provider
                </Button>
              )}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onOpenChange(false)}
                className="h-7 w-7 p-0 text-muted hover:text-fg"
                data-testid="close-providers-drawer-btn"
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
          </div>

          {/* Body Content */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
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
                {/* Deletion Warning / Alert Modal inside Drawer */}
                {deletingProvider && (
                  <div
                    data-testid="delete-provider-alert"
                    className="p-3.5 border border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-950/30 rounded space-y-2.5 text-xs animate-in fade-in duration-150"
                  >
                    <div className="flex items-start gap-2 text-red-800 dark:text-red-300">
                      <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-red-600 dark:text-red-400" />
                      <div>
                        <div className="font-semibold">Delete {deletingProvider.name}?</div>
                        <div className="text-[11px] mt-0.5 text-red-700 dark:text-red-300">
                          {deleteError ? (
                            <span className="font-medium text-red-900 dark:text-red-200" data-testid="delete-error-message">
                              {deleteError}
                            </span>
                          ) : (
                            'Are you sure you want to delete this storage provider? This action cannot be undone.'
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center justify-end gap-2 pt-1">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setDeletingProvider(null);
                          setDeleteError(null);
                        }}
                        disabled={isDeleting}
                        className="h-7 text-xs"
                      >
                        Cancel
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={handleDeleteConfirm}
                        disabled={isDeleting}
                        data-testid="confirm-delete-provider-btn"
                        className="h-7 text-xs"
                      >
                        {isDeleting ? 'Deleting...' : 'Confirm Delete'}
                      </Button>
                    </div>
                  </div>
                )}

                {providers.length === 0 ? (
                  <div className="text-center py-8 border border-dashed border-c rounded text-muted text-xs">
                    No storage providers configured yet.
                  </div>
                ) : (
                  providers.map((p) => {
                    const isSelected = selectedProviderId === p.id;

                    return (
                      <div
                        key={p.id}
                        data-testid={`provider-card-${p.id}`}
                        className={`p-3.5 border rounded bg-card transition-all ${
                          isSelected
                            ? 'border-primary shadow-sm ring-1 ring-primary/20'
                            : 'border-c hover:border-fg/30'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="space-y-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-semibold text-xs text-fg truncate">
                                {p.name}
                              </span>

                              {/* Badges */}
                              {p.isDefault && (
                                <span
                                  data-testid="badge-default"
                                  className="text-[10px] font-medium px-1.5 py-0.2 rounded border bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400 border-indigo-200 dark:border-indigo-800"
                                >
                                  Default
                                </span>
                              )}

                              <span
                                className={`text-[10px] font-medium px-1.5 py-0.2 rounded border uppercase mono ${
                                  p.isEnabled
                                    ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 border-green-200 dark:border-green-800'
                                    : 'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400 border-zinc-200 dark:border-zinc-700'
                                }`}
                              >
                                {p.isEnabled ? 'Enabled' : 'Disabled'}
                              </span>

                              <span className="text-[10px] mono text-muted px-1.5 py-0.2 rounded border border-c bg-sidebar">
                                {p.providerType}
                              </span>
                            </div>

                            <div className="text-[11px] mono text-muted truncate">
                              {p.bucket} • {p.endpoint}
                            </div>

                            <div className="text-[10px] mono text-muted flex items-center gap-3 pt-0.5">
                              <span>Quota: {p.storageLimitGb} GB</span>
                              <span>Sources: {p.linkedSourcesCount}</span>
                              {p.publicBaseUrl && (
                                <span className="truncate max-w-[180px]" title={p.publicBaseUrl}>
                                  CDN: {p.publicBaseUrl}
                                </span>
                              )}
                            </div>
                          </div>

                          {/* Actions */}
                          <div className="flex items-center gap-1 shrink-0">
                            {onSelectProvider && (
                              <Button
                                size="sm"
                                variant={isSelected ? 'secondary' : 'outline'}
                                onClick={() => onSelectProvider(p.id)}
                                data-testid={`select-provider-btn-${p.id}`}
                                className="h-7 px-2 text-[11px] mono"
                              >
                                {isSelected ? 'Active' : 'Select'}
                              </Button>
                            )}

                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleToggleDefault(p)}
                              disabled={p.isDefault}
                              title={p.isDefault ? 'Default provider' : 'Set as default'}
                              data-testid={`set-default-btn-${p.id}`}
                              className="h-7 w-7 p-0 text-muted hover:text-primary"
                            >
                              <Star
                                className={`w-3.5 h-3.5 ${
                                  p.isDefault ? 'fill-primary text-primary' : ''
                                }`}
                              />
                            </Button>

                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleToggleEnabled(p)}
                              title={p.isEnabled ? 'Disable provider' : 'Enable provider'}
                              data-testid={`toggle-enable-btn-${p.id}`}
                              className="h-7 w-7 p-0 text-muted hover:text-fg"
                            >
                              {p.isEnabled ? (
                                <ToggleRight className="w-4 h-4 text-green-600" />
                              ) : (
                                <ToggleLeft className="w-4 h-4 text-zinc-400" />
                              )}
                            </Button>

                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => {
                                setEditingProvider(p);
                                setViewMode('edit');
                              }}
                              title="Edit provider"
                              data-testid={`edit-provider-btn-${p.id}`}
                              className="h-7 w-7 p-0 text-muted hover:text-fg"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </Button>

                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => {
                                setDeletingProvider(p);
                                setDeleteError(null);
                              }}
                              title="Delete provider"
                              data-testid={`delete-provider-btn-${p.id}`}
                              className="h-7 w-7 p-0 text-muted hover:text-red-600"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
