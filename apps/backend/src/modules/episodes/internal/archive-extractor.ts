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
}

export async function extractArchive(options: ExtractArchiveOptions): Promise<ArchiveExtractionResult> {
  const { archivePath, destDir, password } = options;
  const runner = options.runner ?? defaultRunner;

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
