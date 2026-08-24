import { useState, useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { createSeason, type SeasonDetails } from './api';
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

export interface AddSeasonDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  seriesId: string;
  onCreated?: (season: SeasonDetails) => void;
}

export function AddSeasonDialog({
  open,
  onOpenChange,
  seriesId,
  onCreated,
}: AddSeasonDialogProps) {
  const queryClient = useQueryClient();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');

  useEffect(() => {
    if (open) {
      setTitle('');
      setDescription('');
    }
  }, [open]);

  const createMutation = useMutation({
    mutationFn: (params: { title: string; description: string | null }) =>
      createSeason(seriesId, params),
    onSuccess: (season) => {
      queryClient.invalidateQueries({ queryKey: ['series', seriesId] });
      toast.success('Season created successfully', {
        description: season.title,
      });
      onOpenChange(false);
      onCreated?.(season);
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to create season');
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    createMutation.mutate({
      title: title.trim(),
      description: description.trim() || null,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Add Season</DialogTitle>
          <DialogDescription>
            Create a new empty season for this series. You can add episodes to
            it afterwards.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label htmlFor="add-season-title">Title</Label>
            <Input
              id="add-season-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Season 2"
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="add-season-description">Description</Label>
            <textarea
              id="add-season-description"
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
            <Button type="submit" disabled={!title.trim() || createMutation.isPending}>
              {createMutation.isPending ? 'Creating...' : 'Create Season'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
