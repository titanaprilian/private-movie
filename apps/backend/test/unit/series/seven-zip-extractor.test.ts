import { chmod, copyFile, mkdir, mkdtemp, readdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  ArchiveEngineError,
  SevenZipExtractor,
  createSevenZipExtractor,
  probeSevenZipFormatSupport,
  resolveSevenZipBinary,
} from "../../../src/modules/series";

// Only RAR5 is covered by this committed fixture. RAR4 has no fixture because
// the modern `rar` tool can no longer produce RAR4 archives, so a green test
// here is NOT evidence that older RAR archives are handled.
const RAR5_FIXTURE = join(import.meta.dirname, "../../fixtures/archives/sample-rar5.rar");

const RAR5_CONTENTS = ["notes.txt", "season1", "season1/ep01.mkv", "season1/ep02.mkv"];

const EPISODE_FILES = [
  { name: "notes.txt", body: "hello notes\n" },
  { name: "season1/ep01.mkv", body: "first episode payload\n" },
  { name: "season1/ep02.mkv", body: "second episode payload\n" },
];

let workDir: string;

async function stageSource(dir: string): Promise<void> {
  for (const file of EPISODE_FILES) {
    const target = join(dir, file.name);
    await mkdir(join(target, ".."), { recursive: true });
    await writeFile(target, file.body);
  }
}

/**
 * Builds a real archive with the resolved 7-Zip binary. 7-Zip stores paths
 * relative to the process working directory, so the command runs from `srcDir`.
 */
async function buildArchive(name: string, format: "zip" | "7z"): Promise<string> {
  const srcDir = join(workDir, `src-${name}`);
  await mkdir(srcDir, { recursive: true });
  await stageSource(srcDir);
  const archivePath = join(workDir, `${name}.${format}`);
  const extractor = await createSevenZipExtractor();
  const result = await extractor.run(
    ["a", "-y", "-bd", `-t${format}`, archivePath, "."],
    { cwd: srcDir }
  );
  if (result.exitCode !== 0) throw new Error(`fixture build failed: ${result.stderr}`);
  return archivePath;
}

async function binarySupportsRar(): Promise<boolean> {
  const support = await probeSevenZipFormatSupport();
  return support.formats.some((format) => format.toLowerCase().startsWith("rar"));
}

function sortedPaths(entries: { path: string }[]): string[] {
  return entries.map((entry) => entry.path).sort();
}

beforeAll(async () => {
  workDir = await mkdtemp(join(tmpdir(), "seven-zip-"));
}, 60_000);

afterAll(async () => {
  await rm(workDir, { recursive: true, force: true });
});

