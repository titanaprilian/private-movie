import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import type { VideoRow } from "@repo/db";
import { parseVideoPage } from "./internal/parse";
import { createVideoRepositoryInternal } from "./internal/repository";

export type VideoSource = "otakudesu";

export type { VideoRow as SavedVideo } from "@repo/db";

export interface SaveVideoInput {
  sourceUrl: string;
  source: VideoSource;
  html: string;
}

export interface SaveVideoService {
  saveVideoFromHtml(input: SaveVideoInput): Promise<VideoRow>;
}

const parsers: Record<VideoSource, typeof parseVideoPage> = {
  otakudesu: parseVideoPage,
};

export function createSaveVideoService<
  THKT extends PgQueryResultHKT,
  TSchema extends Record<string, unknown> = Record<string, unknown>,
>(db: PgDatabase<THKT, TSchema>): SaveVideoService {
  const repository = createVideoRepositoryInternal(db);

  return {
    async saveVideoFromHtml(input: SaveVideoInput): Promise<VideoRow> {
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