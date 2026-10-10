import { Plus } from 'lucide-react';
import { ChunkyButton } from '@/components/ui/chunky-button';
import { useGenreManager } from './hooks/useGenreManager';
import { useGenreDialogs } from './hooks/useGenreDialogs';
import { GenreTable } from './components/GenreTable';
import { CreateGenreDialog } from './components/CreateGenreDialog';
import { EditGenreDialog } from './components/EditGenreDialog';
import { DeleteGenreDialog } from './components/DeleteGenreDialog';

export function GenreManager() {
  const m = useGenreManager();
  const d = useGenreDialogs();

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-extrabold tracking-tight text-[var(--ink)]">Genre Management</h1>
          <p className="font-sans text-sm font-semibold text-[var(--muted)] mt-1">Manage genre taxonomies and categories across the platform.</p>
        </div>
        <ChunkyButton variant="primary" onClick={() => { d.resetCreateForm(); d.setIsCreateOpen(true); }} className="shrink-0">
          <Plus aria-hidden="true" />
          Create Genre
        </ChunkyButton>
      </div>
      <GenreTable genres={m.filteredGenres} searchTerm={m.searchTerm} onSearchChange={m.setSearchTerm} sortField={m.sortField} sortDirection={m.sortDirection} onSort={m.handleSort} isLoading={m.isLoading} isError={m.isError} error={m.error} onEdit={d.openEditModal} onDelete={(genre) => { d.setDeletingGenre(genre); d.setDeleteError(null); }} />
      <CreateGenreDialog open={d.isCreateOpen} onOpenChange={d.setIsCreateOpen} name={d.createName} slug={d.createSlug} isBigGenre={d.createIsBigGenre} displayOrder={d.createDisplayOrder} error={d.createError} mutation={m.createMutation} onNameChange={d.handleCreateNameChange} onSlugChange={d.handleCreateSlugChange} onBigGenreChange={d.setCreateIsBigGenre} onDisplayOrderChange={d.setCreateDisplayOrder} onSuccess={() => { d.setIsCreateOpen(false); d.resetCreateForm(); }} onError={d.setCreateError} />
      <EditGenreDialog genre={d.editingGenre} onOpenChange={(open) => { if (!open) d.setEditingGenre(null); }} name={d.editName} slug={d.editSlug} isBigGenre={d.editIsBigGenre} displayOrder={d.editDisplayOrder} error={d.editError} mutation={m.updateMutation} onNameChange={d.handleEditNameChange} onSlugChange={d.setEditSlug} onBigGenreChange={d.setEditIsBigGenre} onDisplayOrderChange={d.setEditDisplayOrder} onSuccess={() => { d.setEditingGenre(null); d.setEditError(null); }} onError={d.setEditError} />
      <DeleteGenreDialog genre={d.deletingGenre} onOpenChange={(open) => { if (!open) d.setDeletingGenre(null); }} error={d.deleteError} mutation={m.deleteMutation} onSuccess={() => { d.setDeletingGenre(null); d.setDeleteError(null); }} onError={d.setDeleteError} />
    </div>
  );
}
