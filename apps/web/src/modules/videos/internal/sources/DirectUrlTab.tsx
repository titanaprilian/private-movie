import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { addVideoSources, type VideoSourceInput } from '../api';

export interface DirectUrlTabProps {
  episodeId: string;
  seriesId: string;
  onSuccess: () => void;
}

export function DirectUrlTab({ episodeId, seriesId, onSuccess }: DirectUrlTabProps) {
  const queryClient = useQueryClient();
  const [directUrl, setDirectUrl] = useState('');
  const [directLabel, setDirectLabel] = useState('');
  const [directQuality, setDirectQuality] = useState('');

  const saveSourcesMutation = useMutation({
    mutationFn: ({ episodeId, sources }: { episodeId: string; sources: VideoSourceInput[] }) =>
      addVideoSources(episodeId, sources),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['series', seriesId] });
      toast.success('video.source_add', {
        description: 'Successfully saved video sources',
      });
      setDirectUrl('');
      setDirectLabel('');
      setDirectQuality('');
      onSuccess();
    },
    onError: (error) => {
      toast.error('video.source_add', {
        description: `Failed to save sources: ${error.message}`,
      });
    },
  });

  return (
    <div className="p-3 border border-c rounded bg-card space-y-3">
      <div className="text-xs font-medium mono text-muted uppercase">Add Direct Video Source</div>

      <div>
        <Label htmlFor="direct-url" className="text-[10px] text-muted">
          Video URL
        </Label>
        <Input
          id="direct-url"
          placeholder="https://example.com/video.mp4"
          value={directUrl}
          onChange={(e) => setDirectUrl(e.target.value)}
          className="text-xs h-8"
        />
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div>
          <Label htmlFor="direct-label" className="text-[10px] text-muted">
            Label
          </Label>
          <Input
            id="direct-label"
            placeholder="e.g. Server A, 480p"
            value={directLabel}
            onChange={(e) => setDirectLabel(e.target.value)}
            className="text-xs h-8"
          />
        </div>
        <div>
          <Label htmlFor="direct-quality" className="text-[10px] text-muted">
            Quality
          </Label>
          <Input
            id="direct-quality"
            placeholder="e.g. 720p, 1080p"
            value={directQuality}
            onChange={(e) => setDirectQuality(e.target.value)}
            className="text-xs h-8"
          />
        </div>
      </div>

      <Button
        type="button"
        size="sm"
        variant="default"
        className="w-full text-xs h-8"
        disabled={saveSourcesMutation.isPending || !directUrl.trim() || !directLabel.trim()}
        onClick={() => {
          saveSourcesMutation.mutate({
            episodeId,
            sources: [
              {
                type: 'direct',
                url: directUrl.trim(),
                label: directLabel.trim(),
                quality: directQuality.trim() || null,
              },
            ],
          });
        }}
      >
        {saveSourcesMutation.isPending ? 'Saving...' : 'Add Video Source'}
      </Button>
    </div>
  );
}
