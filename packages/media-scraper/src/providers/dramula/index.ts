import * as cheerio from "cheerio";
import type {
  FetchFn,
  MediaProvider,
  ScrapedEpisode,
  ScrapedSeries,
  ScrapedVideoSource,
  BrowserFn,
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
    const episode = await this.parseEpisodeHtml(html, url, fetchFn);
    return {
      title: episode.title,
      episodes: episode.episodes ?? [],
    };
  }

  public async parseEpisodeHtml(
    html: string,
    url?: string,
    fetchFn?: FetchFn
  ): Promise<ScrapedEpisode> {
    return await parseDramulaEpisodeHtml(html, url, fetchFn);
  }

  public async parseEpisode(
    url: string,
    fetchFn: FetchFn
  ): Promise<ScrapedEpisode> {
    const html = await fetchFn.get(url);
    return await this.parseEpisodeHtml(html, url, fetchFn);
  }

  public async resolveVideoSources(
    url: string,
    fetchFn: FetchFn,
    context?: Record<string, unknown>,
    browserFn?: BrowserFn
  ): Promise<ScrapedVideoSource[]> {
    if (context?.videoSources && Array.isArray(context.videoSources)) {
      return context.videoSources as ScrapedVideoSource[];
    }

    if (browserFn) {
      const hydratedHtml = await browserFn(url);
      const $ = cheerio.load(hydratedHtml);
      const iframeSrc = $("iframe[src]").first().attr("src");
      if (iframeSrc) {
        return [
          {
            type: "embed",
            url: iframeSrc,
            label: "BelloCloud",
          },
        ];
      }
    }

    const html = (context?.html as string) ?? (await fetchFn.get(url));
    const episode = await this.parseEpisodeHtml(html, url, fetchFn);
    return episode.videoSources;
  }
}
