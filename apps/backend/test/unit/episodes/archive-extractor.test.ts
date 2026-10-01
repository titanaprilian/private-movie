import { describe, expect, it } from "vitest";
import {
  ArchiveExtractionError,
  ArchivePasswordRequiredError,
  detectArchiveFormat,
  detectArchiveFormatFromBytes,
  InvalidArchivePasswordError,
  extractArchive,
  isSupportedArchiveFilename,
  type ArchiveProcessRunner,
  type RarExtractFn,
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
    await extractArchive({
      archivePath: "/tmp/pack.zip",
      destDir: "/tmp/out",
      runner,
      detectFormat: async () => "zip",
    });
    expect(calls[0]).toEqual(["x", "-y", "-o/tmp/out", "/tmp/pack.zip"]);
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

describe("archive-extractor magic byte detection", () => {
  it("detects RAR magic bytes (52 61 72 21)", () => {
    expect(detectArchiveFormatFromBytes(new Uint8Array([0x52, 0x61, 0x72, 0x21, 0x1a, 0x07]))).toBe("rar");
  });

  it("detects ZIP magic bytes (50 4b 03 04)", () => {
    expect(detectArchiveFormatFromBytes(new Uint8Array([0x50, 0x4b, 0x03, 0x04, 0x14]))).toBe("zip");
  });

  it("returns unknown for unrecognized bytes", () => {
    expect(detectArchiveFormatFromBytes(new Uint8Array([0x00, 0x01, 0x02, 0x03]))).toBe("unknown");
    expect(detectArchiveFormatFromBytes(new Uint8Array([]))).toBe("unknown");
  });

  it("detects format by reading file header bytes", async () => {
    const rar = await detectArchiveFormat("/any/path", async () => new Uint8Array([0x52, 0x61, 0x72, 0x21]));
    expect(rar).toBe("rar");
    const dl = await detectArchiveFormat("/download", async () => new Uint8Array([0x52, 0x61, 0x72, 0x21]));
    expect(dl).toBe("rar");
  });

  it("returns unknown when header read fails", async () => {
    const fmt = await detectArchiveFormat("/missing", async () => {
      throw new Error("ENOENT");
    });
    expect(fmt).toBe("unknown");
  });
});

describe("archive-extractor RAR via node-unrar-js", () => {
  function rarExtractorWith(result: { stdout?: string; files?: string[]; error?: unknown }): {
    rarExtractor: RarExtractFn;
    calls: { archivePath: string; destDir: string; password?: string | null }[];
  } {
    const calls: { archivePath: string; destDir: string; password?: string | null }[] = [];
    const rarExtractor: RarExtractFn = async (archivePath, destDir, password) => {
      calls.push({ archivePath, destDir, password });
      if (result.error) throw result.error;
      return { stdout: result.stdout ?? "ok", extractedFiles: result.files ?? [] };
    };
    return { rarExtractor, calls };
  }

  it("extracts RAR archives via node-unrar-js instead of 7z", async () => {
    let runnerCalled = false;
    const runner: ArchiveProcessRunner = async () => {
      runnerCalled = true;
      return { exitCode: 0, stdout: "", stderr: "" };
    };
    const { rarExtractor, calls } = rarExtractorWith({ files: ["ep01.mkv", "ep02.mkv"] });
    const result = await extractArchive({
      archivePath: "/tmp/pack.rar",
      destDir: "/tmp/out",
      runner,
      rarExtractor,
    });
    expect(result.extractedDir).toBe("/tmp/out");
    expect(runnerCalled).toBe(false);
    expect(calls[0]).toMatchObject({ archivePath: "/tmp/pack.rar", destDir: "/tmp/out" });
  });

  it("routes extensionless /download URLs with RAR magic bytes to node-unrar-js", async () => {
    const { rarExtractor, calls } = rarExtractorWith({ files: ["show.S01E01.mkv"] });
    const runner: ArchiveProcessRunner = async () => {
      throw new Error("7z should not be called for RAR magic");
    };
    await extractArchive({
      archivePath: "/tmp/download",
      destDir: "/tmp/out",
      runner,
      rarExtractor,
      detectFormat: async () => "rar",
    });
    expect(calls).toHaveLength(1);
  });

  it("forwards the password to node-unrar-js and reports progress per file", async () => {
    const { rarExtractor } = rarExtractorWith({ files: ["a.mkv", "b.mkv"] });
    const seen: string[] = [];
    await extractArchive({
      archivePath: "/tmp/pack.rar",
      destDir: "/tmp/out",
      password: "secret",
      rarExtractor,
      onProgressFile: (f) => seen.push(f),
      detectFormat: async () => "rar",
    });
    expect(seen).toEqual(["a.mkv", "b.mkv"]);
  });

  it("throws ARCHIVE_PASSWORD_REQUIRED when RAR needs a password", async () => {
    const { rarExtractor } = rarExtractorWith({
      error: new ArchivePasswordRequiredError(),
    });
    await expect(
      extractArchive({
        archivePath: "/tmp/pack.rar",
        destDir: "/tmp/out",
        rarExtractor,
        detectFormat: async () => "rar",
      })
    ).rejects.toBeInstanceOf(ArchivePasswordRequiredError);
  });

  it("throws INVALID_ARCHIVE_PASSWORD when the RAR password is wrong", async () => {
    const { rarExtractor } = rarExtractorWith({
      error: new InvalidArchivePasswordError(),
    });
    await expect(
      extractArchive({
        archivePath: "/tmp/pack.rar",
        destDir: "/tmp/out",
        password: "wrong",
        rarExtractor,
        detectFormat: async () => "rar",
      })
    ).rejects.toBeInstanceOf(InvalidArchivePasswordError);
  });
});
