import * as cheerio from "cheerio";

export class SeriesParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SeriesParseError";
  }
}

export interface ParsedSeriesPage {
  title: string;
  posterUrl: string | null;
  description: string | null;
}

export const parseSeriesPage = (
  html: string,
  targetUrl?: string
): ParsedSeriesPage => {
  const load = cheerio.load(html, null, false);

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
        return { title, posterUrl, description };
      }
    }
  }

  // Strategy 2: Check single series page layout (#venkonten or .fotoanime)
  const singleTitle = load(".fotoanime h1, #venkonten h1.posttl, #venkonten h1, .jdlflm")
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
      };
    }
  }

  throw new SeriesParseError("missing series title");
};
