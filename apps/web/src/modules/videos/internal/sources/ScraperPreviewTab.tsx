import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { SCRAPER_PROVIDERS, type ScraperProvider } from '@repo/contracts';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { previewScrape, addVideoSources, type VideoSourceInput } from '../api';

const PROVIDER_META: Record<string, { label: string; placeholder: string }> = {
  otakudesu: { label: 'Otakudesu', placeholder: 'https://otakudesu.cloud/episode/...' },
  dramula: { label: 'Dramula', placeholder: 'https://dramula.com/watch/...' },
};

function getProviderMeta(provider: string): { label: string; placeholder: string } {
  return PROVIDER_META[provider] ?? { label: provider, placeholder: 'https://...' };
}

export interface ScraperPreviewTabProps {
  episodeId: string;
  seriesId: string;
  onSuccess: () => void;
}

export function ScraperPreviewTab({ episodeId, seriesId, onSuccess }: ScraperPreviewTabProps) {
  const queryClient = useQueryClient();
  const [scrapeUrl, setScrapeUrl] = useState('');
  const [selectedProvider, setSelectedProvider] = useState<ScraperProvider>('otakudesu');
  const [providerPopoverOpen, setProviderPopoverOpen] = useState(false);
  const [extractedSources, setExtractedSources] = useState<VideoSourceInput[] | null>(null);
  const [previewWarnings, setPreviewWarnings] = useState<string[]>([]);

  const providerMeta = getProviderMeta(selectedProvider);

  const handleSelectProvider = (provider: ScraperProvider) => {
    setSelectedProvider(provider);
    setProviderPopoverOpen(false);
    setExtractedSources(null);
    setPreviewWarnings([]);
  };

  const previewMutation = useMutation({
    mutationFn: (params: { sourceUrl: string; source: ScraperProvider }) =>
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
      setExtractedSources(null);
      setPreviewWarnings([]);
      onSuccess();
    },
    onError: (error) => {
      toast.error('video.source_add', {
        description: `Failed to save sources: ${error.message}`,
      });
    },
  });

  return (
    <div className="space-y-3">
      <div className="p-3 border border-c rounded bg-sidebar space-y-3">
        <div className="text-xs font-medium mono text-muted uppercase">
          Scrape {providerMeta.label} URL
        </div>

        <div>
          <Label htmlFor="scrape-provider" className="text-[10px] text-muted">
            Provider
          </Label>
          <Popover open={providerPopoverOpen} onOpenChange={setProviderPopoverOpen}>
            <PopoverTrigger asChild>
              <button
                type="button"
                id="scrape-provider"
                role="combobox"
                aria-expanded={providerPopoverOpen}
                aria-label="Select scraper provider"
                className="w-full px-3 h-8 rounded border border-c bg-transparent text-xs mono font-medium hover-bg flex items-center justify-between gap-1.5 cursor-pointer text-foreground"
              >
                <span>{providerMeta.label}</span>
                <svg
                  width="12"
                  height="12"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <polyline points="6 9 12 15 18 9" />
                </svg>
              </button>
            </PopoverTrigger>
            <PopoverContent className="w-56 p-0" align="start">
              <Command>
                <CommandInput placeholder="Search providers..." />
                <CommandList>
                  <CommandEmpty>No provider found.</CommandEmpty>
                  <CommandGroup>
                    {SCRAPER_PROVIDERS.map((provider) => {
                      const meta = getProviderMeta(provider);
                      const isSelected = provider === selectedProvider;
                      return (
                        <CommandItem
                          key={provider}
                          value={meta.label}
                          onSelect={() => handleSelectProvider(provider)}
                          className="flex items-center gap-2 px-2 py-1.5 cursor-pointer"
                        >
                          <span
                            className={`w-3 h-3 shrink-0 ${
                              isSelected ? 'opacity-100' : 'opacity-0'
                            }`}
                          >
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                              <polyline points="20 6 9 17 4 12" />
                            </svg>
                          </span>
                          <span className="text-xs mono">{meta.label}</span>
                        </CommandItem>
                      );
                    })}
                  </CommandGroup>
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>
        </div>

        <div>
          <Label htmlFor="scrape-url" className="text-[10px] text-muted">
            {providerMeta.label} URL
          </Label>
          <Input
            id="scrape-url"
            placeholder={providerMeta.placeholder}
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
              source: selectedProvider,
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
                <div
                  key={i}
                  className="p-2 bg-sidebar rounded border border-c text-xs mono flex items-center justify-between gap-2"
                >
                  <div className="flex items-center gap-2 truncate">
                    <span
                      className={`text-[9px] px-1.5 py-0.5 rounded border uppercase font-medium ${
                        src.type === 's3'
                          ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400 border-purple-300 dark:border-purple-800'
                          : src.type === 'direct'
                          ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 border-green-300 dark:border-green-800'
                          : 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 border-blue-300 dark:border-blue-800'
                      }`}
                    >
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
                episodeId,
                sources: extractedSources,
              });
            }}
          >
            {saveSourcesMutation.isPending ? 'Saving...' : 'Save Sources'}
          </Button>
        </div>
      )}
    </div>
  );
}
