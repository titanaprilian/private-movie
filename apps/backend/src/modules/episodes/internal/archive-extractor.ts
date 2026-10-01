export class ArchivePasswordRequiredError extends Error {
  constructor(message = "Archive is password-protected; a password is required") {
    super(message);
    this.name = "ArchivePasswordRequiredError";
  }
}

export class InvalidArchivePasswordError extends Error {
  constructor(message = "Archive password is incorrect") {
    super(message);
    this.name = "InvalidArchivePasswordError";
  }
}

export class ArchiveExtractionError extends Error {
  constructor(message = "Failed to extract archive") {
    super(message);
    this.name = "ArchiveExtractionError";
  }
}

export interface ArchiveExtractionResult {
  extractedDir: string;
  stdout: string;
}

export type ArchiveFormat = "rar" | "zip" | "unknown";

const RAR_MAGIC = [0x52, 0x61, 0x72, 0x21];
const ZIP_MAGIC = [0x50, 0x4b, 0x03, 0x04];

export function detectArchiveFormatFromBytes(bytes: Uint8Array | number[]): ArchiveFormat {
  if (
    bytes.length >= 4 &&
    bytes[0] === RAR_MAGIC[0] &&
    bytes[1] === RAR_MAGIC[1] &&
    bytes[2] === RAR_MAGIC[2] &&
    bytes[3] === RAR_MAGIC[3]
  ) {
    return "rar";
  }
  if (
    bytes.length >= 4 &&
    bytes[0] === ZIP_MAGIC[0] &&
    bytes[1] === ZIP_MAGIC[1] &&
    bytes[2] === ZIP_MAGIC[2] &&
    bytes[3] === ZIP_MAGIC[3]
  ) {
    return "zip";
  }
  return "unknown";
}

export async function detectArchiveFormat(
  archivePath: string,
  readFn?: (path: string) => Promise<Uint8Array>
): Promise<ArchiveFormat> {
  try {
    const read = readFn ?? (async (p: string) => new Uint8Array(await Bun.file(p).slice(0, 4).arrayBuffer()));
    const bytes = await read(archivePath);
    return detectArchiveFormatFromBytes(bytes.slice(0, 4));
  } catch {
    return "unknown";
  }
}

export type RarExtractFn = (
  archivePath: string,
  destDir: string,
  password?: string | null
) => Promise<{ stdout: string; extractedFiles: string[] }>;

const defaultRarExtractFn: RarExtractFn = async (archivePath, destDir, password) => {
  const { mkdir } = await import("node:fs/promises");
  await mkdir(destDir, { recursive: true });
  let extractorModule: typeof import("node-unrar-js");
  try {
    extractorModule = await import("node-unrar-js");
  } catch (err) {
    throw new ArchiveExtractionError(
      err instanceof Error ? `Failed to load unrar engine: ${err.message}` : "Failed to load unrar engine"
    );
  }
  try {
    const extractor = await extractorModule.createExtractorFromFile({
      filepath: archivePath,
      targetPath: destDir,
      ...(password ? { password } : {}),
    });
    const extracted = extractor.extract(password ? { password } : {});
    const names: string[] = [];
    for (const file of extracted.files) {
      names.push(file.fileHeader.name);
    }
    return { stdout: `Extracted ${names.length} file(s) via node-unrar-js`, extractedFiles: names };
  } catch (err) {
    if (err instanceof Error) {
      const reason = (err as Error & { reason?: string }).reason ?? "";
      const msg = `${reason} ${err.message}`.toLowerCase();
      if (
        reason === "ERAR_MISSING_PASSWORD" ||
        (!password && (msg.includes("missing password") || msg.includes("password")))
      ) {
        // Distinguish missing vs wrong: without a password it's "required"
        if (reason === "ERAR_BAD_PASSWORD" || msg.includes("bad password") || msg.includes("wrong password")) {
          throw new ArchivePasswordRequiredError();
        }
        throw new ArchivePasswordRequiredError(err.message);
      }
      if (
        reason === "ERAR_BAD_PASSWORD" ||
        msg.includes("bad password") ||
        msg.includes("wrong password") ||
        msg.includes("data error")
      ) {
        throw new InvalidArchivePasswordError(err.message);
      }
    }
    throw new ArchiveExtractionError(err instanceof Error ? `Failed to extract RAR archive: ${err.message}` : "Failed to extract RAR archive");
  }
};
export interface ProcessRunResult {
  exitCode: number;
  stdout: string;
  stderr: string;
}

