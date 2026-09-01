import * as cheerio from "cheerio";
import type {
  FetchFn,
  MediaProvider,
  ScrapedEpisode,
  ScrapedSeries,
  ScrapedVideoSource,
  BrowserFn,
} from "../../types";
import { parseDramulaEpisodeHtml, resolveVideobelloHash } from "./parse";

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
        } catch {
          // fall through if browserFn fails
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

    const html = (context?.html as string) ?? (await fetchFn.get(url));

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
          } catch {
            // fall through to resolveVideobelloHash
          }
        }

        const extractedHash = await resolveVideobelloHash(html, url, fetchFn);
        return {
          ...source,
          url: source.url.replace(".00000000", `.${extractedHash}`),
        };
      })
    );

    return resolvedSources;
  }
}
