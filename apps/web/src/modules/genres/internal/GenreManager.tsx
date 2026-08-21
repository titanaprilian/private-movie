import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  genresQueryOptions,
  createGenre,
  updateGenre,
  deleteGenre,
  slugifyGenre,
  type Genre,
} from './api';

export function GenreManager() {
  const queryClient = useQueryClient();
  const { data: genres = [], isLoading, isError, error } = useQuery(
    genresQueryOptions()
  );

  const [searchTerm, setSearchTerm] = useState('');

  // Dialog States
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [createName, setCreateName] = useState('');
  const [createSlug, setCreateSlug] = useState('');
  const [isSlugManuallyEdited, setIsSlugManuallyEdited] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const [editingGenre, setEditingGenre] = useState<Genre | null>(null);
  const [editName, setEditName] = useState('');
  const [editSlug, setEditSlug] = useState('');
  const [editError, setEditError] = useState<string | null>(null);

  const [deletingGenre, setDeletingGenre] = useState<Genre | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // Filter genres by search term
  const filteredGenres = genres.filter(
    (g) =>
      g.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      g.slug.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Create Mutation
  const createMutation = useMutation({
    mutationFn: createGenre,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['genres'] });
      toast.success('Genre created successfully');
      setIsCreateOpen(false);
      resetCreateForm();
    },
    onError: (err: Error) => {
      setCreateError(err.message);
    },
  });

  // Update Mutation
  const updateMutation = useMutation({
    mutationFn: ({ id, name, slug }: { id: string; name: string; slug: string }) =>
      updateGenre(id, { name, slug }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['genres'] });
      toast.success('Genre updated successfully');
      setEditingGenre(null);
      setEditError(null);
    },
    onError: (err: Error) => {
      setEditError(err.message);
    },
  });

  // Delete Mutation
  const deleteMutation = useMutation({
    mutationFn: deleteGenre,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['genres'] });
      toast.success('Genre deleted successfully');
      setDeletingGenre(null);
      setDeleteError(null);
    },
    onError: (err: Error) => {
      setDeleteError(err.message);
    },
  });

  const resetCreateForm = () => {
    setCreateName('');
    setCreateSlug('');
    setIsSlugManuallyEdited(false);
    setCreateError(null);
  };

  const handleCreateNameChange = (name: string) => {
    setCreateName(name);
    if (!isSlugManuallyEdited) {
      setCreateSlug(slugifyGenre(name));
    }
  };

  const handleCreateSlugChange = (slug: string) => {
    setCreateSlug(slug);
    setIsSlugManuallyEdited(true);
  };

  const openEditModal = (genre: Genre) => {
    setEditingGenre(genre);
    setEditName(genre.name);
    setEditSlug(genre.slug);
    setEditError(null);
  };

  const handleEditNameChange = (name: string) => {
    setEditName(name);
    setEditSlug(slugifyGenre(name));
  };

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!createName.trim() || !createSlug.trim()) return;
    setCreateError(null);
    createMutation.mutate({
      name: createName.trim(),
      slug: createSlug.trim(),
    });
  };

  const handleEditSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingGenre || !editName.trim() || !editSlug.trim()) return;
    setEditError(null);
    updateMutation.mutate({
      id: editingGenre.id,
      name: editName.trim(),
      slug: editSlug.trim(),
    });
  };

  const handleDeleteConfirm = () => {
    if (!deletingGenre) return;
    setDeleteError(null);
    deleteMutation.mutate(deletingGenre.id);
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-lg font-semibold tracking-tight">
            Genre Management
          </h1>
          <p className="text-xs text-muted mt-1">
            Manage genre taxonomies and categories across the platform.
          </p>
        </div>
        <Button
          onClick={() => {
            resetCreateForm();
            setIsCreateOpen(true);
          }}
          className="shrink-0"
        >
          <svg
            className="w-4 h-4 mr-1.5"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          Create Genre
        </Button>
      </div>

      {/* Toolbar / Search */}
      <div className="flex items-center justify-between gap-4">
        <div className="relative max-w-xs w-full">
          <Input
            placeholder="Search genres..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="text-xs mono"
          />
        </div>
        <span className="text-xs mono text-muted">
          Total: {filteredGenres.length} genres
        </span>
      </div>

      {/* Data Table */}
      <div className="bg-card border border-c rounded overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm border-collapse">
            <thead>
              <tr className="border-b border-c bg-sidebar text-muted uppercase tracking-wide text-xs">
                <th className="px-4 py-3 font-semibold">Name</th>
                <th className="px-4 py-3 font-semibold">Slug</th>
                <th className="px-4 py-3 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={3} className="px-4 py-8 text-center text-xs text-muted mono">
                    Loading genres...
                  </td>
                </tr>
              ) : isError ? (
                <tr>
                  <td colSpan={3} className="px-4 py-8 text-center text-xs text-red-600 dark:text-red-400 mono">
                    {error instanceof Error ? error.message : 'Error loading genres'}
                  </td>
                </tr>
              ) : filteredGenres.length === 0 ? (
                <tr>
                  <td colSpan={3} className="px-4 py-8 text-center text-xs text-muted mono">
                    {searchTerm ? 'No genres found matching query' : 'No genres found'}
                  </td>
                </tr>
              ) : (
                filteredGenres.map((genre) => (
                  <tr
                    key={genre.id}
                    className="border-b border-c hover-bg last:border-b-0 transition-colors"
                  >
                    <td className="px-4 py-3 font-medium text-fg">
                      {genre.name}
                    </td>
                    <td className="px-4 py-3 text-xs mono text-muted">
                      {genre.slug}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          aria-label={`Edit Genre ${genre.name}`}
                          onClick={() => openEditModal(genre)}
                          className="h-8 px-2.5 text-xs"
                        >
                          <svg
                            className="w-3.5 h-3.5 mr-1"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                          >
                            <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
                            <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
                          </svg>
                          Edit
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          aria-label={`Delete Genre ${genre.name}`}
                          onClick={() => {
                            setDeletingGenre(genre);
                            setDeleteError(null);
                          }}
                          className="h-8 px-2.5 text-xs text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
                        >
                          <svg
                            className="w-3.5 h-3.5 mr-1"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                          >
                            <path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" />
                          </svg>
                          Delete
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create Genre Modal Dialog */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Create New Genre</DialogTitle>
            <DialogDescription>
              Add a new genre category to the content taxonomy.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreateSubmit} className="space-y-4">
            {createError && (
              <div className="p-3 rounded border border-red-200 dark:border-red-900/50 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 text-xs mono">
                {createError}
              </div>
            )}
            <div className="space-y-1.5">
              <Label htmlFor="create-genre-name">Genre Name</Label>
              <Input
                id="create-genre-name"
                placeholder="e.g. Sci-Fi & Fantasy"
                value={createName}
                onChange={(e) => handleCreateNameChange(e.target.value)}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="create-genre-slug">Slug</Label>
              <Input
                id="create-genre-slug"
                placeholder="e.g. sci-fi-and-fantasy"
                value={createSlug}
                onChange={(e) => handleCreateSlugChange(e.target.value)}
                className="mono text-xs"
                required
              />
            </div>
            <DialogFooter className="pt-2">
              <Button
                type="button"
                variant="secondary"
                onClick={() => setIsCreateOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={createMutation.isPending}>
                {createMutation.isPending ? 'Creating...' : 'Create'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit Genre Modal Dialog */}
      <Dialog
        open={Boolean(editingGenre)}
        onOpenChange={(open) => {
          if (!open) setEditingGenre(null);
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Genre</DialogTitle>
            <DialogDescription>
              Update the name or URL slug for this genre.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleEditSubmit} className="space-y-4">
            {editError && (
              <div className="p-3 rounded border border-red-200 dark:border-red-900/50 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 text-xs mono">
                {editError}
              </div>
            )}
            <div className="space-y-1.5">
              <Label htmlFor="edit-genre-name">Genre Name</Label>
              <Input
                id="edit-genre-name"
                value={editName}
                onChange={(e) => handleEditNameChange(e.target.value)}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="edit-genre-slug">Slug</Label>
              <Input
                id="edit-genre-slug"
                value={editSlug}
                onChange={(e) => setEditSlug(e.target.value)}
                className="mono text-xs"
                required
              />
            </div>
            <DialogFooter className="pt-2">
              <Button
                type="button"
                variant="secondary"
                onClick={() => setEditingGenre(null)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={updateMutation.isPending}>
                {updateMutation.isPending ? 'Saving...' : 'Save Changes'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Modal Dialog */}
      <Dialog
        open={Boolean(deletingGenre)}
        onOpenChange={(open) => {
          if (!open) setDeletingGenre(null);
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Delete Genre</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete &quot;{deletingGenre?.name}&quot;?
              This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          {deleteError && (
            <div className="p-3 rounded border border-red-200 dark:border-red-900/50 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 text-xs mono">
              {deleteError}
            </div>
          )}
          <DialogFooter className="pt-2">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setDeletingGenre(null)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={deleteMutation.isPending}
              onClick={handleDeleteConfirm}
            >
              {deleteMutation.isPending ? 'Deleting...' : 'Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
