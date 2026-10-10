import { useState } from 'react';
import { slugifyGenre, type Genre } from '../api';

export function useGenreDialogs() {
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

  return {
    isCreateOpen,
    setIsCreateOpen,
    createName,
    createSlug,
    createIsBigGenre,
    setCreateIsBigGenre,
    createDisplayOrder,
    setCreateDisplayOrder,
    createError,
    setCreateError,
    editingGenre,
    setEditingGenre,
    editName,
    setEditName,
    editSlug,
    setEditSlug,
    editIsBigGenre,
    setEditIsBigGenre,
    editDisplayOrder,
    setEditDisplayOrder,
    editError,
    setEditError,
    deletingGenre,
    setDeletingGenre,
    deleteError,
    setDeleteError,
    resetCreateForm,
    handleCreateNameChange,
    handleCreateSlugChange,
    openEditModal,
    handleEditNameChange,
  };
}
