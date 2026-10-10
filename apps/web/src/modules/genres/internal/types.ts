import type { UseMutateFunction } from '@tanstack/react-query';
import type { Genre } from './api';

export type GenreCatalogFilter = 'all' | 'ongoing';

export const GENRE_CATALOG_PAGE_LIMIT = 20;

export interface GenreSeriesCatalogProps {
  slug: string;
  filter: GenreCatalogFilter;
  onFilterChange: (filter: GenreCatalogFilter) => void;
}

export type GenreSortField = 'name' | 'slug' | 'displayOrder' | 'isBigGenre';

export type SortDirection = 'asc' | 'desc';

export interface CreateGenrePayload {
  name: string;
  slug: string;
  isBigGenre?: boolean;
  displayOrder?: number;
}

export interface UpdateGenrePayload extends CreateGenrePayload {
  id: string;
}

export interface UseGenreManagerReturn {
  genres: Genre[];
  filteredGenres: Genre[];
  isLoading: boolean;
  isError: boolean;
  error: Error | null;
  searchTerm: string;
  setSearchTerm: (value: string) => void;
  sortField: GenreSortField | null;
  sortDirection: SortDirection;
  handleSort: (field: GenreSortField) => void;
  createMutation: {
    mutate: UseMutateFunction<Genre, Error, CreateGenrePayload, unknown>;
    isPending: boolean;
  };
  updateMutation: {
    mutate: UseMutateFunction<Genre, Error, UpdateGenrePayload, unknown>;
    isPending: boolean;
  };
  deleteMutation: {
    mutate: UseMutateFunction<Genre, Error, string, unknown>;
    isPending: boolean;
  };
}

export interface UseGenreDialogsReturn {
  isCreateOpen: boolean;
  setIsCreateOpen: (open: boolean) => void;
  createName: string;
  createSlug: string;
  createIsBigGenre: boolean;
  setCreateIsBigGenre: (value: boolean) => void;
  createDisplayOrder: number;
  setCreateDisplayOrder: (value: number) => void;
  createError: string | null;
  setCreateError: (value: string | null) => void;
  editingGenre: Genre | null;
  setEditingGenre: (genre: Genre | null) => void;
  editName: string;
  setEditName: (value: string) => void;
  editSlug: string;
  setEditSlug: (value: string) => void;
  editIsBigGenre: boolean;
  setEditIsBigGenre: (value: boolean) => void;
  editDisplayOrder: number;
  setEditDisplayOrder: (value: number) => void;
  editError: string | null;
  setEditError: (value: string | null) => void;
  deletingGenre: Genre | null;
  setDeletingGenre: (genre: Genre | null) => void;
  deleteError: string | null;
  setDeleteError: (value: string | null) => void;
  resetCreateForm: () => void;
  handleCreateNameChange: (name: string) => void;
  handleCreateSlugChange: (slug: string) => void;
  openEditModal: (genre: Genre) => void;
  handleEditNameChange: (name: string) => void;
}

export interface GenreTableProps {
  genres: Genre[];
  searchTerm: string;
  onSearchChange: (value: string) => void;
  sortField: GenreSortField | null;
  sortDirection: SortDirection;
  onSort: (field: GenreSortField) => void;
  isLoading: boolean;
  isError: boolean;
  error: Error | null;
  onEdit: (genre: Genre) => void;
  onDelete: (genre: Genre) => void;
}

export interface GenreRowProps {
  genre: Genre;
  index: number;
  onEdit: (genre: Genre) => void;
  onDelete: (genre: Genre) => void;
}

export interface GenreFormFields {
  name: string;
  slug: string;
  isBigGenre: boolean;
  displayOrder: number;
}

export interface GenreCreateDialogProps extends GenreFormFields {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  error: string | null;
  mutation: UseGenreManagerReturn['createMutation'];
  onNameChange: (value: string) => void;
  onSlugChange: (value: string) => void;
  onBigGenreChange: (value: boolean) => void;
  onDisplayOrderChange: (value: number) => void;
  onSuccess: () => void;
  onError: (message: string | null) => void;
}

export interface GenreEditDialogProps extends GenreFormFields {
  genre: Genre | null;
  onOpenChange: (open: boolean) => void;
  error: string | null;
  mutation: UseGenreManagerReturn['updateMutation'];
  onNameChange: (value: string) => void;
  onSlugChange: (value: string) => void;
  onBigGenreChange: (value: boolean) => void;
  onDisplayOrderChange: (value: number) => void;
  onSuccess: () => void;
  onError: (message: string | null) => void;
}

export interface GenreDeleteDialogProps {
  genre: Genre | null;
  onOpenChange: (open: boolean) => void;
  error: string | null;
  mutation: UseGenreManagerReturn['deleteMutation'];
  onSuccess: () => void;
  onError: (message: string | null) => void;
}
