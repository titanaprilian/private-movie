import { useState, useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { updateSeason, type SeasonDetails } from './api';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export interface EditSeasonDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  season: SeasonDetails;
}

export function EditSeasonDialog({
  open,
  onOpenChange,
  season,
}: EditSeasonDialogProps) {
  const queryClient = useQueryClient();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');

  useEffect(() => {
    if (open) {
      setTitle(season.title);
      setDescription(season.description ?? '');
    }
  }, [open, season]);

  const updateMutation = useMutation({
    mutationFn: (params: { title: string; description: string | null }) =>
      updateSeason(season.id, params),
    onSuccess: (updated) => {
      queryClient.invalidateQueries({ queryKey: ['series', season.seriesId] });
      toast.success('Season updated successfully', {
        description: updated.title,
      });
      onOpenChange(false);
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to update season');
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    updateMutation.mutate({
      title: title.trim(),
      description: description.trim() || null,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Edit Season</DialogTitle>
          <DialogDescription>
            Update this season&apos;s metadata to correct scraped data or add
            your own context.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label htmlFor="edit-season-title">Title</Label>
            <Input
              id="edit-season-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Season 1"
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="edit-season-description">Description</Label>
            <textarea
              id="edit-season-description"
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Optional description"
              className="flex w-full rounded border border-c bg-transparent px-3 py-2 text-sm shadow-sm transition-colors placeholder:text-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)] focus-visible:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-50"
            />
          </div>
          <DialogFooter className="pt-2">
            <Button
              type="button"
              variant="secondary"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={!title.trim() || updateMutation.isPending}>
              {updateMutation.isPending ? 'Saving...' : 'Save Changes'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
