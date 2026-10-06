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
  it("supports zip, rar, and 7z archives", () => {
    expect(isSupportedArchiveFilename("season-pack.zip")).toBe(true);
    expect(isSupportedArchiveFilename("season-pack.RAR")).toBe(true);
    expect(isSupportedArchiveFilename("season-pack.7z")).toBe(true);
    expect(isSupportedArchiveFilename("video.mkv")).toBe(false);
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
    expect(calls[0]).toEqual(["x", "-y", "-bb3", "-o/tmp/out", "-psecret", "/tmp/pack.zip"]);
  });

  it("omits the password flag when no password is provided", async () => {
    const { runner, calls } = runnerWith({ exitCode: 0 });
    await extractArchive({
      archivePath: "/tmp/pack.zip",
      destDir: "/tmp/out",
      runner,
    });
    expect(calls[0]).toEqual(["x", "-y", "-bb3", "-o/tmp/out", "/tmp/pack.zip"]);
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

describe("archive-extractor RAR via the native 7-Zip process", () => {
  it("routes RAR archives through 7-Zip", async () => {
    const { runner, calls } = runnerWith({ exitCode: 0, stdout: "Everything is Ok" });

    const result = await extractArchive({
      archivePath: "/tmp/pack.rar",
      destDir: "/tmp/out",
      runner,
    });

    expect(result.extractedDir).toBe("/tmp/out");
    expect(calls[0]).toEqual(["x", "-y", "-bb3", "-o/tmp/out", "/tmp/pack.rar"]);
  });

  it("routes 7z archives through 7-Zip", async () => {
    const { runner, calls } = runnerWith({ exitCode: 0 });

    await extractArchive({ archivePath: "/tmp/pack.7z", destDir: "/tmp/out", runner });

    expect(calls[0]).toEqual(["x", "-y", "-bb3", "-o/tmp/out", "/tmp/pack.7z"]);
  });

  it("reports progress per extracted file", async () => {
    const { runner } = runnerWith({
      exitCode: 0,
      stdout: ["Extracting archive: pack.rar", "- a.mkv", "- b.mkv", "Everything is Ok"].join("\n"),
    });
    const seen: string[] = [];

    await extractArchive({
      archivePath: "/tmp/pack.rar",
      destDir: "/tmp/out",
      runner,
      onProgressFile: (filename) => seen.push(filename),
    });

    expect(seen).toEqual(["a.mkv", "b.mkv"]);
  });

  it("forwards the password to 7-Zip", async () => {
    const { runner, calls } = runnerWith({ exitCode: 0 });

    await extractArchive({
      archivePath: "/tmp/pack.rar",
      destDir: "/tmp/out",
      password: "secret",
      runner,
    });

    expect(calls[0]).toContain("-psecret");
  });

  it("throws ARCHIVE_PASSWORD_REQUIRED when a RAR needs a password", async () => {
    const { runner } = runnerWith({
      exitCode: 2,
      stderr: "ERROR: Enter password (will not be echoed): Data Error in encrypted file",
    });

    await expect(
      extractArchive({ archivePath: "/tmp/pack.rar", destDir: "/tmp/out", runner })
    ).rejects.toBeInstanceOf(ArchivePasswordRequiredError);
  });

  it("throws INVALID_ARCHIVE_PASSWORD when the RAR password is wrong", async () => {
    const { runner } = runnerWith({
      exitCode: 2,
      stderr: "ERROR: Data Error in encrypted file. Wrong password?",
    });

    await expect(
      extractArchive({
        archivePath: "/tmp/pack.rar",
        destDir: "/tmp/out",
        password: "wrong",
        runner,
      })
    ).rejects.toBeInstanceOf(InvalidArchivePasswordError);
  });
});
