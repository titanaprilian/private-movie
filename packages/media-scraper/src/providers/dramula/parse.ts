import * as cheerio from "cheerio";
import type {
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

export function parseDramulaEpisodeHtml(html: string): ScrapedEpisode {
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

  if (episodes.length === 0) {
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

        const extractedList = extractEpisodesFromPayload(
          bodyObj,
          showSlugFromDataUrl
        );
        for (const item of extractedList) {
          if (!episodes.some((e) => e.url === item.url)) {
            episodes.push(item);
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
