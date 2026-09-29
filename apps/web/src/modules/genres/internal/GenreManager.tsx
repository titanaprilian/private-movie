import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Plus, Search, Pencil, Trash2, Loader2 } from 'lucide-react';
import { ChunkyButton } from '@/components/ui/chunky-button';
import { ChunkyInput } from '@/components/ui/chunky-input';
import { ChunkyCheckbox } from '@/components/ui/chunky-checkbox';
import { ChunkyCard, ChunkyCardList } from '@/components/ui/chunky-card';
import { ChunkySkeleton } from '@/components/ui/chunky-skeleton';
import { ChunkyActionMenu } from '@/components/ui/chunky-action-menu';
import {
  ChunkyDialog,
  ChunkyDialogContent,
  ChunkyDialogHeader,
  ChunkyDialogTitle,
  ChunkyDialogDescription,
  ChunkyDialogBody,
  ChunkyDialogFooter,
} from '@/components/ui/chunky-dialog';
import { ChunkyConfirmDialog } from '@/components/ui/chunky-confirm-dialog';
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
  const {
    data: genres = [],
    isLoading,
    isError,
    error,
  } = useQuery(genresQueryOptions());

  const [searchTerm, setSearchTerm] = useState('');

  // Dialog States
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [createName, setCreateName] = useState('');
  const [createSlug, setCreateSlug] = useState('');
  const [createIsBigGenre, setCreateIsBigGenre] = useState(false);
  const [createDisplayOrder, setCreateDisplayOrder] = useState(0);
  const [isSlugManuallyEdited, setIsSlugManuallyEdited] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const [editingGenre, setEditingGenre] = useState<Genre | null>(null);
  const [editName, setEditName] = useState('');
  const [editSlug, setEditSlug] = useState('');
  const [editIsBigGenre, setEditIsBigGenre] = useState(false);
  const [editDisplayOrder, setEditDisplayOrder] = useState(0);
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
    mutationFn: ({
      id,
      name,
      slug,
      isBigGenre,
      displayOrder,
    }: {
      id: string;
      name: string;
      slug: string;
      isBigGenre?: boolean;
      displayOrder?: number;
    }) => updateGenre(id, { name, slug, isBigGenre, displayOrder }),
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
    setCreateIsBigGenre(false);
    setCreateDisplayOrder(0);
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
    setEditIsBigGenre(genre.isBigGenre ?? false);
    setEditDisplayOrder(genre.displayOrder ?? 0);
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
      isBigGenre: createIsBigGenre,
      displayOrder: createDisplayOrder,
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
      isBigGenre: editIsBigGenre,
      displayOrder: editDisplayOrder,
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
          <h1 className="font-display text-3xl font-extrabold tracking-tight text-[var(--ink)]">
            Genre Management
          </h1>
          <p className="font-sans text-sm font-semibold text-[var(--muted)] mt-1">
            Manage genre taxonomies and categories across the platform.
          </p>
        </div>
        <ChunkyButton
          variant="primary"
          onClick={() => {
            resetCreateForm();
            setIsCreateOpen(true);
          }}
          className="shrink-0"
        >
          <Plus aria-hidden="true" />
          Create Genre
        </ChunkyButton>
      </div>

      {/* Toolbar / Search */}
      <div className="rounded-2xl border-2 border-b-4 border-[var(--border)] bg-[var(--surface)] p-3 flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[220px]">
          <Search
            aria-hidden="true"
            className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--muted)]"
          />
          <ChunkyInput
            placeholder="Search genres..."
            aria-label="Search genres"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        <span
          data-testid="genre-count"
          className="ml-auto rounded-xl border-2 border-[var(--border)] bg-[var(--surface-raised)] px-3 py-1.5 font-sans text-xs font-extrabold uppercase tracking-[0.7px] text-[var(--muted)]"
        >
          {filteredGenres.length}{' '}
          {filteredGenres.length === 1 ? 'genre' : 'genres'}
        </span>
      </div>

      {/* Genre Card-Row Grid */}
      <div className="w-full">
        {filteredGenres.length > 0 && !isLoading && !isError && (
          <div
            className="grid gap-3.5 items-center px-4 pb-2 text-xs font-extrabold uppercase tracking-wider text-[var(--muted)]"
            style={{
              gridTemplateColumns: '48px 1fr auto 72px 48px',
            }}
            aria-hidden="true"
          >
            <span className="text-center">#</span>
            <span>Genre</span>
            <span>Badge</span>
            <span className="text-center">Order</span>
            <span />
          </div>
        )}

        {isLoading ? (
          <ChunkyCardList data-testid="genre-skeleton-list">
            {[0, 1, 2].map((i) => (
              <ChunkySkeleton
                key={i}
                className="h-[76px] w-full border-2"
                data-testid="genre-skeleton-row"
              />
            ))}
            <span className="sr-only">Loading genres...</span>
          </ChunkyCardList>
        ) : isError ? (
          <ChunkyCard className="p-8 text-center">
            <p className="font-sans text-sm font-extrabold text-[var(--red)]">
              {error instanceof Error ? error.message : 'Error loading genres'}
            </p>
          </ChunkyCard>
        ) : filteredGenres.length === 0 ? (
          <ChunkyCard
            className="p-8 text-center"
            data-testid="genre-empty-state"
          >
            <p className="font-display text-xl font-bold text-[var(--ink)]">
              {searchTerm ? 'No genres match your search' : 'No genres yet'}
            </p>
            <p className="mt-1 font-sans text-sm font-semibold text-[var(--muted)]">
              {searchTerm
                ? 'Try a different name or slug keyword.'
                : 'Create your first genre to get started.'}
            </p>
          </ChunkyCard>
        ) : (
          <ChunkyCardList data-testid="genre-card-grid">
            {filteredGenres.map((genre, index) => (
              <ChunkyCard
                key={genre.id}
                data-testid={`genre-card-${genre.id}`}
                className="grid items-center gap-3 p-3 hover:-translate-y-[2px] hover:shadow-lg transition-all"
                style={{
                  gridTemplateColumns: '48px 1fr auto 72px 48px',
                }}
              >
                {/* Tactile index badge */}
                <span
                  aria-hidden="true"
                  className="flex h-10 w-12 items-center justify-center rounded-xl border-2 border-b-4 border-[var(--border)] bg-[var(--surface-raised)] font-sans text-[15px] font-extrabold text-[var(--blue)]"
                >
                  {index + 1}
                </span>

                {/* Name + slug */}
                <div className="min-w-0">
                  <p className="truncate font-sans text-[15px] font-extrabold leading-snug text-[var(--ink)]">
                    {genre.name}
                  </p>
                  <p className="truncate font-mono text-[13px] font-semibold text-[var(--muted)]">
                    {genre.slug}
                  </p>
                </div>

                {/* Big Genre badge */}
                <div>
                  {genre.isBigGenre ? (
                    <span className="inline-flex items-center rounded-full border-2 border-b-4 border-[var(--yellow-dark)] bg-[var(--yellow)] px-3 py-1 font-sans text-[11px] font-extrabold uppercase tracking-[0.7px] text-[#201a00]">
                      Big Genre
                    </span>
                  ) : (
                    <span className="font-mono text-xs font-semibold text-[var(--muted)]">
                      —
                    </span>
                  )}
                </div>

                {/* Display order */}
                <span className="text-center font-mono text-sm font-bold text-[var(--ink)]">
                  {genre.displayOrder ?? 0}
                </span>

                {/* Row actions */}
                <div className="flex items-center justify-end">
                  <ChunkyActionMenu
                    triggerLabel={`Actions for ${genre.name}`}
                    items={[
                      {
                        label: 'Edit',
                        icon: <Pencil className="h-4 w-4" aria-hidden="true" />,
                        onSelect: () => openEditModal(genre),
                      },
                      {
                        label: 'Delete',
                        icon: <Trash2 className="h-4 w-4" aria-hidden="true" />,
                        danger: true,
                        onSelect: () => {
                          setDeletingGenre(genre);
                          setDeleteError(null);
                        },
                      },
                    ]}
                  />
                </div>
              </ChunkyCard>
            ))}
          </ChunkyCardList>
        )}
      </div>

      {/* Create Genre Dialog */}
      <ChunkyDialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <ChunkyDialogContent className="sm:max-w-md">
          <ChunkyDialogHeader>
            <ChunkyDialogTitle>Create New Genre</ChunkyDialogTitle>
            <ChunkyDialogDescription>
              Add a new genre category to the content taxonomy.
            </ChunkyDialogDescription>
          </ChunkyDialogHeader>
          <form
            onSubmit={handleCreateSubmit}
            className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden"
          >
            <ChunkyDialogBody className="space-y-4">
              {createError && (
                <div className="rounded-2xl border-2 border-[var(--red-dark)] bg-[var(--red)]/10 px-4 py-3 font-sans text-xs font-bold text-[var(--red)]">
                  {createError}
                </div>
              )}
              <div className="space-y-1.5">
                <label
                  htmlFor="create-genre-name"
                  className="mb-1.5 block text-sm font-bold text-[var(--ink)]"
                >
                  Genre Name
                </label>
                <ChunkyInput
                  id="create-genre-name"
                  placeholder="e.g. Sci-Fi & Fantasy"
                  value={createName}
                  onChange={(e) => handleCreateNameChange(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-1.5">
                <label
                  htmlFor="create-genre-slug"
                  className="mb-1.5 block text-sm font-bold text-[var(--ink)]"
                >
                  Slug
                </label>
                <ChunkyInput
                  id="create-genre-slug"
                  placeholder="e.g. sci-fi-and-fantasy"
                  value={createSlug}
                  onChange={(e) => handleCreateSlugChange(e.target.value)}
                  required
                />
              </div>
              <div className="flex items-center space-x-2 pt-1">
                <ChunkyCheckbox
                  id="create-genre-big"
                  checked={createIsBigGenre}
                  onCheckedChange={setCreateIsBigGenre}
                />
                <label
                  htmlFor="create-genre-big"
                  className="cursor-pointer select-none text-sm font-bold text-[var(--muted)]"
                >
                  Set as Big Genre
                </label>
              </div>
              <div className="space-y-1.5">
                <label
                  htmlFor="create-genre-order"
                  className="mb-1.5 block text-sm font-bold text-[var(--ink)]"
                >
                  Display Order
                </label>
                <ChunkyInput
                  id="create-genre-order"
                  type="number"
                  placeholder="0"
                  value={createDisplayOrder}
                  onChange={(e) =>
                    setCreateDisplayOrder(parseInt(e.target.value || '0', 10))
                  }
                />
              </div>
            </ChunkyDialogBody>
            <ChunkyDialogFooter>
              <ChunkyButton
                type="button"
                variant="outline"
                onClick={() => setIsCreateOpen(false)}
              >
                Cancel
              </ChunkyButton>
              <ChunkyButton
                type="submit"
                variant="primary"
                disabled={createMutation.isPending}
              >
                {createMutation.isPending && (
                  <Loader2 className="animate-spin" aria-hidden="true" />
                )}
                {createMutation.isPending ? 'Creating...' : 'Create'}
              </ChunkyButton>
            </ChunkyDialogFooter>
          </form>
        </ChunkyDialogContent>
      </ChunkyDialog>

      {/* Edit Genre Dialog */}
      <ChunkyDialog
        open={Boolean(editingGenre)}
        onOpenChange={(open) => {
          if (!open) setEditingGenre(null);
        }}
      >
        <ChunkyDialogContent className="sm:max-w-md">
          <ChunkyDialogHeader>
            <ChunkyDialogTitle>Edit Genre</ChunkyDialogTitle>
            <ChunkyDialogDescription>
              Update the name, URL slug, or Big Genre settings for this genre.
            </ChunkyDialogDescription>
          </ChunkyDialogHeader>
          <form
            onSubmit={handleEditSubmit}
            className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden"
          >
            <ChunkyDialogBody className="space-y-4">
              {editError && (
                <div className="rounded-2xl border-2 border-[var(--red-dark)] bg-[var(--red)]/10 px-4 py-3 font-sans text-xs font-bold text-[var(--red)]">
                  {editError}
                </div>
              )}
              <div className="space-y-1.5">
                <label
                  htmlFor="edit-genre-name"
                  className="mb-1.5 block text-sm font-bold text-[var(--ink)]"
                >
                  Genre Name
                </label>
                <ChunkyInput
                  id="edit-genre-name"
                  value={editName}
                  onChange={(e) => handleEditNameChange(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-1.5">
                <label
                  htmlFor="edit-genre-slug"
                  className="mb-1.5 block text-sm font-bold text-[var(--ink)]"
                >
                  Slug
                </label>
                <ChunkyInput
                  id="edit-genre-slug"
                  value={editSlug}
                  onChange={(e) => setEditSlug(e.target.value)}
                  required
                />
              </div>
              <div className="flex items-center space-x-2 pt-1">
                <ChunkyCheckbox
                  id="edit-genre-big"
                  checked={editIsBigGenre}
                  onCheckedChange={setEditIsBigGenre}
                />
                <label
                  htmlFor="edit-genre-big"
                  className="cursor-pointer select-none text-sm font-bold text-[var(--muted)]"
                >
                  Set as Big Genre
                </label>
              </div>
              <div className="space-y-1.5">
                <label
                  htmlFor="edit-genre-order"
                  className="mb-1.5 block text-sm font-bold text-[var(--ink)]"
                >
                  Display Order
                </label>
                <ChunkyInput
                  id="edit-genre-order"
                  type="number"
                  placeholder="0"
                  value={editDisplayOrder}
                  onChange={(e) =>
                    setEditDisplayOrder(parseInt(e.target.value || '0', 10))
                  }
                />
              </div>
            </ChunkyDialogBody>
            <ChunkyDialogFooter>
              <ChunkyButton
                type="button"
                variant="outline"
                onClick={() => setEditingGenre(null)}
              >
                Cancel
              </ChunkyButton>
              <ChunkyButton
                type="submit"
                variant="primary"
                disabled={updateMutation.isPending}
              >
                {updateMutation.isPending && (
                  <Loader2 className="animate-spin" aria-hidden="true" />
                )}
                {updateMutation.isPending ? 'Saving...' : 'Save Changes'}
              </ChunkyButton>
            </ChunkyDialogFooter>
          </form>
        </ChunkyDialogContent>
      </ChunkyDialog>

      {/* Delete Confirmation */}
      <ChunkyConfirmDialog
        open={Boolean(deletingGenre)}
        onOpenChange={(open) => {
          if (!open) setDeletingGenre(null);
        }}
        title="Delete Genre"
        description={
          <>
            Are you sure you want to delete &quot;{deletingGenre?.name}&quot;?
            This action cannot be undone.
            {deleteError && (
              <span className="mt-2 block rounded-2xl border-2 border-[var(--red-dark)] bg-[var(--red)]/10 px-4 py-3 font-sans text-xs font-bold text-[var(--red)]">
                {deleteError}
              </span>
            )}
          </>
        }
        confirmLabel="Delete"
        cancelLabel="Cancel"
        confirmVariant="danger"
        isPending={deleteMutation.isPending}
        onConfirm={handleDeleteConfirm}
      />
    </div>
  );
}
