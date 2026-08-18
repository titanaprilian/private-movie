import * as cheerio from "cheerio";
import type { CheerioAPI } from "cheerio";

export class EpisodeParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "EpisodeParseError";
  }
}

export class EpisodeMissingFieldsError extends Error {
  missingFields: string[];

  constructor(missingFields: string[]) {
    super(`Missing episode fields: ${missingFields.join(", ")}`);
    this.name = "EpisodeMissingFieldsError";
    this.missingFields = missingFields;
  }
}

export type ParsedEpisode = { label: string; url: string };
export type ParsedHost = { host: string; url: string };
export type ParsedDownloadLink = {
  quality: string;
  size: string | null;
  hosts: ParsedHost[];
};

export type ParsedVideoSource = {
  type: "embed" | "direct";
  url: string;
  label: string;
  quality?: string | null;
};

export type ParsedMirrorPayload = {
  id: number;
  i: number;
  q: string;
  label: string;
};

export type ParsedAjaxActions = {
  nonceAction: string;
  mirrorAction: string;
};

export type ParsedMetadata = {
  genres?: string[];
  duration?: string;
  posterUrl?: string;
  episodes?: ParsedEpisode[];
  animePageUrl?: string;
  downloadLinks?: ParsedDownloadLink[];
};

export type ParsedEpisodePage = {
  title: string;
  videoSources: ParsedVideoSource[];
  videoType: string | null;
  metadata: ParsedMetadata;
  mirrorPayloads: ParsedMirrorPayload[];
  ajaxActions: ParsedAjaxActions | null;
};

const readInfoRow = (
  box: ParsedPage,
  load: CheerioAPI,
  label: string
): string | null => {
  const row = box
    .find(".infozingle b")
    .filter((_, el) => load(el).text().trim() === label)
    .first()
    .parent();
  if (row.length === 0) return null;
  const text = row
    .text()
    .replace(label, "")
    .replace(":", "")
    .trim();
  return text || null;
};

type ParsedPage = ReturnType<ReturnType<typeof cheerio.load>>;

