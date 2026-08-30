import * as cheerio from "cheerio";
import type {
  ScrapedEpisode,
  ScrapedEpisodeRef,
  ScrapedVideoSource,
} from "../../types";

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
      if (!episodes.some((e) => e.url === href)) {
        episodes.push({
          title: episodeTitle,
          url: href,
        });
      }
    }
  });

  return {
    title,
    videoSources,
    episodes,
  };
}
