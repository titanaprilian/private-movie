import * as cheerio from "cheerio";
import { EpisodeParseError } from "../../errors";
import type {
  FetchFn,
  ScrapedEpisode,
  ScrapedEpisodeRef,
  ScrapedVideoSource,
} from "../../types";

export function formatDramulaUrl(
  rawUrlOrPath: string,
  showSlug?: string
): string {
  const trimmed = rawUrlOrPath.trim();
  if (!trimmed) return "";

  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
    try {
      const parsedUrl = new URL(trimmed);
      if (parsedUrl.hostname.includes("dramula.com")) {
        return `https://dramula.com${parsedUrl.pathname}${parsedUrl.search}${parsedUrl.hash}`;
      }
      return trimmed;
    } catch {
      return trimmed;
    }
  }

  if (trimmed.startsWith("/watch/")) {
    return `https://dramula.com${trimmed}`;
  }
  if (trimmed.startsWith("watch/")) {
    return `https://dramula.com/${trimmed}`;
  }
  if (trimmed.startsWith("/")) {
    return `https://dramula.com${trimmed}`;
  }

  if (showSlug && !trimmed.includes("/")) {
    return `https://dramula.com/watch/${showSlug}/${trimmed}`;
  }
  if (trimmed.includes("/")) {
    return `https://dramula.com/watch/${trimmed}`;
  }

  return `https://dramula.com/watch/${trimmed}`;
}

function extractEpisodesFromPayload(
  payload: any,
  showSlugFromUrl?: string
): ScrapedEpisodeRef[] {
  const result: ScrapedEpisodeRef[] = [];
  if (!payload || typeof payload !== "object") return result;

  const showSlug =
    payload?.data?.slug ||
    payload?.slug ||
    payload?.data?.show?.slug ||
    payload?.data?.title?.slug ||
    payload?.show?.slug ||
    showSlugFromUrl ||
    "";

  let rawEpisodes: any[] = [];

  if (Array.isArray(payload)) {
    rawEpisodes = payload;
  } else if (Array.isArray(payload.data)) {
    rawEpisodes = payload.data;
  } else if (Array.isArray(payload.episodes)) {
    rawEpisodes = payload.episodes;
  } else if (Array.isArray(payload.data?.episodes)) {
    rawEpisodes = payload.data.episodes;
  } else if (Array.isArray(payload.data?.seasons)) {
    for (const season of payload.data.seasons) {
      if (Array.isArray(season?.episodes)) {
        rawEpisodes.push(...season.episodes);
      }
    }
  } else if (Array.isArray(payload.seasons)) {
    for (const season of payload.seasons) {
      if (Array.isArray(season?.episodes)) {
        rawEpisodes.push(...season.episodes);
      }
    }
  }

  for (const ep of rawEpisodes) {
    if (!ep || typeof ep !== "object") continue;

    const itemShowSlug =
      ep.show?.title_slug ||
      ep.show_slug ||
      ep.show?.slug ||
      ep.title_slug ||
      showSlug;

    const rawTitle =
      ep.title ??
      ep.name ??
      (ep.episode_number != null ? String(ep.episode_number) : null) ??
      (ep.number != null ? String(ep.number) : null) ??
      (ep.label != null ? String(ep.label) : null);

    const title = rawTitle ? String(rawTitle).trim() : "";
    const rawPath = ep.url || ep.href || ep.path || ep.link || ep.slug;

    if (title && rawPath && typeof rawPath === "string") {
      const formattedUrl = formatDramulaUrl(rawPath, itemShowSlug);
      if (formattedUrl && !result.some((e) => e.url === formattedUrl)) {
        result.push({
          title,
          url: formattedUrl,
        });
      }
    }
  }

  return result;
}

function normalizeBundleUrl(rawPath: string, pageUrl?: string): string | null {
  const origin = pageUrl ? new URL(pageUrl).origin : "https://dramula.com";
  let cleanPath = rawPath.trim();
  if (cleanPath.startsWith("http://") || cleanPath.startsWith("https://")) {
    return cleanPath;
  }
  if (cleanPath.includes("_app/")) {
    const idx = cleanPath.indexOf("_app/");
    cleanPath = "/" + cleanPath.slice(idx);
  }
  try {
    return new URL(cleanPath, origin).href;
  } catch {
    return null;
  }
}