export function parseEpisodeOrder(title: string): number | null {
  const match = title.match(/(?:episode|eps|ep|#)\.?\s*(\d+)/i);
  if (match) {
    const num = parseInt(match[1], 10);
    if (!Number.isNaN(num)) return num;
  }

  const numMatch = title.match(/\b(\d+)\b/);
  if (numMatch) {
    const num = parseInt(numMatch[1], 10);
    if (!Number.isNaN(num) && (num < 1900 || num > 2100)) return num;
  }

  return null;
}

const decodeMirrorContent = (
  encoded: string
): Omit<ParsedMirrorPayload, "label"> => {
  const json = Buffer.from(encoded, "base64").toString("utf8");
  const parsed = JSON.parse(json) as { id: number; i: number; q: string };
  return { id: parsed.id, i: parsed.i, q: parsed.q };
};

const extractMirrorPayloads = (
  box: ParsedPage,
  load: CheerioAPI
): ParsedMirrorPayload[] =>
  box
    .find(".mirrorstream .m720p li a[data-content]")
    .map((_, el) => {
      const encoded = load(el).attr("data-content") as string;
      const label = load(el).text().trim();
      return { ...decodeMirrorContent(encoded), label };
    })
    .get();

const QUALITY_PATTERN = /(?:^|[^a-zA-Z])(\d{3,4}p)(?:$|[^a-zA-Z])/i;

export function extractDirectVideoSources(
  html: string
): ParsedVideoSource[] {
  const load = cheerio.load(html, null, false);
  const sources: ParsedVideoSource[] = [];

  // Extract from JS <script> block first (typical for desustream.net Playerjs)
  const scripts = load("script:not([src])").get();
  for (const script of scripts) {
    const content = load(script).html();
    if (!content) continue;

    // Look for `file:"https://...mp4"` or `file: "https://...mp4"` or `file:'...'`
    const match = content.match(/file\s*:\s*["']([^"']+\.mp4)["']/i);
    if (match && match[1]) {
      const src = match[1];
      try {
        const urlObj = new URL(src);
        const pathname = urlObj.pathname;
        const extIndex = pathname.lastIndexOf(".mp4");
        if (extIndex !== -1) {
          const label = pathname.substring(pathname.lastIndexOf("/") + 1, extIndex);
          const qualityMatch = label.match(QUALITY_PATTERN);
          const quality = qualityMatch ? qualityMatch[1].toLowerCase() : null;

          sources.push({ type: "direct", url: src, label, quality });
          // If we found it in JS, we can stop searching scripts
          break;
        }
      } catch {
        // invalid URL, keep searching
      }
    }
  }

  // Also check for literal <video src="..."> tags (as a fallback)
  load("video[src]").each((_, el) => {
    const src = load(el).attr("src");
    if (!src || !src.endsWith(".mp4")) return;
    
    // Avoid adding duplicates if we already found the same URL in JS
    if (sources.some(s => s.url === src)) return;

    try {
      const urlObj = new URL(src);
      const pathname = urlObj.pathname;
      const extIndex = pathname.lastIndexOf(".mp4");
      if (extIndex === -1) return;

      const label = pathname.substring(pathname.lastIndexOf("/") + 1, extIndex);

      const qualityMatch = label.match(QUALITY_PATTERN);
      const quality = qualityMatch ? qualityMatch[1].toLowerCase() : null;

      sources.push({ type: "direct", url: src, label, quality });
    } catch {
      return;
    }
  });

  return sources;
}

export const extractAjaxActions = (html: string): ParsedAjaxActions | null => {
  const load = cheerio.load(html, null, false);
  const scriptContent = load("script")
    .map((_, el) => load(el).html() ?? "")
    .get()
    .join("\n");
  if (!scriptContent) return null;

  const nonceAction = scriptContent.match(
    /\{\s*action\s*:\s*["']([a-f0-9]{32})["']\s*\}/
  )?.[1];
  const mirrorAction = scriptContent.match(
    /\{[^}]*nonce\s*:[^}]*action\s*:\s*["']([a-f0-9]{32})["']/
  )?.[1];
  if (!nonceAction || !mirrorAction) return null;

  return { nonceAction, mirrorAction };
};

export const parseEpisodePage = (html: string): ParsedEpisodePage => {
  const load = cheerio.load(html, null, false);
  const box = load("#venkonten");
  if (box.length === 0) {
    throw new EpisodeParseError("missing #venkonten container");
  }

  const title = box.find("h1.posttl").text().trim();
  if (!title) {
    throw new EpisodeParseError("missing title");
  }

  const embedUrl = box.find(".responsive-embed-stream iframe").attr("src");
  if (!embedUrl) {
    throw new EpisodeParseError("missing iframe src");
  }

  const videoSources: ParsedVideoSource[] = [
    {
      type: "embed",
      url: embedUrl,
      label: "Server Embed",
    },
  ];

  const videoType = readInfoRow(box, load, "Tipe");
  const duration = readInfoRow(box, load, "Duration");

  const metadata: ParsedMetadata = {};

  const genres = box
    .find(".infozingle b")
    .filter((_, el) => load(el).text().trim() === "Genres")
    .parent()
    .find("a")
    .map((_, el) => load(el).text().trim())
    .get();
  if (genres.length > 0) metadata.genres = genres;

  if (duration) metadata.duration = duration;

  const posterUrl = box.find(".cukder img").attr("src");
  if (posterUrl) metadata.posterUrl = posterUrl;

  const episodes = box
    .find("#selectcog option[value]")
    .map((_, el) => ({
      label: load(el).text().trim(),
      url: load(el).attr("value") as string,
    }))
    .get()
    .filter((entry) => entry.url !== "0" && entry.url.startsWith("http"));
  if (episodes.length > 0) metadata.episodes = episodes;

  const animePageUrl =
    box
      .find(".prevnext .flir a:contains('See All Episodes')")
      .attr("href") ?? undefined;
  if (animePageUrl) metadata.animePageUrl = animePageUrl;

  const downloadLinks = box
    .find(".download li")
    .map((_, el) => {
      const quality = load(el).find("strong").first().text().trim();
      const size = load(el).find("i").first().text().trim() || null;
      const hosts = load(el)
        .find("a")
        .map((_, a) => ({
          host: load(a).text().trim(),
          url: load(a).attr("href") as string,
        }))
        .get();
      return { quality, size, hosts };
    })
    .get();

  if (downloadLinks.length > 0) {
    metadata.downloadLinks = downloadLinks;
  }

  const mirrorPayloads = extractMirrorPayloads(box, load);
  const ajaxActions = extractAjaxActions(html);

  return { title, videoSources, videoType, metadata, mirrorPayloads, ajaxActions };
};