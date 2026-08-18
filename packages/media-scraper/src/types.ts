export interface FetchFn {
  get(url: string): Promise<string>;
  post(url: string, body: string): Promise<string>;
}

export interface ScrapedEpisodeRef {
  title: string;
  url: string;
  date?: string | null;
}

export interface ScrapedSeries {
  title: string;
  posterUrl?: string | null;
  description?: string | null;
  episodes: ScrapedEpisodeRef[];
  providerData?: Record<string, unknown>;
}

export interface ScrapedVideoSource {
  type: "embed" | "direct";
  url: string;
  label: string;
  quality?: string | null;
}

export interface ScrapedDownloadHost {
  host: string;
  url: string;
}

export interface ScrapedDownloadLink {
  quality: string;
  size?: string | null;
  hosts: ScrapedDownloadHost[];
}

export interface ScrapedEpisode {
  title: string;
  videoSources: ScrapedVideoSource[];
  videoType?: string | null;
  genres?: string[];
  duration?: string | null;
  posterUrl?: string | null;
  animePageUrl?: string | null;
  downloadLinks?: ScrapedDownloadLink[];
  episodes?: ScrapedEpisodeRef[];
  providerData?: Record<string, unknown>;
}

export interface MediaProvider {
  name: string;
  canHandle(url: string): boolean;
  parseSeries(url: string, fetchFn: FetchFn): Promise<ScrapedSeries>;
  parseEpisode(url: string, fetchFn: FetchFn): Promise<ScrapedEpisode>;
  resolveVideoSources(
    url: string,
    fetchFn: FetchFn,
    context?: Record<string, unknown>
  ): Promise<ScrapedVideoSource[]>;
}
