import type { EpisodeRepository } from "../catalog/types";

/** Options for constructing an `IngestService`. */
export interface IngestServiceOptions {
  /**
   * Episode repository to use instead of the default
   * `createEpisodeRepository(db)`. Injected in tests to avoid database access.
   */
  episodeRepository?: EpisodeRepository;
}

/** Upload progress snapshot for a single upload session. */
export interface ProgressInfo {
  loaded: number;
  total: number;
  percent: number;
}

/** Archive formats detectable from magic bytes. */
export type ArchiveFormat = "rar" | "zip" | "unknown";

/** Result of detecting an archive's format. */
export interface ArchiveExtractionResult {
  extractedDir: string;
  stdout: string;
}

/** Raw result of running the 7z process. */
export interface ProcessRunResult {
  exitCode: number;
  stdout: string;
  stderr: string;
}

/** Injectable 7z process runner (overridden in tests). */
export type ArchiveProcessRunner = (
  args: string[],
) => Promise<ProcessRunResult>;

/** Options for extracting an archive with 7z. */
export interface ExtractArchiveOptions {
  archivePath: string;
  destDir: string;
  password?: string | null;
  onProgressFile?: (filename: string) => void;
  runner?: ArchiveProcessRunner;
}

/** A single file entry staged from an extracted archive. */
export interface StagedFileEntry {
  fileId: string;
  filename: string;
  fileSizeBytes: number;
}

/** An episode candidate that staged files can be matched against. */
export interface MatchableEpisode {
  id: string;
  order?: number | null;
  tmdbEpisodeNumber?: number | null;
}

/** Counts returned when pruning expired staging sessions. */
export interface PruneStagingSessionsResult {
  scanned: number;
  removed: number;
}
