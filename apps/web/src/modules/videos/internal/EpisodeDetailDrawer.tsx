import { useState, useEffect, useMemo } from 'react';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { SeriesDetails, UpdateEpisodeData } from './api';
import { SourceManagementTable } from './SourceManagementTable';

export type Episode = SeriesDetails['episodes'][number];

export interface EpisodeDetailDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  episode: Episode | null;
  onSave: (episodeId: string, data: UpdateEpisodeData) => Promise<void> | void;
  isSaving?: boolean;
  onOpenAdvancedIngest?: (tab: 'remote-ingest' | 'upload-s3') => void;
}

interface FormState {
  title: string;
  description: string;
  videoType: string;
  duration: string;
  resolution: string;
  format: string;
  size: string;
  tagsText: string;
}

function getInitialFormState(episode: Episode | null): FormState {
  return {
    title: episode?.title ?? '',
    description: episode?.description ?? '',
    videoType: episode?.videoType ?? '',
    duration:
      episode?.duration !== null && episode?.duration !== undefined
        ? String(episode.duration)
        : '',
    resolution: episode?.resolution ?? '',
    format: episode?.format ?? '',
    size: episode?.size ?? '',
    tagsText: Array.isArray(episode?.tags) ? episode.tags.join(', ') : '',
  };
}

