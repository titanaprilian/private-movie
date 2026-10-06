import { randomUUID } from "node:crypto";
import { spawn } from "node:child_process";
import { access, constants, mkdir, readdir, rm, stat, writeFile } from "node:fs/promises";
import { delimiter, join, relative, sep } from "node:path";

export const SEVEN_ZIP_BIN_ENV = "ARCHIVE_7Z_BIN";
export const SEVEN_ZIP_BINARY_CANDIDATES = ["7zz", "7z"] as const;
export const REQUIRED_ARCHIVE_FORMATS = ["7z", "zip", "rar"] as const;

const FORCE_KILL_GRACE_MS = 2_000;

export type ArchiveEngineErrorCode =
  | "BINARY_NOT_FOUND"
  | "UNSUPPORTED_FORMAT"
  | "PASSWORD_REQUIRED"
  | "PASSWORD_INCORRECT"
  | "UNSAFE_ARCHIVE_PATH"
  | "LIST_FAILED"
  | "EXTRACT_FAILED"
  | "CANCELLED";

export class ArchiveEngineError extends Error {
  readonly code: ArchiveEngineErrorCode;
  readonly exitCode: number | null;

  constructor(code: ArchiveEngineErrorCode, message: string, exitCode: number | null = null) {
    super(message);
    this.name = "ArchiveEngineError";
    this.code = code;
    this.exitCode = exitCode;
  }
}

export interface ArchiveProcessResult {
  exitCode: number | null;
  stdout: string;
  stderr: string;
}

export interface ArchiveProcessOptions {
  cwd?: string;
  signal?: AbortSignal;
}

export type ArchiveSpawnFn = (
  command: string,
  args: string[],
  options: ArchiveProcessOptions
) => Promise<ArchiveProcessResult>;

