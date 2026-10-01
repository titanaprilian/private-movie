import { randomUUID } from "node:crypto";
import { mkdir, readdir, rm, stat } from "node:fs/promises";
import { join } from "node:path";

export const ARCHIVE_STAGING_TTL_MS = 60 * 60 * 1000;

export function getArchiveStagingBaseDir(): string {
  return process.env.ARCHIVE_STAGING_DIR ?? "/tmp/archive-staging";
}

export function createArchiveStagingSessionId(): string {
  return randomUUID();
}

export function getArchiveStagingDir(baseDir: string, sessionId: string): string {
  return join(baseDir, sessionId);
}

export async function ensureArchiveStagingDir(
  baseDir: string,
  sessionId: string
): Promise<string> {
  const dir = getArchiveStagingDir(baseDir, sessionId);
  await mkdir(dir, { recursive: true });
  return dir;
}

export async function removeArchiveStagingDir(
  baseDir: string,
  sessionId: string
): Promise<void> {
  const dir = getArchiveStagingDir(baseDir, sessionId);
  await rm(dir, { recursive: true, force: true });
}

export interface PruneStagingSessionsResult {
  scanned: number;
  removed: number;
}

/**
 * Removes staging session directories older than `ttlMs` (default 1 hour,
 * based on directory mtime). Returns counts for observability. Never throws
 * on per-directory failures — a single unreadable session must not block the
 * hourly sweep.
 */
export async function pruneExpiredArchiveStagingSessions(
  baseDir: string,
  ttlMs: number = ARCHIVE_STAGING_TTL_MS,
  now: number = Date.now()
): Promise<PruneStagingSessionsResult> {
  let entries: string[];
  try {
    entries = await readdir(baseDir);
  } catch (err) {
    if ((err as NodeJS.ErrnoException)?.code === "ENOENT") {
      return { scanned: 0, removed: 0 };
    }
    throw err;
  }

  let removed = 0;
  for (const entry of entries) {
    const dir = join(baseDir, entry);
    try {
      const info = await stat(dir);
      if (!info.isDirectory()) continue;
      if (now - info.mtimeMs > ttlMs) {
        await rm(dir, { recursive: true, force: true });
        removed += 1;
      }
    } catch {
      continue;
    }
  }
  return { scanned: entries.length, removed };
}