export function EpisodeDetailDrawer({
  open,
  onOpenChange,
  episode,
  onSave,
  isSaving = false,
  onOpenAdvancedIngest,
}: EpisodeDetailDrawerProps) {
  const [formState, setFormState] = useState<FormState>(() =>
    getInitialFormState(episode)
  );

  useEffect(() => {
    setFormState(getInitialFormState(episode));
  }, [episode]);

  // Handle ESC key
  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onOpenChange(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, onOpenChange]);

  const initialFormState = useMemo(
    () => getInitialFormState(episode),
    [episode]
  );

  const isDirty = useMemo(() => {
    return (
      formState.title !== initialFormState.title ||
      formState.description !== initialFormState.description ||
      formState.videoType !== initialFormState.videoType ||
      formState.duration !== initialFormState.duration ||
      formState.resolution !== initialFormState.resolution ||
      formState.format !== initialFormState.format ||
      formState.size !== initialFormState.size ||
      formState.tagsText !== initialFormState.tagsText
    );
  }, [formState, initialFormState]);

  if (!open || !episode) {
    return null;
  }

  const handleDiscard = () => {
    setFormState(getInitialFormState(episode));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isDirty || isSaving) return;

    const parsedTags = formState.tagsText
      .split(',')
      .map((t) => t.trim())
      .filter((t) => t.length > 0);

    const updateData: UpdateEpisodeData = {
      title: formState.title,
      description: formState.description || null,
      videoType: formState.videoType || null,
      duration: formState.duration || null,
      resolution: formState.resolution || null,
      format: formState.format || null,
      size: formState.size || null,
      tags: parsedTags,
    };

    await onSave(episode.id, updateData);
  };

  return (
    <div
      role="dialog"
      aria-label={`Episode Details: ${episode.title}`}
      className="fixed inset-0 z-50 overflow-hidden"
    >
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 transition-opacity animate-in fade-in"
        onClick={() => onOpenChange(false)}
        aria-hidden="true"
        data-testid="drawer-backdrop"
      />

      <div className="fixed inset-y-0 right-0 max-w-full flex pl-10">
        <div className="w-screen max-w-md bg-card border-l border-c shadow-2xl flex flex-col h-full z-10 animate-in slide-in-from-right duration-200">
          {/* Header */}
          <div className="p-4 border-b border-c flex items-start justify-between gap-3 bg-sidebar/50">
            <div className="space-y-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs text-muted px-1.5 py-0.5 rounded border border-c bg-card">
                  #{episode.order ?? '—'}
                </span>
                <h2 className="text-sm font-semibold truncate text-fg">
                  {episode.title}
                </h2>
              </div>
              <p className="text-[11px] mono text-muted truncate">
                ID: {episode.id}
              </p>
            </div>

            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => onOpenChange(false)}
              className="h-8 w-8 p-0 text-muted hover:text-fg shrink-0"
              aria-label="Close drawer"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>

          {/* Form Content */}
          <form
            id="episode-drawer-form"
            onSubmit={handleSubmit}
            className="flex-1 overflow-y-auto p-4 space-y-6 text-xs"
          >
            {/* General Metadata Section */}
            <div className="space-y-3.5">
              <div className="font-medium mono text-[11px] uppercase tracking-wider text-muted border-b border-c pb-1">
                General Information
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="drawer-title" className="text-xs">
                  Title
                </Label>
                <Input
                  id="drawer-title"
                  value={formState.title}
                  onChange={(e) =>
                    setFormState((prev) => ({ ...prev, title: e.target.value }))
                  }
                  placeholder="Episode title"
                  className="h-8 text-xs"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="drawer-description" className="text-xs">
                  Description
                </Label>
                <textarea
                  id="drawer-description"
                  rows={4}
                  value={formState.description}
                  onChange={(e) =>
                    setFormState((prev) => ({
                      ...prev,
                      description: e.target.value,
                    }))
                  }
                  placeholder="Episode description..."
                  className="flex w-full rounded border border-c bg-transparent px-3 py-2 text-xs shadow-sm transition-colors placeholder:text-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)] focus-visible:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-50"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="drawer-video-type" className="text-xs">
                  Video Type
                </Label>
                <Input
                  id="drawer-video-type"
                  value={formState.videoType}
                  onChange={(e) =>
                    setFormState((prev) => ({
                      ...prev,
                      videoType: e.target.value,
                    }))
                  }
                  placeholder="e.g. mp4, embed"
                  className="h-8 text-xs mono"
                />
              </div>
            </div>

            {/* Technical Metadata Section */}
            <div className="space-y-3.5">
              <div className="font-medium mono text-[11px] uppercase tracking-wider text-muted border-b border-c pb-1">
                Technical Metadata
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="drawer-duration" className="text-xs">
                    Duration
                  </Label>
                  <Input
                    id="drawer-duration"
                    value={formState.duration}
                    onChange={(e) =>
                      setFormState((prev) => ({
                        ...prev,
                        duration: e.target.value,
                      }))
                    }
                    placeholder="e.g. 24:15 or 01:20:00"
                    className="h-8 text-xs mono"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="drawer-resolution" className="text-xs">
                    Resolution
                  </Label>
                  <Input
                    id="drawer-resolution"
                    value={formState.resolution}
                    onChange={(e) =>
                      setFormState((prev) => ({
                        ...prev,
                        resolution: e.target.value,
                      }))
                    }
                    placeholder="e.g. 1080p, 4K"
                    className="h-8 text-xs mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="drawer-format" className="text-xs">
                    Format
                  </Label>
                  <Input
                    id="drawer-format"
                    value={formState.format}
                    onChange={(e) =>
                      setFormState((prev) => ({
                        ...prev,
                        format: e.target.value,
                      }))
                    }
                    placeholder="e.g. MP4, MKV"
                    className="h-8 text-xs mono"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="drawer-size" className="text-xs">
                    File Size
                  </Label>
                  <Input
                    id="drawer-size"
                    value={formState.size}
                    onChange={(e) =>
                      setFormState((prev) => ({
                        ...prev,
                        size: e.target.value,
                      }))
                    }
                    placeholder="e.g. 450 MB"
                    className="h-8 text-xs mono"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="drawer-tags" className="text-xs">
                  Tags (comma-separated)
                </Label>
                <Input
                  id="drawer-tags"
                  value={formState.tagsText}
                  onChange={(e) =>
                    setFormState((prev) => ({
                      ...prev,
                      tagsText: e.target.value,
                    }))
                  }
                  placeholder="Action, Filler, Canon"
                  className="h-8 text-xs"
                />
              </div>
            </div>

            {/* Embedded Source Management Table */}
            <div className="pt-2">
              <SourceManagementTable
                episode={episode}
                onOpenAdvancedIngest={onOpenAdvancedIngest}
              />
            </div>
          </form>

          {/* Sticky Dirty-State Action Footer */}
          <div className="p-3.5 border-t border-c bg-sidebar/60 flex items-center justify-between gap-2 mt-auto">
            <div className="text-[11px] mono text-muted">
              {isDirty ? (
                <span className="text-amber-600 dark:text-amber-400 font-medium">
                  ● Unsaved changes
                </span>
              ) : (
                <span>All changes saved</span>
              )}
            </div>

            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={handleDiscard}
                disabled={!isDirty || isSaving}
                className="h-8 text-xs"
              >
                Discard
              </Button>
              <Button
                type="submit"
                form="episode-drawer-form"
                size="sm"
                disabled={!isDirty || isSaving}
                className="h-8 text-xs"
              >
                {isSaving ? 'Saving...' : 'Save Changes'}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
