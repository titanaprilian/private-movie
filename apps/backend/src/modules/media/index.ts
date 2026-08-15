import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import type { EpisodeRow } from "@repo/db";
import { parseEpisodePage } from "./internal/episodes/parse";
import { createEpisodeRepositoryInternal } from "./internal/episodes/repository";

export type VideoSource = "otakudesu";

export type { EpisodeRow as SavedEpisode } from "@repo/db";

export interface SaveEpisodeInput {
  sourceUrl: string;
  source: VideoSource;
  html: string;
}

export interface SaveEpisodeService {
  saveEpisodeFromHtml(input: SaveEpisodeInput): Promise<EpisodeRow>;
}

const parsers: Record<VideoSource, typeof parseEpisodePage> = {
  otakudesu: parseEpisodePage,
};

export function createSaveEpisodeService<
  THKT extends PgQueryResultHKT,
  TSchema extends Record<string, unknown> = Record<string, unknown>,
>(db: PgDatabase<THKT, TSchema>): SaveEpisodeService {
  const repository = createEpisodeRepositoryInternal(db);

  return {
    async saveEpisodeFromHtml(input: SaveEpisodeInput): Promise<EpisodeRow> {
      const parsed = parsers[input.source](input.html);
      return repository.upsert({
        sourceUrl: input.sourceUrl,
        source: input.source,
        title: parsed.title,
        videoType: parsed.videoType,
        videoUrl: parsed.videoUrl,
        metadata: parsed.metadata,
      });
    },
  };
}