const defaultSpawnFn: ArchiveSpawnFn = (command, args, options) =>
  new Promise<ArchiveProcessResult>((resolve, reject) => {
    if (options.signal?.aborted) {
      reject(new ArchiveEngineError("CANCELLED", "Archive operation cancelled"));
      return;
    }

    const child = spawn(command, args, {
      cwd: options.cwd,
      // stdin stays closed so a password prompt reads EOF and gives up
      // immediately instead of blocking the worker forever.
      stdio: ["ignore", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";
    let aborted = false;
    let forceKillTimer: NodeJS.Timeout | undefined;
    let settled = false;

    const kill = (signal: NodeJS.Signals) => {
      try {
        child.kill(signal);
      } catch {
        /* already gone */
      }
    };

    const onAbort = () => {
      aborted = true;
      kill("SIGTERM");
      forceKillTimer = setTimeout(() => kill("SIGKILL"), FORCE_KILL_GRACE_MS);
      forceKillTimer.unref?.();
    };
    options.signal?.addEventListener("abort", onAbort, { once: true });

    child.stdout?.on("data", (chunk: Buffer) => {
      stdout += chunk.toString();
    });
    child.stderr?.on("data", (chunk: Buffer) => {
      stderr += chunk.toString();
    });

    const settle = (fn: () => void) => {
      if (settled) return;
      settled = true;
      options.signal?.removeEventListener("abort", onAbort);
      if (forceKillTimer) clearTimeout(forceKillTimer);
      fn();
    };

    child.on("error", (err) => {
      const code = (err as NodeJS.ErrnoException).code;
      settle(() => {
        if (code === "ENOENT") {
          reject(
            new ArchiveEngineError(
              "BINARY_NOT_FOUND",
              `7-Zip binary not found: ${command}. Set ${SEVEN_ZIP_BIN_ENV} to an absolute path.`
            )
          );
          return;
        }
        reject(new ArchiveEngineError("EXTRACT_FAILED", `Failed to run 7-Zip: ${err.message}`));
      });
    });

    child.on("close", (exitCode) => {
      settle(() => {
        if (aborted) {
          reject(new ArchiveEngineError("CANCELLED", "Archive operation cancelled"));
          return;
        }
        resolve({ exitCode, stdout, stderr });
      });
    });
  });

async function isExecutableFile(path: string): Promise<boolean> {
  try {
    if (!(await stat(path)).isFile()) return false;
    await access(path, constants.X_OK);
    return true;
  } catch {
    return false;
  }
}

async function probeBinary(command: string, env: NodeJS.ProcessEnv): Promise<string | null> {
  if (command.includes("/")) {
    return (await isExecutableFile(command)) ? command : null;
  }
  for (const dir of (env.PATH ?? "").split(delimiter)) {
    if (!dir) continue;
    const candidate = join(dir, command);
    if (await isExecutableFile(candidate)) return candidate;
  }
  return null;
}

export async function resolveSevenZipBinary(
  options: { env?: NodeJS.ProcessEnv } = {}
): Promise<string> {
  const env = options.env ?? process.env;
  const configured = env[SEVEN_ZIP_BIN_ENV]?.trim();
  if (configured) return configured;
  for (const candidate of SEVEN_ZIP_BINARY_CANDIDATES) {
    const found = await probeBinary(candidate, env);
    if (found) return found;
  }
  throw new ArchiveEngineError(
    "BINARY_NOT_FOUND",
    `No 7-Zip binary found. Install it or point ${SEVEN_ZIP_BIN_ENV} at the executable.`
  );
}

export interface ArchiveEntry {
  path: string;
  sizeBytes: number;
  isDirectory: boolean;
}

export interface ExtractedFile {
  path: string;
  sizeBytes: number;
}

function normalizeArchivePath(raw: string): string {
  const unified = raw.replace(/\\/g, "/").trim();
  let out = unified;
  while (out.startsWith("./")) out = out.slice(2);
  while (out.endsWith("/")) out = out.slice(0, -1);
  return out;
}

function parseSizeField(value: string | undefined): number {
  if (!value) return 0;
  const parsed = Number.parseInt(value.trim(), 10);
  return Number.isNaN(parsed) || parsed < 0 ? 0 : parsed;
}

function looksLikeDirectory(fields: Record<string, string>): boolean {
  const folder = fields["Folder"]?.trim();
  if (folder) return folder === "+";
  const attributes = fields["Attributes"] ?? "";
  return /(^|\s)d[rwxst-]{9}(\s|$)/.test(attributes) || /(^|\s)D(\s|$)/.test(attributes);
}

/**
 * Parses `7zz l -slt` output. Entries only begin after the `----------`
 * divider; everything above it describes the archive itself, not its contents.
 * Field order is not stable across formats (7z omits `Folder` entirely, for
 * example), so directories are detected from `Folder` first and POSIX/Windows
 * attributes second.
 */
export function parseSevenZipListOutput(stdout: string): ArchiveEntry[] {
  const lines = stdout.split(/\r?\n/);
  const dividerIndex = lines.findIndex((line) => /^-{10,}$/.test(line.trim()));
  if (dividerIndex === -1) return [];

  const entries: ArchiveEntry[] = [];
  let fields: Record<string, string> | null = null;

  const flush = () => {
    const record = fields;
    fields = null;
    if (!record || record["Path"] === undefined) return;
    const path = normalizeArchivePath(record["Path"]);
    if (!path) return;
    entries.push({
      path,
      sizeBytes: parseSizeField(record["Size"]),
      isDirectory: looksLikeDirectory(record),
    });
  };

  for (const line of lines.slice(dividerIndex + 1)) {
    if (line.trim() === "") {
      flush();
      continue;
    }
    const match = /^([^=]+?) = (.*)$/.exec(line);
    if (!match) continue;
    if (!fields) fields = {};
    fields[match[1].trim()] = match[2];
  }
  flush();

  return entries;
}

function classifyFailure(
  result: ArchiveProcessResult,
  hadPassword: boolean
): ArchiveEngineErrorCode | null {
  const combined = `${result.stdout}\n${result.stderr}`;
  if (/unsupported archive type/i.test(combined)) return "UNSUPPORTED_FORMAT";
  if (/wrong password|data error in encrypted file|cannot open encrypted archive/i.test(combined)) {
    return hadPassword ? "PASSWORD_INCORRECT" : "PASSWORD_REQUIRED";
  }
  if (/enter password|password is required|encrypted headers/i.test(combined)) {
    return "PASSWORD_REQUIRED";
  }
  return null;
}

function failureDetail(result: ArchiveProcessResult): string {
  const lines = `${result.stdout}\n${result.stderr}`
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  return lines.slice(-3).join(" ").slice(0, 300);
}

export interface ListArchiveOptions {
  archivePath: string;
  password?: string | null;
  signal?: AbortSignal;
}

export interface ExtractArchiveFilesOptions {
  archivePath: string;
  destDir: string;
  targets: string[];
  listFileDir: string;
  password?: string | null;
  signal?: AbortSignal;
  onProgressFile?: (filename: string) => void;
}

export interface ExtractArchiveFilesResult {
  extractedFiles: ExtractedFile[];
}

export interface ArchiveExtractor {
  readonly binaryPath: string;
  list(options: ListArchiveOptions): Promise<ArchiveEntry[]>;
  extract(options: ExtractArchiveFilesOptions): Promise<ExtractArchiveFilesResult>;
  run(args: string[], options?: ArchiveProcessOptions): Promise<ArchiveProcessResult>;
}

export function assertSafeArchivePath(target: string): void {
  const reject = (reason: string): never => {
    throw new ArchiveEngineError(
      "UNSAFE_ARCHIVE_PATH",
      `Refusing to extract unsafe archive path ${JSON.stringify(target)}: ${reason}`
    );
  };

  if (target.trim() === "") reject("empty path");
  if (target.includes("\0")) reject("NUL byte");

  const unified = target.replace(/\\/g, "/");
  if (unified.startsWith("/")) reject("absolute path");
  if (/^[a-zA-Z]:/.test(unified)) reject("drive-letter prefix");
  if (unified.split("/").some((segment) => segment === "..")) {
    reject("parent-directory traversal");
  }
}

async function listExtractedFiles(root: string): Promise<ExtractedFile[]> {
  const out: ExtractedFile[] = [];
  const walk = async (dir: string): Promise<void> => {
    for (const entry of await readdir(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) {
        await walk(full);
      } else if (entry.isFile()) {
        out.push({
          path: relative(root, full).split(sep).join("/"),
          sizeBytes: (await stat(full)).size,
        });
      }
    }
  };
  await walk(root);
  return out.sort((a, b) => a.path.localeCompare(b.path));
}

export interface SevenZipExtractorOptions {
  /** Absolute path to the 7-Zip executable. Defaults to `7zz` and is resolved
   *  asynchronously by {@link createSevenZipExtractor}. */
  binaryPath?: string;
  spawnFn?: ArchiveSpawnFn;
  cwd?: string;
}

export class SevenZipExtractor implements ArchiveExtractor {
  readonly binaryPath: string;
  private readonly spawnFn: ArchiveSpawnFn;
  private readonly cwd: string | undefined;

  constructor(options: SevenZipExtractorOptions = {}) {
    this.binaryPath = options.binaryPath ?? SEVEN_ZIP_BINARY_CANDIDATES[0];
    this.spawnFn = options.spawnFn ?? defaultSpawnFn;
    this.cwd = options.cwd;
  }

  async run(
    args: string[],
    options: ArchiveProcessOptions = {}
  ): Promise<ArchiveProcessResult> {
    return this.spawnFn(this.binaryPath, args, { cwd: options.cwd ?? this.cwd, signal: options.signal });
  }

  async list(options: ListArchiveOptions): Promise<ArchiveEntry[]> {
    const password = options.password ?? null;
    const args = ["l", "-slt", "-y", "-bd"];
    if (password) args.push(`-p${password}`);
    args.push(options.archivePath);

    const result = await this.run(args, { signal: options.signal });
    if (result.exitCode === 0) return parseSevenZipListOutput(result.stdout);

    const classified = classifyFailure(result, Boolean(password));
    throw new ArchiveEngineError(
      classified ?? "LIST_FAILED",
      classified ? failureDetail(result) : `Failed to list archive: ${failureDetail(result)}`,
      result.exitCode
    );
  }

  async extract(options: ExtractArchiveFilesOptions): Promise<ExtractArchiveFilesResult> {
    if (options.targets.length === 0) return { extractedFiles: [] };
    // Validate every target before touching the filesystem or spawning 7-Zip.
    for (const target of options.targets) assertSafeArchivePath(target);

    await mkdir(options.destDir, { recursive: true });
    await mkdir(options.listFileDir, { recursive: true });
    const listFile = join(options.listFileDir, `7z-targets-${randomUUID()}.lst`);
    await writeFile(listFile, `${options.targets.join("\n")}\n`, "utf8");

    try {
      const password = options.password ?? null;
      const args = ["x", "-y", "-bd", `-o${options.destDir}`];
      if (password) args.push(`-p${password}`);
      // 7-Zip only resolves an `@listfile` that appears *after* the archive name.
      args.push(options.archivePath, `@${listFile}`);

      const result = await this.run(args, { signal: options.signal });
      if (result.exitCode !== 0) {
        const classified = classifyFailure(result, Boolean(password));
        throw new ArchiveEngineError(
          classified ?? "EXTRACT_FAILED",
          classified
            ? failureDetail(result)
            : `Failed to extract archive: ${failureDetail(result)}`,
          result.exitCode
        );
      }

      const extractedFiles = await listExtractedFiles(options.destDir);
      for (const file of extractedFiles) options.onProgressFile?.(file.path);
      return { extractedFiles };
    } finally {
      await rm(listFile, { force: true }).catch(() => {});
    }
  }
}

export async function createSevenZipExtractor(
  options: SevenZipExtractorOptions = {}
): Promise<SevenZipExtractor> {
  if (options.binaryPath) return new SevenZipExtractor(options);
  return new SevenZipExtractor({ ...options, binaryPath: await resolveSevenZipBinary() });
}

export interface SevenZipFormatSupport {
  binary: string;
  formats: string[];
  missing: string[];
}

export function parseSevenZipFormats(stdout: string): string[] {
  const lines = stdout.split(/\r?\n/);
  const start = lines.findIndex((line) => /^Formats:/i.test(line.trim()));
  if (start === -1) return [];
  const formats: string[] = [];
  for (const line of lines.slice(start + 1)) {
    if (/^Codecs:/i.test(line.trim())) break;
    if (!line.trim()) continue;
    // Format lines are split into columns on 2+ spaces. The flag columns
    // differ per distribution: modern `7zz` uses dot-delimited flags
    // (`C...F...`), the plugin build (`7z` with Libs) adds a numeric index
    // plus an optional second flag column (`w...0`), and older `p7zip`
    // 16.02 uses space-separated single-letter flags (`C   F`). When the
    // flags merge into a single column they always contain dots, so the
    // format name sits at columns[1]; otherwise the flags occupy two
    // columns and the name sits at columns[2].
    const columns = line.trim().split(/\s{2,}/);
    const mergedFlags = columns[0].includes(".");
    const name = mergedFlags ? columns[1] : columns[2];
    // The name column must exist, be a single token (names never contain
    // dots or spaces), and be followed by the primary-extension column.
    const extension = mergedFlags ? columns[2] : columns[3];
    if (!name || !extension || !/^[^\s.]+$/.test(name)) continue;
    formats.push(name);
  }
  return formats;
}

/**
 * Startup self-check: reports whether the resolved 7-Zip binary can read every
 * archive format the ingest pipeline needs. Some distro builds of 7-Zip ship
 * without the RAR codec, which silently breaks RAR ingest much later in the
 * job lifecycle, so this is worth surfacing at boot.
 */
export async function probeSevenZipFormatSupport(
  binaryPath?: string
): Promise<SevenZipFormatSupport> {
  const binary = binaryPath ?? (await resolveSevenZipBinary());
  const result = await defaultSpawnFn(binary, ["i"], {});
  const formats = result.exitCode === 0 ? parseSevenZipFormats(result.stdout) : [];
  const missing = REQUIRED_ARCHIVE_FORMATS.filter(
    (required) => !formats.some((format) => format.toLowerCase().startsWith(required))
  );
  return { binary, formats, missing };
}