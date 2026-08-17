import { useState, useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  type SeriesDetails,
  addVideoSources,
  updateVideoSource,
  deleteVideoSource,
  previewScrape,
  type VideoSource,
  type VideoSourceInput,
} from './api';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';

type Episode = SeriesDetails['episodes'][number];

interface ManageSourcesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  episode: Episode | null;
  seriesId: string;
}

function EditSourceRow({
  source,
  onUpdate,
  onDelete,
  isPending,
}: {
  source: VideoSource;
  onUpdate: (updates: { type: 'direct' | 'embed'; label: string; url: string; quality?: string | null }) => void;
  onDelete: () => void;
  isPending: boolean;
}) {
  const [label, setLabel] = useState(source.label);
  const [url, setUrl] = useState(source.url);
  const [type, setType] = useState<'direct' | 'embed'>(source.type);
  const [quality, setQuality] = useState(source.quality ?? '');

  useEffect(() => {
    setLabel(source.label);
    setUrl(source.url);
    setType(source.type);
    setQuality(source.quality ?? '');
  }, [source]);

  return (
    <div className="p-3 border border-c rounded bg-card space-y-2 text-xs">
      <div className="grid grid-cols-2 gap-2">
        <div>
          <Label className="text-[10px] text-muted">Label</Label>
          <Input
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            className="text-xs h-8"
          />
        </div>
        <div>
          <Label className="text-[10px] text-muted">Type</Label>
          <select
            value={type}
            onChange={(e) => setType(e.target.value as 'direct' | 'embed')}
            className="w-full h-8 px-2 rounded border border-c bg-card text-xs mono focus:outline-none focus:border-primary"
          >
            <option value="direct">Direct</option>
            <option value="embed">Embed</option>
          </select>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <Label className="text-[10px] text-muted">URL</Label>
          <Input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            className="text-xs h-8"
          />
        </div>
        <div>
          <Label className="text-[10px] text-muted">Quality</Label>
          <Input
            value={quality}
            onChange={(e) => setQuality(e.target.value)}
            placeholder="e.g. 720p"
            className="text-xs h-8"
          />
        </div>
      </div>
      <div className="flex items-center justify-between pt-1 gap-2">
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="text-xs h-7 border-red-200 dark:border-red-900/50 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30"
          disabled={isPending}
          onClick={onDelete}
        >
          Remove Source
        </Button>
        <Button
          type="button"
          size="sm"
          variant="secondary"
          className="text-xs h-7"
          disabled={isPending}
          onClick={() =>
            onUpdate({
              type,
              label,
              url,
              quality: quality || null,
            })
          }
        >
          Update Source
        </Button>
      </div>
    </div>
  );
}