describe("SevenZipExtractor.list", () => {
  it("lists ZIP contents without extracting anything to disk", async () => {
    const archivePath = await buildArchive("zip", "zip");
    const extractor = await createSevenZipExtractor();
    const workingDirBefore = (await readdir(workDir)).sort();

    const entries = await extractor.list({ archivePath });

    expect(sortedPaths(entries)).toEqual([
      "notes.txt",
      "season1",
      "season1/ep01.mkv",
      "season1/ep02.mkv",
    ]);
    // Listing is read-only: the working directory is unchanged afterwards.
    expect((await readdir(workDir)).sort()).toEqual(workingDirBefore);
  });

  it("lists 7z contents without extracting anything to disk", async () => {
    const archivePath = await buildArchive("seven", "7z");
    const extractor = await createSevenZipExtractor();
    const workingDirBefore = (await readdir(workDir)).sort();

    const entries = await extractor.list({ archivePath });

    expect(sortedPaths(entries)).toEqual([
      "notes.txt",
      "season1",
      "season1/ep01.mkv",
      "season1/ep02.mkv",
    ]);
    expect((await readdir(workDir)).sort()).toEqual(workingDirBefore);
  });

  it("lists RAR5 contents without extracting anything to disk", async () => {
    if (!(await binarySupportsRar())) return;
    const archivePath = join(workDir, "sample-rar5.rar");
    await copyFile(RAR5_FIXTURE, archivePath);
    const extractor = await createSevenZipExtractor();
    const workingDirBefore = (await readdir(workDir)).sort();

    const entries = await extractor.list({ archivePath });

    expect(sortedPaths(entries)).toEqual(RAR5_CONTENTS);
    const files = entries.filter((entry) => !entry.isDirectory);
    expect(files.reduce((sum, entry) => sum + entry.sizeBytes, 0)).toBe(31);
    expect((await readdir(workDir)).sort()).toEqual(workingDirBefore);
  });

  it("flags directories and reports uncompressed sizes", async () => {
    const archivePath = await buildArchive("flags", "7z");

    const entries = await (await createSevenZipExtractor()).list({ archivePath });

    expect(entries.find((e) => e.path === "season1")?.isDirectory).toBe(true);
    const ep1 = entries.find((e) => e.path === "season1/ep01.mkv");
    expect(ep1?.isDirectory).toBe(false);
    expect(ep1?.sizeBytes).toBe(Buffer.byteLength(EPISODE_FILES[1].body));
  });

  it("maps a non-archive file to LIST_FAILED", async () => {
    const bogus = join(workDir, "bogus.7z");
    await writeFile(bogus, "this is not an archive");

    await expect(
      (await createSevenZipExtractor()).list({ archivePath: bogus })
    ).rejects.toMatchObject({ code: "LIST_FAILED" });
  });

  it("maps an unsupported archive type to UNSUPPORTED_FORMAT", async () => {
    const extractor = new SevenZipExtractor({
      binaryPath: "/nonexistent/7zz",
      spawnFn: async () => ({
        exitCode: 2,
        stdout: "",
        stderr: "ERROR: Unsupported archive type",
      }),
    });

    await expect(
      extractor.list({ archivePath: join(workDir, "pack.rar") })
    ).rejects.toMatchObject({ code: "UNSUPPORTED_FORMAT" });
  });
});

describe("SevenZipExtractor path safety", () => {
  const unsafeTargets = [
    "../escape.mkv",
    "season1/../../escape.mkv",
    "/etc/passwd",
    "\\windows\\system32",
    "C:\\windows\\system32\\config",
    "..\\escape.mkv",
    "   ",
  ];

  for (const target of unsafeTargets) {
    it(`rejects ${JSON.stringify(target)} before spawning 7-Zip`, async () => {
      const archivePath = await buildArchive("safety", "7z");
      const destDir = join(workDir, "safety-out");
      const listFileDir = join(workDir, "safety-lists");
      await mkdir(destDir, { recursive: true });
      await mkdir(listFileDir, { recursive: true });
      let spawnCount = 0;
      const extractor = new SevenZipExtractor({
        binaryPath: "/nonexistent/7zz",
        spawnFn: async () => {
          spawnCount += 1;
          return { exitCode: 0, stdout: "", stderr: "" };
        },
      });

      await expect(
        extractor.extract({ archivePath, destDir, targets: [target], listFileDir })
      ).rejects.toMatchObject({ code: "UNSAFE_ARCHIVE_PATH" });

      expect(spawnCount).toBe(0);
      expect(await readdir(destDir)).toEqual([]);
      expect(await readdir(listFileDir)).toEqual([]);
    });
  }

  it("rejects the whole batch when only one target is unsafe", async () => {
    const archivePath = await buildArchive("safety-batch", "7z");
    const extractor = await createSevenZipExtractor();

    await expect(
      extractor.extract({
        archivePath,
        destDir: join(workDir, "safety-batch-out"),
        targets: ["season1/ep01.mkv", "../escape.mkv"],
        listFileDir: workDir,
      })
    ).rejects.toMatchObject({ code: "UNSAFE_ARCHIVE_PATH" });
  });
});

