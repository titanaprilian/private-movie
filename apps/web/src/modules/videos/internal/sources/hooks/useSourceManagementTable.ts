import { useState } from 'react';
import type { VideoSource } from '../../api';
import type {
  SourceMutationValues,
  UseSourceManagementTableOptions,
  UseSourceManagementTableReturn,
} from '../types';
import { useSourceMutations } from './useSourceMutations';

export function useSourceManagementTable({
  episodeId,
}: UseSourceManagementTableOptions): UseSourceManagementTableReturn {
  const { addMutation, editMutation, deleteMutation } = useSourceMutations({
    episodeId,
  });
  const [previewSource, setPreviewSource] = useState<VideoSource | null>(null);
  const [isAddingSource, setIsAddingSource] = useState(false);
  const [editingSourceId, setEditingSourceId] = useState<string | null>(null);
  const [deletingSourceId, setDeletingSourceId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const handleCopyUrl = (id: string, url: string) => {
    navigator.clipboard.writeText(url);
    setCopiedId(id);
    setTimeout(() => setCopiedId((c) => (c === id ? null : c)), 2000);
  };

  const handleAdd = (values: SourceMutationValues) => {
    addMutation.mutate(values, {
      onSuccess: () => {
        setIsAddingSource(false);
        setEditingSourceId(null);
      },
    });
  };

  return {
    addMutation,
    editMutation,
    deleteMutation,
    previewSource,
    setPreviewSource,
    isAddingSource,
    setIsAddingSource,
    editingSourceId,
    setEditingSourceId,
    deletingSourceId,
    setDeletingSourceId,
    copiedId,
    handleCopyUrl,
    handleAdd,
  };
}
