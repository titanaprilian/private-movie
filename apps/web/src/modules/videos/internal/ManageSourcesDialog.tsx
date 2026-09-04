import { useState, useEffect, useRef } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  type SeriesDetails,
  addVideoSources,
  updateVideoSource,
  deleteVideoSource,
  previewScrape,
  presignUploadSource,
  uploadBinaryToS3,
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
  onUpdate: (updates: { type: 'direct' | 'embed' | 's3'; label: string; url: string; quality?: string | null }) => void;
  onDelete: () => void;
  isPending: boolean;
}) {
  const [label, setLabel] = useState(source.label);
  const [url, setUrl] = useState(source.url);
  const [type, setType] = useState<'direct' | 'embed' | 's3'>(source.type);
  const [quality, setQuality] = useState(source.quality ?? '');

  useEffect(() => {
    setLabel(source.label);
    setUrl(source.url);
    setType(source.type);
    setQuality(source.quality ?? '');
  }, [source]);

  return (
    <div className="p-3 border border-c rounded bg-card space-y-2 text-xs">
      <div className="flex items-center justify-between">
        <span
          className={`text-[9px] px-1.5 py-0.5 rounded border uppercase font-medium ${
            source.type === 's3'
              ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400 border-purple-300 dark:border-purple-800'
              : source.type === 'direct'
              ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 border-green-300 dark:border-green-800'
              : 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 border-blue-300 dark:border-blue-800'
          }`}
        >
          {source.type}
        </span>
      </div>
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
            onChange={(e) => setType(e.target.value as 'direct' | 'embed' | 's3')}
            className="w-full h-8 px-2 rounded border border-c bg-card text-xs mono focus:outline-none focus:border-primary"
          >
            <option value="direct">Direct</option>
            <option value="embed">Embed</option>
            <option value="s3">S3 Storage</option>
          </select>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <Label className="text-[10px] text-muted">URL / S3 Key</Label>
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

  const [activeTab, setActiveTab] = useState<'add-url' | 'add-direct' | 'upload-s3' | 'edit-existing'>('add-url');
  const [scrapeUrl, setScrapeUrl] = useState('');
  const [extractedSources, setExtractedSources] = useState<VideoSourceInput[] | null>(null);
  const [previewWarnings, setPreviewWarnings] = useState<string[]>([]);
  const [directUrl, setDirectUrl] = useState('');
  const [directLabel, setDirectLabel] = useState('');
  const [directQuality, setDirectQuality] = useState('');

  // S3 Upload State
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadLabel, setUploadLabel] = useState('');
  const [uploadQuality, setUploadQuality] = useState('');
  const [uploadStatus, setUploadStatus] = useState<'idle' | 'presigning' | 'uploading' | 'registering'>('idle');
  const [uploadProgress, setUploadProgress] = useState({ percent: 0, loaded: 0, total: 0 });
  const [s3Warning, setS3Warning] = useState<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const isUploading = uploadStatus !== 'idle';

  const handleFileSelect = (file: File | null) => {
    setSelectedFile(file);
    if (file) {
      const baseName = file.name.replace(/\.[^/.]+$/, '');
      setUploadLabel((prev) => (prev ? prev : baseName));
    }
  };

  const cancelUpload = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setUploadStatus('idle');
    setUploadProgress({ percent: 0, loaded: 0, total: 0 });
    setSelectedFile(null);
    setUploadLabel('');
    setUploadQuality('');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleUpload = async () => {
    if (!episode || !selectedFile || !uploadLabel.trim()) return;

    setS3Warning(null);
    const controller = new AbortController();
    abortControllerRef.current = controller;
    setUploadStatus('presigning');
    setUploadProgress({ percent: 0, loaded: 0, total: selectedFile.size });

    try {
      const { uploadUrl, key } = await presignUploadSource(episode.id, {
        filename: selectedFile.name,
        contentType: selectedFile.type || 'video/mp4',
      });

      if (controller.signal.aborted) return;

      setUploadStatus('uploading');
      await uploadBinaryToS3({
        url: uploadUrl,
        file: selectedFile,
        signal: controller.signal,
        onProgress: (progress) => {
          setUploadProgress(progress);
        },
      });

      if (controller.signal.aborted) return;

      setUploadStatus('registering');
      await addVideoSources(episode.id, {
        type: 's3',
        url: key,
        label: uploadLabel.trim(),
        quality: uploadQuality.trim() || null,
      });

      queryClient.invalidateQueries({ queryKey: ['series', seriesId] });
      toast.success('video.source_add', {
        description: 'Successfully uploaded and registered video source',
      });

      // Reset upload state and switch to existing
      setUploadStatus('idle');
      setUploadProgress({ percent: 0, loaded: 0, total: 0 });
      setSelectedFile(null);
      setUploadLabel('');
      setUploadQuality('');
      abortControllerRef.current = null;
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      setActiveTab('edit-existing');
    } catch (err: unknown) {
      const error = err as Error & { code?: string };
      if (error.name === 'AbortError' || error.message === 'Aborted') {
        cancelUpload();
        return;
      }

      setUploadStatus('idle');
      abortControllerRef.current = null;

      if (error.code === 'S3_NOT_CONFIGURED' || error.message.includes('S3_NOT_CONFIGURED') || error.message.includes('not configured')) {
        setS3Warning('S3 cloud storage service is not configured on the backend. Direct video uploads are currently unavailable.');
        toast.error('video.s3_upload', {
          description: 'S3 storage service is not configured',
        });
      } else {
        toast.error('video.s3_upload', {
          description: `Failed to upload video: ${error.message}`,
        });
      }
    }
  };

  const previewMutation = useMutation({
    mutationFn: (params: { sourceUrl: string; source: 'otakudesu' }) =>
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
      setDirectUrl('');
      setDirectLabel('');
      setDirectQuality('');
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

        <Tabs value={activeTab} onValueChange={(val) => setActiveTab(val as 'add-url' | 'add-direct' | 'upload-s3' | 'edit-existing')} className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="add-url">Add from URL</TabsTrigger>
            <TabsTrigger value="add-direct">Add Direct</TabsTrigger>
            <TabsTrigger value="upload-s3">Upload Video</TabsTrigger>
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
                            src.type === 's3'
                              ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400 border-purple-300 dark:border-purple-800'
                              : src.type === 'direct'
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

          <TabsContent value="add-direct" className="mt-4 space-y-3">
            <div className="p-3 border border-c rounded bg-card space-y-3">
              <div className="text-xs font-medium mono text-muted uppercase">Add Direct Video Source</div>

              <div>
                <Label htmlFor="direct-url" className="text-[10px] text-muted">Video URL</Label>
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
                  <Label htmlFor="direct-label" className="text-[10px] text-muted">Label</Label>
                  <Input
                    id="direct-label"
                    placeholder="e.g. Server A, 480p"
                    value={directLabel}
                    onChange={(e) => setDirectLabel(e.target.value)}
                    className="text-xs h-8"
                  />
                </div>
                <div>
                  <Label htmlFor="direct-quality" className="text-[10px] text-muted">Quality</Label>
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
                    episodeId: episode.id,
                    sources: [{
                      type: 'direct',
                      url: directUrl.trim(),
                      label: directLabel.trim(),
                      quality: directQuality.trim() || null,
                    }],
                  });
                }}
              >
                {saveSourcesMutation.isPending ? 'Saving...' : 'Add Video Source'}
              </Button>
            </div>
          </TabsContent>

          <TabsContent value="upload-s3" className="mt-4 space-y-3">
            <div className="p-3 border border-c rounded bg-card space-y-3">
              <div className="text-xs font-medium mono text-muted uppercase">Upload Video to S3</div>

              {s3Warning && (
                <div className="p-2.5 rounded border border-amber-200 dark:border-amber-900/50 bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-300 text-xs flex items-start gap-2">
                  <svg
                    className="w-4 h-4 shrink-0 mt-0.5 text-amber-600 dark:text-amber-400"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0zM12 9v4M12 17h.01" />
                  </svg>
                  <div>
                    <div className="font-semibold">S3 Storage Unconfigured</div>
                    <div className="text-[11px] mt-0.5">{s3Warning}</div>
                  </div>
                </div>
              )}

              {/* File Dropzone / Picker */}
              <div>
                <Label className="text-[10px] text-muted">Video File (.mp4, .mkv, .webm)</Label>
                <input
                  type="file"
                  ref={fileInputRef}
                  accept="video/mp4,video/webm,video/x-matroska,.mp4,.mkv,.webm"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0] || null;
                    handleFileSelect(file);
                  }}
                  disabled={isUploading}
                />
                <div
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    e.preventDefault();
                    if (isUploading) return;
                    const file = e.dataTransfer.files?.[0] || null;
                    handleFileSelect(file);
                  }}
                  onClick={() => {
                    if (!isUploading && fileInputRef.current) {
                      fileInputRef.current.click();
                    }
                  }}
                  className={`mt-1 border-2 border-dashed border-c rounded p-4 text-center cursor-pointer hover:border-primary transition-colors ${
                    isUploading ? 'opacity-50 cursor-not-allowed' : ''
                  }`}
                >
                  {selectedFile ? (
                    <div className="text-xs mono space-y-1">
                      <div className="font-semibold text-foreground truncate">{selectedFile.name}</div>
                      <div className="text-muted text-[11px]">
                        {(selectedFile.size / (1024 * 1024)).toFixed(1)} MB
                      </div>
                    </div>
                  ) : (
                    <div className="text-xs text-muted space-y-1">
                      <div className="font-medium text-foreground">Click to select or drag video here</div>
                      <div className="text-[10px]">Supports MP4, MKV, WebM</div>
                    </div>
                  )}
                </div>
              </div>

              {/* Form Fields */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label htmlFor="upload-label" className="text-[10px] text-muted">Label</Label>
                  <Input
                    id="upload-label"
                    placeholder="e.g. S3 High Quality"
                    value={uploadLabel}
                    onChange={(e) => setUploadLabel(e.target.value)}
                    disabled={isUploading}
                    className="text-xs h-8"
                  />
                </div>
                <div>
                  <Label htmlFor="upload-quality" className="text-[10px] text-muted">Quality</Label>
                  <Input
                    id="upload-quality"
                    placeholder="e.g. 1080p"
                    value={uploadQuality}
                    onChange={(e) => setUploadQuality(e.target.value)}
                    disabled={isUploading}
                    className="text-xs h-8"
                  />
                </div>
              </div>

              {/* Upload Progress Display */}
              {isUploading && (
                <div className="p-2.5 border border-c rounded bg-sidebar space-y-2 text-xs">
                  <div className="flex items-center justify-between mono">
                    <span className="font-semibold text-foreground">
                      {uploadStatus === 'presigning' && 'Presigning...'}
                      {uploadStatus === 'uploading' && 'Uploading to S3...'}
                      {uploadStatus === 'registering' && 'Registering source...'}
                    </span>
                    <span className="text-muted text-[11px]">
                      {(uploadProgress.loaded / (1024 * 1024)).toFixed(1)} MB / {(uploadProgress.total / (1024 * 1024)).toFixed(1)} MB ({uploadProgress.percent}%)
                    </span>
                  </div>
                  <div className="w-full bg-secondary rounded-full h-2 overflow-hidden">
                    <div
                      className="bg-primary h-2 transition-all duration-150"
                      style={{ width: `${uploadProgress.percent}%` }}
                    />
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex gap-2">
                {isUploading ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="destructive"
                    className="w-full text-xs h-8"
                    onClick={cancelUpload}
                  >
                    Cancel
                  </Button>
                ) : (
                  <Button
                    type="button"
                    size="sm"
                    variant="default"
                    className="w-full text-xs h-8"
                    disabled={!selectedFile || !uploadLabel.trim()}
                    onClick={handleUpload}
                  >
                    Upload
                  </Button>
                )}
              </div>
            </div>
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