describe("SevenZipExtractor.extract", () => {
  it("extracts only the requested targets and cleans up the list file", async () => {
    const archivePath = await buildArchive("targeted", "7z");
    const destDir = join(workDir, "targeted-out");
    const listFileDir = join(workDir, "targeted-lists");
    await mkdir(listFileDir, { recursive: true });

    const result = await (await createSevenZipExtractor()).extract({
      archivePath,
      destDir,
      targets: ["season1/ep02.mkv"],
      listFileDir,
    });

    expect(result.extractedFiles.map((f) => f.path)).toEqual(["season1/ep02.mkv"]);
    expect(result.extractedFiles[0].sizeBytes).toBe(Buffer.byteLength(EPISODE_FILES[2].body));
    expect(await readdir(listFileDir)).toEqual([]);
  });

  it("reports each extracted file through onProgressFile", async () => {
    const archivePath = await buildArchive("progress", "7z");
    const seen: string[] = [];

    await (await createSevenZipExtractor()).extract({
      archivePath,
      destDir: join(workDir, "progress-out"),
      targets: ["notes.txt", "season1/ep01.mkv"],
      listFileDir: workDir,
      onProgressFile: (filename) => seen.push(filename),
    });

    expect(seen.sort()).toEqual(["notes.txt", "season1/ep01.mkv"]);
  });

  it("is a no-op for an empty target list", async () => {
    const extractor = await createSevenZipExtractor();

    const result = await extractor.extract({
      archivePath: join(workDir, "ignored.7z"),
      destDir: join(workDir, "empty-out"),
      targets: [],
      listFileDir: workDir,
    });

    expect(result.extractedFiles).toEqual([]);
  });

  it("extracts a target from the RAR5 fixture", async () => {
    if (!(await binarySupportsRar())) return;
    const archivePath = join(workDir, "rar5-extract.rar");
    await copyFile(RAR5_FIXTURE, archivePath);
    const destDir = join(workDir, "rar5-out");

    const result = await (await createSevenZipExtractor()).extract({
      archivePath,
      destDir,
      targets: ["season1/ep01.mkv"],
      listFileDir: workDir,
    });

    expect(result.extractedFiles.map((f) => f.path)).toEqual(["season1/ep01.mkv"]);
    expect(await readFile(join(destDir, "season1/ep01.mkv"), "utf8")).toBe("episode one\n");
  });
});

describe("SevenZipExtractor cancellation", () => {
  it("terminates the running 7-Zip child process when the AbortSignal fires", async () => {
    const pidFile = join(workDir, "slow-7z.pid");
    const fakeBinary = join(workDir, "slow-7z.sh");
    await writeFile(fakeBinary, `#!/bin/sh\necho $$ > "${pidFile}"\nexec sleep 30\n`, "utf8");
    await chmod(fakeBinary, 0o755);

    const extractor = new SevenZipExtractor({ binaryPath: fakeBinary });
    const controller = new AbortController();
    const pending = extractor.list({
      archivePath: join(workDir, "ignored.7z"),
      signal: controller.signal,
    });

    await waitForFile(pidFile);
    const pid = Number((await readFile(pidFile, "utf8")).trim());
    expect(isProcessAlive(pid)).toBe(true);

    controller.abort();

    await expect(pending).rejects.toMatchObject({ code: "CANCELLED" });
    // The child must actually be gone, not merely detached.
    await waitForProcessExit(pid);
    expect(isProcessAlive(pid)).toBe(false);
  }, 30_000);

  it("rejects immediately when the signal is already aborted", async () => {
    const archivePath = await buildArchive("pre-abort", "7z");

    await expect(
      (await createSevenZipExtractor()).list({
        archivePath,
        signal: AbortSignal.abort(),
      })
    ).rejects.toMatchObject({ code: "CANCELLED" });
  });
});

