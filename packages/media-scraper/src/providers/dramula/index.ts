import * as cheerio from "cheerio";
import type {
  FetchFn,
  MediaProvider,
  ScrapedEpisode,
  ScrapedSeries,
  ScrapedVideoSource,
  BrowserFn,
} from "../../types";
import { EpisodeParseError } from "../../errors";
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
    let sources: ScrapedVideoSource[] = [];

    if (context?.videoSources && Array.isArray(context.videoSources)) {
      sources = context.videoSources as ScrapedVideoSource[];
    } else {
      if (browserFn) {
        try {
          const hydratedHtml = await browserFn(url);
          const $ = cheerio.load(hydratedHtml);
          const iframeSrc = $("iframe[src]").first().attr("src");
          if (iframeSrc && !iframeSrc.includes(".00000000")) {
            sources = [
              {
                type: "embed",
                url: iframeSrc,
                label: "BelloCloud",
              },
            ];
          }
        } catch (err) {
          console.error(`[dramula] browserFn failed for ${url}:`, err);
          // fall through to static HTML parsing
        }
      }

      if (sources.length === 0) {
        const html = (context?.html as string) ?? (await fetchFn.get(url));
        const episode = await this.parseEpisodeHtml(html, url, fetchFn);
        sources = episode.videoSources;
      }
    }

    const hasUnresolved = sources.some((s) => s.url.includes(".00000000"));
    if (!hasUnresolved) {
      return sources;
    }

    const resolvedSources = await Promise.all(
      sources.map(async (source) => {
        if (!source.url.includes(".00000000")) {
          return source;
        }

        if (browserFn) {
          try {
            const hydratedHtml = await browserFn(url);
            const $ = cheerio.load(hydratedHtml);
            const iframeSrc = $("iframe[src]").first().attr("src");
            if (iframeSrc && !iframeSrc.includes(".00000000")) {
              return {
                ...source,
                url: iframeSrc,
              };
            }
          } catch (err) {
            console.error(
              `[dramula] browserFn failed to resolve videobello source for ${url}:`,
              err
            );
            throw new EpisodeParseError(
              `Failed to resolve videobello source for ${url}: browser rendering failed`
            );
          }
        }

        throw new EpisodeParseError(
          `Failed to resolve videobello source for ${url}: browser rendering is required but browserFn did not resolve the .00000000 placeholder`
        );
      })
    );

    return resolvedSources;
  }
}