export function ManageSourcesDialog({
  open,
  onOpenChange,
  episode,
  seriesId,
}: ManageSourcesDialogProps) {
  const queryClient = useQueryClient();

  const [activeTab, setActiveTab] = useState<'add-url' | 'edit-existing'>('add-url');
  const [scrapeUrl, setScrapeUrl] = useState('');
  const [htmlContent, setHtmlContent] = useState('');
  const [extractedSources, setExtractedSources] = useState<VideoSourceInput[] | null>(null);
  const [previewWarnings, setPreviewWarnings] = useState<string[]>([]);

  const previewMutation = useMutation({
    mutationFn: (params: { sourceUrl: string; source: 'otakudesu'; html: string }) =>
      previewScrape(params),
    onSuccess: (data) => {
      setExtractedSources(data.episode.videoSources || []);
      setPreviewWarnings(data.warnings || []);
    },
    onError: (error) => {
      toast.error('video.scrape_preview', {
        description: `Failed to scrape URL: ${error.message}`,
      });
    },
  });

  const saveSourcesMutation = useMutation({
    mutationFn: ({ episodeId, sources }: { episodeId: string; sources: VideoSourceInput[] }) =>
      addVideoSources(episodeId, sources),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['series', seriesId] });
      toast.success('video.source_add', {
        description: 'Successfully saved video sources',
      });
      setScrapeUrl('');
      setHtmlContent('');
      setExtractedSources(null);
      setPreviewWarnings([]);
      setActiveTab('edit-existing');
    },
    onError: (error) => {
      toast.error('video.source_add', {
        description: `Failed to save sources: ${error.message}`,
      });
    },
  });

  const updateSourceMutation = useMutation({
    mutationFn: ({ episodeId, sourceId, updates }: { episodeId: string; sourceId: string; updates: Parameters<typeof updateVideoSource>[2] }) =>
      updateVideoSource(episodeId, sourceId, updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['series', seriesId] });
      toast.success('video.source_update', {
        description: 'Successfully updated video source',
      });
    },
    onError: (error) => {
      toast.error('video.source_update', {
        description: `Failed to update source: ${error.message}`,
      });
    },
  });

  const deleteSourceMutation = useMutation({
    mutationFn: ({ episodeId, sourceId }: { episodeId: string; sourceId: string }) =>
      deleteVideoSource(episodeId, sourceId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['series', seriesId] });
      toast.success('video.source_delete', {
        description: 'Successfully removed video source',
      });
    },
    onError: (error) => {
      toast.error('video.source_delete', {
        description: `Failed to remove source: ${error.message}`,
      });
    },
  });

  if (!episode) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Manage Sources</DialogTitle>
          <DialogDescription>
            Add or edit video streaming sources for this episode.
          </DialogDescription>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={(val) => setActiveTab(val as 'add-url' | 'edit-existing')} className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="add-url">Add from URL</TabsTrigger>
            <TabsTrigger value="edit-existing">Edit Existing</TabsTrigger>
          </TabsList>

          <TabsContent value="add-url" className="mt-4 space-y-3">
            <div className="p-3 border border-c rounded bg-sidebar space-y-3">
              <div className="text-xs font-medium mono text-muted uppercase">Scrape Otakudesu URL</div>
              
              <div>
                <Label htmlFor="scrape-url" className="text-[10px] text-muted">Otakudesu URL</Label>
                <Input
                  id="scrape-url"
                  placeholder="https://otakudesu.cloud/episode/..."
                  value={scrapeUrl}
                  onChange={(e) => setScrapeUrl(e.target.value)}
                  className="text-xs h-8"
                />
              </div>

              <div>
                <Label htmlFor="scrape-html" className="text-[10px] text-muted">Page HTML Content (Optional/Required if offline)</Label>
                <textarea
                  id="scrape-html"
                  placeholder="Paste page HTML source code..."
                  value={htmlContent}
                  onChange={(e) => setHtmlContent(e.target.value)}
                  className="w-full h-20 p-2 rounded border border-c bg-card text-xs mono focus:outline-none focus:border-primary resize-y"
                />
              </div>

              <Button
                type="button"
                size="sm"
                variant="secondary"
                className="w-full text-xs h-8"
                disabled={previewMutation.isPending || !scrapeUrl.trim()}
                onClick={() => {
                  previewMutation.mutate({
                    sourceUrl: scrapeUrl,
                    source: 'otakudesu',
                    html: htmlContent,
                  });
                }}
              >
                {previewMutation.isPending ? 'Resolving mirrors...' : 'Preview'}
              </Button>
            </div>

            {extractedSources !== null && (
              <div className="p-3 border border-c rounded bg-card space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold">Extracted Sources ({extractedSources.length})</span>
                </div>

                {previewWarnings.length > 0 && (
                  <div className="space-y-1.5">
                    {previewWarnings.map((warning, index) => (
                      <div
                        key={index}
                        className="p-2 rounded border border-amber-200 dark:border-amber-900/50 bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-300 text-xs flex items-start gap-2"
                      >
                        <svg
                          className="w-3 h-3 shrink-0 mt-0.5 text-amber-600 dark:text-amber-400"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                        >
                          <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0zM12 9v4M12 17h.01" />
                        </svg>
                        <span>{warning}</span>
                      </div>
                    ))}
                  </div>
                )}

                {extractedSources.length > 0 ? (
                  <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                    {extractedSources.map((src, i) => (
                      <div key={i} className="p-2 bg-sidebar rounded border border-c text-xs mono flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 truncate">
                          <span className={`text-[9px] px-1.5 py-0.5 rounded border uppercase font-medium ${
                            src.type === 'direct'
                              ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 border-green-300 dark:border-green-800'
                              : 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 border-blue-300 dark:border-blue-800'
                          }`}>
                            {src.type}
                          </span>
                          <span className="font-semibold">{src.label}</span>
                          {src.quality && (
                            <span className="text-muted text-[10px]">({src.quality})</span>
                          )}
                        </div>
                        <span className="text-muted truncate max-w-[150px]">{src.url}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-xs text-muted mono italic py-2 text-center">
                    No video sources found.
                  </div>
                )}

                <Button
                  type="button"
                  size="sm"
                  variant="default"
                  className="w-full text-xs h-8"
                  disabled={saveSourcesMutation.isPending || extractedSources.length === 0}
                  onClick={() => {
                    saveSourcesMutation.mutate({
                      episodeId: episode.id,
                      sources: extractedSources,
                    });
                  }}
                >
                  {saveSourcesMutation.isPending ? 'Saving...' : 'Save Sources'}
                </Button>
              </div>
            )}
          </TabsContent>

          <TabsContent value="edit-existing" className="mt-4 space-y-3">
            {episode.videoSources && episode.videoSources.length > 0 ? (
              <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                {episode.videoSources.map((source) => (
                  <EditSourceRow
                    key={source.id}
                    source={source}
                    onUpdate={(updates) => {
                      updateSourceMutation.mutate({
                        episodeId: episode.id,
                        sourceId: source.id,
                        updates,
                      });
                    }}
                    onDelete={() => {
                      deleteSourceMutation.mutate({
                        episodeId: episode.id,
                        sourceId: source.id,
                      });
                    }}
                    isPending={updateSourceMutation.isPending || deleteSourceMutation.isPending}
                  />
                ))}
              </div>
            ) : (
              <div className="text-xs text-muted mono italic py-4 text-center border border-c rounded">
                No video sources configured.
              </div>
            )}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