describe("SevenZipExtractor password handling", () => {
  let encryptedArchive: string;

  beforeAll(async () => {
    encryptedArchive = join(workDir, "encrypted.7z");
    const stage = join(workDir, "encrypted-stage");
    await mkdir(stage, { recursive: true });
    await stageSource(stage);
    const result = await (await createSevenZipExtractor()).run(
      ["a", "-y", "-bd", "-t7z", "-pSECRET", "-mhe=on", encryptedArchive, "."],
      { cwd: stage }
    );
    if (result.exitCode !== 0) throw new Error(`encrypted fixture build failed: ${result.stderr}`);
  }, 60_000);

  it("maps a missing password to PASSWORD_REQUIRED", async () => {
    await expect(
      (await createSevenZipExtractor()).list({ archivePath: encryptedArchive })
    ).rejects.toMatchObject({ code: "PASSWORD_REQUIRED" });
  });

  it("maps a wrong password to PASSWORD_INCORRECT", async () => {
    await expect(
      (await createSevenZipExtractor()).list({
        archivePath: encryptedArchive,
        password: "WRONG",
      })
    ).rejects.toMatchObject({ code: "PASSWORD_INCORRECT" });
  });

  it("lists entries when the correct password is supplied", async () => {
    const entries = await (await createSevenZipExtractor()).list({
      archivePath: encryptedArchive,
      password: "SECRET",
    });

    expect(sortedPaths(entries)).toEqual(["notes.txt", "season1", "season1/ep01.mkv", "season1/ep02.mkv"]);
  });
});

describe("resolveSevenZipBinary", () => {
  it("prefers the ARCHIVE_7Z_BIN environment variable", async () => {
    const resolved = await resolveSevenZipBinary({
      env: { ARCHIVE_7Z_BIN: "/opt/custom/7zz" } as NodeJS.ProcessEnv,
    });

    expect(resolved).toBe("/opt/custom/7zz");
  });

  it("probes 7zz before 7z when both are on PATH", async () => {
    const binDir = join(workDir, "probe-bin");
    await mkdir(binDir, { recursive: true });
    for (const name of ["7zz", "7z"]) {
      const stub = join(binDir, name);
      await writeFile(stub, "#!/bin/sh\nexit 0\n", "utf8");
      await chmod(stub, 0o755);
    }

    const resolved = await resolveSevenZipBinary({ env: { PATH: binDir } as NodeJS.ProcessEnv });

    expect(resolved).toBe(join(binDir, "7zz"));
  });

  it("falls back to 7z when 7zz is absent from PATH", async () => {
    const binDir = join(workDir, "probe-bin-7z-only");
    await mkdir(binDir, { recursive: true });
    const stub = join(binDir, "7z");
    await writeFile(stub, "#!/bin/sh\nexit 0\n", "utf8");
    await chmod(stub, 0o755);

    const resolved = await resolveSevenZipBinary({ env: { PATH: binDir } as NodeJS.ProcessEnv });

    expect(resolved).toBe(stub);
  });

  it("throws BINARY_NOT_FOUND when nothing is discoverable", async () => {
    await expect(
      resolveSevenZipBinary({ env: { PATH: "/nonexistent" } as NodeJS.ProcessEnv })
    ).rejects.toMatchObject({ code: "BINARY_NOT_FOUND" });
  });
});

describe("probeSevenZipFormatSupport", () => {
  it("reports 7z and zip support on the resolved binary", async () => {
    const support = await probeSevenZipFormatSupport();

    expect(support.missing).not.toContain("7z");
    expect(support.missing).not.toContain("zip");
    expect(support.formats.length).toBeGreaterThan(0);
  });
});

describe("ArchiveEngineError", () => {
  it("carries a structured code and exit code", () => {
    const error = new ArchiveEngineError("PASSWORD_REQUIRED", "boom", 2);

    expect(error).toBeInstanceOf(Error);
    expect(error.code).toBe("PASSWORD_REQUIRED");
    expect(error.exitCode).toBe(2);
  });
});

function isProcessAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

async function waitForFile(path: string): Promise<void> {
  for (let attempt = 0; attempt < 400; attempt++) {
    try {
      await stat(path);
      return;
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 25));
    }
  }
  throw new Error(`timed out waiting for ${path}`);
}

async function waitForProcessExit(pid: number): Promise<void> {
  for (let attempt = 0; attempt < 400; attempt++) {
    if (!isProcessAlive(pid)) return;
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
  throw new Error(`process ${pid} is still alive`);
}