export type ArchiveProcessRunner = (args: string[]) => Promise<ProcessRunResult>;

const SUPPORTED_ARCHIVE_EXTENSIONS = [".zip", ".rar"];

export function isSupportedArchiveFilename(filename: string): boolean {
  const lower = filename.toLowerCase();
  return SUPPORTED_ARCHIVE_EXTENSIONS.some((ext) => lower.endsWith(ext));
}

const defaultRunner: ArchiveProcessRunner = async (args) => {
  const proc = Bun.spawn(["7z", ...args], {
    stdout: "pipe",
    stderr: "pipe",
    stdin: "ignore",
  });
  const [stdout, stderr, exitCode] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
    proc.exited,
  ]);
  return { exitCode, stdout, stderr };
};

function mentionsPassword(output: string): boolean {
  return /password|encrypted/i.test(output);
}

function mentionsWrongPassword(output: string): boolean {
  return /wrong password|data error in encrypted|incorrect password|bad password/i.test(output);
}

export interface ExtractArchiveOptions {
  archivePath: string;
  destDir: string;
  password?: string | null;
  onProgressFile?: (filename: string) => void;
  runner?: ArchiveProcessRunner;
  rarExtractor?: RarExtractFn;
  detectFormat?: (archivePath: string) => Promise<ArchiveFormat>;
}

function isRarArchive(archivePath: string, format: ArchiveFormat): boolean {
  if (format === "rar") return true;
  if (format === "zip") return false;
  return archivePath.toLowerCase().endsWith(".rar");
}

export async function extractArchive(options: ExtractArchiveOptions): Promise<ArchiveExtractionResult> {
  const { archivePath, destDir, password, onProgressFile } = options;
  const runner = options.runner ?? defaultRunner;

  const format = options.detectFormat
    ? await options.detectFormat(archivePath)
    : await detectArchiveFormat(archivePath);

  if (isRarArchive(archivePath, format)) {
    const rarExtract = options.rarExtractor ?? defaultRarExtractFn;
    const rarResult = await rarExtract(archivePath, destDir, password ?? null);
    for (const name of rarResult.extractedFiles) {
      onProgressFile?.(name);
    }
    return { extractedDir: destDir, stdout: rarResult.stdout };
  }

  const args = ["x", "-y", `-o${destDir}`];
  if (password) {
    args.push(`-p${password}`);
  }
  args.push(archivePath);

  let result: ProcessRunResult;
  try {
    result = await runner(args);
  } catch (err) {
    throw new ArchiveExtractionError(
      err instanceof Error ? `Failed to run 7z: ${err.message}` : "Failed to run 7z"
    );
  }

  if (result.exitCode === 0) {
    return { extractedDir: destDir, stdout: result.stdout };
  }

  const combined = `${result.stdout}\n${result.stderr}`;
  if (!password && mentionsPassword(combined)) {
    throw new ArchivePasswordRequiredError();
  }
  if (password && mentionsWrongPassword(combined)) {
    throw new InvalidArchivePasswordError();
  }
  if (!password && mentionsWrongPassword(combined)) {
    throw new ArchivePasswordRequiredError();
  }

  const detail = result.stderr.trim().split("\n").slice(-3).join(" ").slice(0, 300);
  throw new ArchiveExtractionError(
    detail ? `Failed to extract archive: ${detail}` : "Failed to extract archive"
  );
}
