import { mkdtemp, mkdir, rm, utimes } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  ARCHIVE_STAGING_TTL_MS,
  createArchiveStagingSessionId,
  ensureArchiveStagingDir,
  getArchiveStagingBaseDir,
  getArchiveStagingDir,
  pruneExpiredArchiveStagingSessions,
  removeArchiveStagingDir,
} from "../../../src/modules/episodes";

describe("archive-staging sessions", () => {
  const sandboxes: string[] = [];

  afterEach(async () => {
    await Promise.all(sandboxes.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
  });

  async function makeBase(): Promise<string> {
    const dir = await mkdtemp(join(tmpdir(), "staging-test-"));
    sandboxes.push(dir);
    return join(dir, "sessions");
  }

  it("creates and removes scoped session directories", async () => {
    const base = await makeBase();
    const sessionId = createArchiveStagingSessionId();
    const dir = await ensureArchiveStagingDir(base, sessionId);
    expect(dir).toBe(getArchiveStagingDir(base, sessionId));

    const { stat } = await import("node:fs/promises");
    expect((await stat(dir)).isDirectory()).toBe(true);

    await removeArchiveStagingDir(base, sessionId);
    await expect(stat(dir)).rejects.toThrow();
  });

  it("defaults the base dir to /tmp/archive-staging", () => {
    delete process.env.ARCHIVE_STAGING_DIR;
    expect(getArchiveStagingBaseDir()).toBe("/tmp/archive-staging");
    expect(ARCHIVE_STAGING_TTL_MS).toBe(60 * 60 * 1000);
  });

  it("prunes only sessions older than the TTL", async () => {
    const base = await makeBase();
    await mkdir(base, { recursive: true });
    const oldDir = join(base, "old-session");
    const freshDir = join(base, "fresh-session");
    await mkdir(oldDir, { recursive: true });
    await mkdir(freshDir, { recursive: true });

    const oldTime = new Date(Date.now() - ARCHIVE_STAGING_TTL_MS - 1000);
    await utimes(oldDir, oldTime, oldTime);

    const result = await pruneExpiredArchiveStagingSessions(base);
    expect(result).toEqual({ scanned: 2, removed: 1 });

    const { stat } = await import("node:fs/promises");
    await expect(stat(oldDir)).rejects.toThrow();
    expect((await stat(freshDir)).isDirectory()).toBe(true);
  });

  it("returns zero counts when the base dir does not exist", async () => {
    const result = await pruneExpiredArchiveStagingSessions(join(tmpdir(), "no-such-dir-xyz"));
    expect(result).toEqual({ scanned: 0, removed: 0 });
  });
});
