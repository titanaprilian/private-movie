import * as cheerio from "cheerio";
import { SeriesParseError } from "../../errors";
import type {
  FetchFn,
  MediaProvider,
  ScrapedEpisode,
  ScrapedEpisodeRef,
  ScrapedSeries,
  ScrapedVideoSource,
} from "../../types";
import {
  extractDirectVideoSources,
  mappedEpisodePageToScrapedEpisode,
  parseEpisodePage,
  type ParsedAjaxActions,
  type ParsedMirrorPayload,
} from "./parse";
import { resolveMirrors } from "./resolve";

export * from "./parse";
export * from "./resolve";

export class OtakudesuProvider implements MediaProvider {
  public readonly name = "otakudesu";

  public canHandle(url: string): boolean {
    return url.includes("otakudesu");
  }

  public parseSeriesHtml(html: string, targetUrl?: string): ScrapedSeries {
    const load = cheerio.load(html, null, false);

    const episodes: ScrapedEpisodeRef[] = [];
    load(".episodelist ul li").each((_, li) => {
      const anchor = load(li).find("span a, a").first();
      if (anchor.length === 0) return;

      const url = anchor.attr("href");
      const title = anchor.text().trim();
      if (!url || !title) return;

      const dateText = load(li).find(".zeebr").text().trim();
      const date = dateText ? dateText : null;

      episodes.push({
        title,
        url,
        date,
      });
    });

    // Strategy 1: Search list items (e.g. sample-series-list.html) for link matching targetUrl
    if (targetUrl) {
      const normalizedTarget = targetUrl.replace(/\/$/, "");
      const matchingLink = load("a")
        .filter((_, el) => {
          const href = load(el).attr("href");
          if (!href) return false;
          return href.replace(/\/$/, "") === normalizedTarget;
        })
        .first();

      if (matchingLink.length > 0) {
        const container = matchingLink.closest("li, .detpost, .thumb");
        const title =
          matchingLink.find("h2.jdlflm").text().trim() ||
          matchingLink.text().trim() ||
          matchingLink.attr("title") ||
          "";
        const posterUrl =
          matchingLink.find("img").attr("src") ||
          container.find("img").attr("src") ||
          null;
        const description = container.find(".sinopc").text().trim() || null;
        if (title) {
          return { title, posterUrl, description, episodes };
        }
      }
    }

    // Strategy 2: Check single series page layout (#venkonten or .fotoanime)
    const singleTitle = load(
      ".fotoanime h1, #venkonten h1.posttl, #venkonten h1, .jdlflm"
    )
      .first()
      .text()
      .trim();
    const singlePoster = load(
      ".fotoanime img, #venkonten .thumb img, .imghdr img, img.wp-post-image"
    )
      .first()
      .attr("src");
    const singleDesc =
      load(".sinopc, .sinopsis, .infozingle").text().trim() || null;

    if (singleTitle) {
      return {
        title: singleTitle,
        posterUrl: singlePoster || null,
        description: singleDesc,
        episodes,
      };
    }

    // Strategy 3: Fallback to first series item on a list page
    const firstLink = load(".venz li a, .detpost a").first();
    if (firstLink.length > 0) {
      const title =
        firstLink.find("h2.jdlflm").text().trim() ||
        firstLink.text().trim() ||
        firstLink.attr("title");
      const posterUrl = firstLink.find("img").attr("src") || null;
      if (title) {
        return {
          title,
          posterUrl,
          description: null,
          episodes,
        };
      }
    }

    throw new SeriesParseError("missing series title");
  }

  public async parseSeries(
    url: string,
    fetchFn: FetchFn
  ): Promise<ScrapedSeries> {
    const html = await fetchFn.get(url);
    return this.parseSeriesHtml(html, url);
  }

  public parseEpisodeHtml(html: string): ScrapedEpisode {
    const parsed = parseEpisodePage(html);
    return mappedEpisodePageToScrapedEpisode(parsed);
  }

  public async parseEpisode(
    url: string,
    fetchFn: FetchFn
  ): Promise<ScrapedEpisode> {
    const html = await fetchFn.get(url);
    return this.parseEpisodeHtml(html);
  }

  public async resolveVideoSources(
    url: string,
    fetchFn: FetchFn,
    context?: Record<string, unknown>
  ): Promise<ScrapedVideoSource[]> {
    let mirrorPayloads: ParsedMirrorPayload[] | undefined = context?.mirrorPayloads as
      | ParsedMirrorPayload[]
      | undefined;
    let ajaxActions: ParsedAjaxActions | null | undefined = context?.ajaxActions as
      | ParsedAjaxActions
      | null
      | undefined;
    let initialSources: ScrapedVideoSource[] =
      (context?.initialSources as ScrapedVideoSource[]) ?? [];

    if (!mirrorPayloads || ajaxActions === undefined) {
      const html = (context?.html as string) ?? (await fetchFn.get(url));
      const parsed = parseEpisodePage(html);
      mirrorPayloads = parsed.mirrorPayloads;
      ajaxActions = parsed.ajaxActions;
      if (initialSources.length === 0) {
        initialSources = parsed.videoSources;
      }
    }

    let embedSources: ScrapedVideoSource[] = [];

    if (ajaxActions && mirrorPayloads && mirrorPayloads.length > 0) {
      const resolved = await resolveMirrors({
        payloads: mirrorPayloads,
        fetchFn,
        nonceAction: ajaxActions.nonceAction,
        mirrorAction: ajaxActions.mirrorAction,
      });

      embedSources = resolved.map((m) => ({
        type: "embed" as const,
        url: m.url,
        label: m.label,
      }));
    } else {
      embedSources = initialSources;
    }

    const directSources: ScrapedVideoSource[] = [];
    for (const source of embedSources) {
      try {
        const iframeHtml = await fetchFn.get(source.url);
        const extracted = extractDirectVideoSources(iframeHtml);
        directSources.push(...extracted);
      } catch {
        // Ignore fetch errors for individual embed iframe URLs
      }
    }

    return [...embedSources, ...directSources];
  }
}
