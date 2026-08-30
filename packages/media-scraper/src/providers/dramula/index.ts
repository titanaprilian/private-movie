import type {
  FetchFn,
  MediaProvider,
  ScrapedEpisode,
  ScrapedSeries,
  ScrapedVideoSource,
} from "../../types";
import { parseDramulaEpisodeHtml } from "./parse";

export * from "./parse";

export class DramulaProvider implements MediaProvider {
  public readonly name = "dramula";

  public canHandle(url: string): boolean {
    return url.includes("dramula");
  }

  public async parseSeries(
    url: string,
    fetchFn: FetchFn
  ): Promise<ScrapedSeries> {
    const html = await fetchFn.get(url);
    const episode = this.parseEpisodeHtml(html, url);
    return {
      title: episode.title,
      episodes: episode.episodes ?? [],
    };
  }

  public parseEpisodeHtml(html: string, url?: string): ScrapedEpisode {
    return parseDramulaEpisodeHtml(html, url);
  }

  public async parseEpisode(
    url: string,
    fetchFn: FetchFn
  ): Promise<ScrapedEpisode> {
    const html = await fetchFn.get(url);
    return this.parseEpisodeHtml(html, url);
  }

  public async resolveVideoSources(
    url: string,
    fetchFn: FetchFn,
    context?: Record<string, unknown>
  ): Promise<ScrapedVideoSource[]> {
    if (context?.videoSources && Array.isArray(context.videoSources)) {
      return context.videoSources as ScrapedVideoSource[];
    }
    const html = (context?.html as string) ?? (await fetchFn.get(url));
    const episode = this.parseEpisodeHtml(html, url);
    return episode.videoSources;
  }
}
