import { describe, expect, it } from "vitest";
import {
  ArchiveExtractionError,
  ArchivePasswordRequiredError,
  InvalidArchivePasswordError,
  extractArchive,
  isSupportedArchiveFilename,
  type ArchiveProcessRunner,
} from "../../../src/modules/episodes";

function runnerWith(result: { exitCode: number; stdout?: string; stderr?: string }): {
  runner: ArchiveProcessRunner;
  calls: string[][];
} {
  const calls: string[][] = [];
  const runner: ArchiveProcessRunner = async (args) => {
    calls.push(args);
    return { exitCode: result.exitCode, stdout: result.stdout ?? "", stderr: result.stderr ?? "" };
  };
  return { runner, calls };
}

describe("archive-extractor format support", () => {
  it("supports zip and rar archives only", () => {
    expect(isSupportedArchiveFilename("season-pack.zip")).toBe(true);
    expect(isSupportedArchiveFilename("season-pack.RAR")).toBe(true);
    expect(isSupportedArchiveFilename("video.mkv")).toBe(false);
    expect(isSupportedArchiveFilename("archive.7z")).toBe(false);
    expect(isSupportedArchiveFilename("archive.tar.gz")).toBe(false);
  });
});

describe("archive-extractor 7z invocation", () => {
  it("extracts with 7z and passes the password flag when provided", async () => {
    const { runner, calls } = runnerWith({ exitCode: 0, stdout: "Everything is Ok" });
    const result = await extractArchive({
      archivePath: "/tmp/pack.zip",
      destDir: "/tmp/out",
      password: "secret",
      runner,
    });
    expect(result.extractedDir).toBe("/tmp/out");
    expect(calls[0]).toEqual(["x", "-y", "-o/tmp/out", "-psecret", "/tmp/pack.zip"]);
  });

  it("omits the password flag when no password is provided", async () => {
    const { runner, calls } = runnerWith({ exitCode: 0 });
    await extractArchive({ archivePath: "/tmp/pack.rar", destDir: "/tmp/out", runner });
    expect(calls[0]).toEqual(["x", "-y", "-o/tmp/out", "/tmp/pack.rar"]);
  });

  it("throws ARCHIVE_PASSWORD_REQUIRED when extraction needs a password", async () => {
    const { runner } = runnerWith({
      exitCode: 2,
      stderr: "ERROR: Enter password (will not be echoed): Data Error in encrypted file",
    });
    await expect(
      extractArchive({ archivePath: "/tmp/pack.zip", destDir: "/tmp/out", runner })
    ).rejects.toBeInstanceOf(ArchivePasswordRequiredError);
  });

  it("throws INVALID_ARCHIVE_PASSWORD when the provided password is wrong", async () => {
    const { runner } = runnerWith({
      exitCode: 2,
      stderr: "ERROR: Data Error in encrypted file. Wrong password?",
    });
    await expect(
      extractArchive({
        archivePath: "/tmp/pack.zip",
        destDir: "/tmp/out",
        password: "wrong",
        runner,
      })
    ).rejects.toBeInstanceOf(InvalidArchivePasswordError);
  });

  it("throws a generic extraction error for non-password failures", async () => {
    const { runner } = runnerWith({ exitCode: 2, stderr: "ERROR: Cannot open file as archive" });
    await expect(
      extractArchive({ archivePath: "/tmp/broken.zip", destDir: "/tmp/out", runner })
    ).rejects.toBeInstanceOf(ArchiveExtractionError);
  });

  it("wraps runner spawn failures as extraction errors", async () => {
    const failing: ArchiveProcessRunner = async () => {
      throw new Error("7z not found");
    };
    await expect(
      extractArchive({ archivePath: "/tmp/pack.zip", destDir: "/tmp/out", runner: failing })
    ).rejects.toBeInstanceOf(ArchiveExtractionError);
  });
});
