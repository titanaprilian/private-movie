import {
  OtakudesuProvider,
  SeriesParseError,
  type ScrapedSeries,
} from "@repo/media-scraper";

export { SeriesParseError };

export interface ParsedEpisodeItem {
  title: string;
  url: string;
  date: string | null;
}

export interface ParsedSeriesPage extends Omit<ScrapedSeries, "episodes"> {
  posterUrl: string | null;
  description: string | null;
  episodes: ParsedEpisodeItem[];
}

const otakudesuProvider = new OtakudesuProvider();

export const parseSeriesPage = (
  html: string,
  targetUrl?: string
): ParsedSeriesPage => {
  const result = otakudesuProvider.parseSeriesHtml(html, targetUrl);
  return {
    ...result,
    posterUrl: result.posterUrl ?? null,
    description: result.description ?? null,
    episodes: result.episodes.map((ep) => ({
      title: ep.title,
      url: ep.url,
      date: ep.date ?? null,
    })),
  };
};