export function extractJsBundleUrls(html: string, pageUrl?: string): string[] {
  const urls = new Set<string>();

  const $ = cheerio.load(html);

  $("script[src]").each((_, el) => {
    const src = $(el).attr("src");
    if (src && (src.includes(".js") || src.includes("_app/"))) {
      const normalized = normalizeBundleUrl(src, pageUrl);
      if (normalized) urls.add(normalized);
    }
  });

  $("link[href]").each((_, el) => {
    const href = $(el).attr("href");
    const rel = $(el).attr("rel");
    if (
      href &&
      (href.includes(".js") ||
        href.includes("_app/") ||
        rel === "modulepreload")
    ) {
      const normalized = normalizeBundleUrl(href, pageUrl);
      if (normalized) urls.add(normalized);
    }
  });

  const appImmutableRegex =
    /(?:import\s*\(?\s*["']|src=["']|href=["'])([^"']*?_app\/immutable\/[^"']+\.js[^"']*?)["']/g;
  let match: RegExpExecArray | null;
  while ((match = appImmutableRegex.exec(html)) !== null) {
    const matchedPath = match[1];
    if (matchedPath) {
      const normalized = normalizeBundleUrl(matchedPath, pageUrl);
      if (normalized) urls.add(normalized);
    }
  }

  return Array.from(urls);
}

export function extractVideobelloHashFromJs(jsContent: string): string | null {
  if (!jsContent) return null;

  const urlMatch = jsContent.match(
    /videobello\.net\/embed\/[^\s"'`]*?\.([a-zA-Z0-9]{8})(?:[\?&"'`\/\s]|$)/i
  );
  if (urlMatch && urlMatch[1]) {
    return urlMatch[1];
  }

  const sourceMatch = jsContent.match(/\.([a-zA-Z0-9]{8})\?source=/i);
  if (sourceMatch && sourceMatch[1]) {
    return sourceMatch[1];
  }

  if (jsContent.toLowerCase().includes("videobello")) {
    const dotHashMatch = jsContent.match(
      /videobello[\s\S]{1,500}?\.["']?([a-zA-Z0-9]{8})["']?/i
    );
    if (dotHashMatch && dotHashMatch[1]) {
      return dotHashMatch[1];
    }

    const nearMatch = jsContent.match(
      /videobello[\s\S]{1,300}?["']([a-zA-Z0-9]{8})["']/i
    );
    if (nearMatch && nearMatch[1]) {
      return nearMatch[1];
    }
  }

  return null;
}

export async function resolveVideobelloHash(
  html: string,
  url?: string,
  fetchFn?: FetchFn
): Promise<string> {
  if (!fetchFn) {
    throw new EpisodeParseError(
      "fetchFn is required to resolve videobello hash from JS bundles"
    );
  }

  const bundleUrls = extractJsBundleUrls(html, url);
  if (bundleUrls.length === 0) {
    throw new EpisodeParseError(
      "No Svelte JS bundles found in HTML to resolve videobello hash"
    );
  }

  const visited = new Set<string>();
  const queue = [...bundleUrls];

  while (queue.length > 0) {
    const bundleUrl = queue.shift()!;
    if (visited.has(bundleUrl)) continue;
    visited.add(bundleUrl);

    let jsContent: string;
    try {
      jsContent = await fetchFn.get(bundleUrl);
    } catch {
      continue;
    }

    const hash = extractVideobelloHashFromJs(jsContent);
    if (hash) {
      return hash;
    }

    const subImportRegex =
      /(?:import\s*\(?\s*["']|from\s*["'])([^"']+\.js)/g;
    let match: RegExpExecArray | null;
    while ((match = subImportRegex.exec(jsContent)) !== null) {
      const subPath = match[1];
      const normalized = normalizeBundleUrl(subPath, bundleUrl);
      if (normalized && !visited.has(normalized)) {
        queue.push(normalized);
      }
    }
  }

  throw new EpisodeParseError(
    "Failed to extract videobello hash from Svelte JS bundles"
  );
}

export async function parseDramulaEpisodeHtml(
  html: string,
  url?: string,
  fetchFn?: FetchFn
): Promise<ScrapedEpisode> {
  const $ = cheerio.load(html);

  const title =
    $('ol span[aria-current="page"]').first().text().trim() ||
    $("p.text-sm.font-semibold.text-foreground").first().text().trim() ||
    $("h1").first().text().trim() ||
    "Episode";

  const iframeSrc = $("iframe[src]").first().attr("src");

  let activeServerLabel = "";

  $("span")
    .filter((_, el) => $(el).text().trim().toLowerCase().includes("server:"))
    .parent()
    .find("button")
    .each((_, el) => {
      const txt = $(el).text().trim();
      if (txt) {
        activeServerLabel = txt;
        return false;
      }
    });

  if (!activeServerLabel) {
    $("button")
      .filter((_, el) => {
        const cls = $(el).attr("class") || "";
        const txt = $(el).text().trim().toLowerCase();
        return (
          cls.includes("bg-primary") &&
          !txt.includes("login") &&
          !txt.includes("filter")
        );
      })
      .first()
      .each((_, el) => {
        activeServerLabel = $(el).text().trim();
      });
  }

  if (!activeServerLabel) {
    activeServerLabel = "Embed";
  }

  const videoSources: ScrapedVideoSource[] = iframeSrc
    ? [
        {
          type: "embed",
          url: iframeSrc,
          label: activeServerLabel,
        },
      ]
    : [];

  const episodes: ScrapedEpisodeRef[] = [];
  $(".episode-tile").each((_, el) => {
    const href = $(el).attr("href");
    const episodeTitle = $(el).text().trim();
    if (href && episodeTitle) {
      const formattedUrl = formatDramulaUrl(href);
      if (!episodes.some((e) => e.url === formattedUrl)) {
        episodes.push({
          title: episodeTitle,
          url: formattedUrl,
        });
      }
    }
  });

  if (episodes.length === 0 || videoSources.length === 0) {
    const targetUrl =
      url ||
      $("link[rel='canonical']").attr("href") ||
      $("meta[property='og:url']").attr("content") ||
      "";
    const cleanPath = targetUrl.split("?")[0].split("#")[0].replace(/\/+$/, "");
    const targetEpisodeSlug = cleanPath ? cleanPath.split("/").pop() || "" : "";

    $("script[data-sveltekit-fetched]").each((_, el) => {
      const content = $(el).html();
      if (!content) return;

      const dataUrl = $(el).attr("data-url") || "";
      let showSlugFromDataUrl = "";
      const match = dataUrl.match(/\/(?:shows|titles)\/([^/?#]+)/);
      if (match) {
        showSlugFromDataUrl = match[1];
      }
      if (!showSlugFromDataUrl) {
        const canonical =
          $("link[rel='canonical']").attr("href") ||
          $("meta[property='og:url']").attr("content") ||
          "";
        const canonicalMatch = canonical.match(/\/watch\/([^/?#]+)/);
        if (canonicalMatch) {
          showSlugFromDataUrl = canonicalMatch[1];
        }
      }

      try {
        const parsed = JSON.parse(content);
        let bodyObj = parsed.body;
        if (typeof bodyObj === "string") {
          try {
            bodyObj = JSON.parse(bodyObj);
          } catch {
            // ignore
          }
        }

        if (!bodyObj) return;

        if (episodes.length === 0) {
          const extractedList = extractEpisodesFromPayload(
            bodyObj,
            showSlugFromDataUrl
          );
          for (const item of extractedList) {
            if (!episodes.some((e) => e.url === item.url)) {
              episodes.push(item);
            }
          }
        }

        if (videoSources.length === 0 && targetEpisodeSlug) {
          const matchingEp = findMatchingEpisodeInPayload(
            bodyObj,
            targetEpisodeSlug
          );
          if (matchingEp) {
            const epId = matchingEp.id ?? matchingEp.episode_id;
            if (epId != null) {
              const b64 = Buffer.from(`episode:${epId}`)
                .toString("base64")
                .replace(/=+$/, "");
              videoSources.push({
                type: "embed",
                url: `https://videobello.net/embed/${b64}.00000000?source=0`,
                label: "BelloCloud",
              });
            }
          }
        }
      } catch {
        // ignore
      }
    });
  }

  return {
    title,
    videoSources,
    episodes,
  };
}

function findMatchingEpisodeInPayload(
  payload: any,
  targetSlug: string
): any | null {
  if (!payload || typeof payload !== "object" || !targetSlug) return null;

  function matches(ep: any): boolean {
    if (!ep || typeof ep !== "object") return false;
    const candidates = [ep.slug, ep.url, ep.href, ep.path, ep.link];
    for (const cand of candidates) {
      if (typeof cand === "string" && cand.trim()) {
        const cleaned = cand.split("?")[0].split("#")[0].replace(/\/+$/, "");
        const slug = cleaned.split("/").pop();
        if (slug === targetSlug) return true;
      }
    }
    return false;
  }

  if (
    matches(payload) &&
    (payload.id != null || payload.episode_id != null)
  ) {
    return payload;
  }
  if (
    payload.data &&
    matches(payload.data) &&
    (payload.data.id != null || payload.data.episode_id != null)
  ) {
    return payload.data;
  }
  if (
    payload.episode &&
    matches(payload.episode) &&
    (payload.episode.id != null || payload.episode.episode_id != null)
  ) {
    return payload.episode;
  }
  if (
    payload.data?.episode &&
    matches(payload.data.episode) &&
    (payload.data.episode.id != null || payload.data.episode.episode_id != null)
  ) {
    return payload.data.episode;
  }

  let rawEpisodes: any[] = [];
  if (Array.isArray(payload)) {
    rawEpisodes = payload;
  } else if (Array.isArray(payload.data)) {
    rawEpisodes = payload.data;
  } else if (Array.isArray(payload.episodes)) {
    rawEpisodes = payload.episodes;
  } else if (Array.isArray(payload.data?.episodes)) {
    rawEpisodes = payload.data.episodes;
  } else if (Array.isArray(payload.data?.seasons)) {
    for (const season of payload.data.seasons) {
      if (Array.isArray(season?.episodes)) {
        rawEpisodes.push(...season.episodes);
      }
    }
  } else if (Array.isArray(payload.seasons)) {
    for (const season of payload.seasons) {
      if (Array.isArray(season?.episodes)) {
        rawEpisodes.push(...season.episodes);
      }
    }
  }

  for (const ep of rawEpisodes) {
    if (
      matches(ep) &&
      (ep?.id != null || ep?.episode_id != null)
    ) {
      return ep;
    }
  }

  return null;
}
