import { spawnSync } from "node:child_process";
import * as fs from "node:fs";
import * as path from "node:path";

export type ViolationRule =
  "drop-table" | "drop-column" | "unhedged-add-column";

export interface MigrationViolation {
  file: string;
  line: number;
  rule: ViolationRule;
  statement: string;
  remediation: string;
}

export interface MigrationLintResult {
  passed: boolean;
  scannedFiles: string[];
  violations: MigrationViolation[];
}

export interface ParsedStatement {
  file: string;
  line: number;
  rawText: string;
  cleanedText: string;
  hasDestructiveBypass: boolean;
}

export interface ResolveOptions {
  all?: boolean;
  baseRef?: string;
  cwd?: string;
}

const REMEDIATIONS: Record<ViolationRule, string> = {
  "drop-table":
    "Dropping tables breaks running application instances during rolling deployment. Follow the expand-and-contract protocol (deprecate table, ensure 0 references, then use '-- allow-destructive: <rationale>' if dropping is verified safe).",
  "drop-column":
    "Dropping columns causes runtime errors in older app instances still querying the column. Follow the expand-and-contract protocol: stop reading/writing the column in code first, deploy, then drop with '-- allow-destructive: <rationale>'.",
  "unhedged-add-column":
    "Adding a NOT NULL column without a DEFAULT clause will fail on existing rows. Add the column with a DEFAULT or make it nullable, backfill values, then set NOT NULL.",
};

/**
 * Checks whether an allow-destructive comment contains a valid rationale.
 * Non-empty rationale required (at least 3 non-whitespace characters).
 */
export function isValidRationale(rationale: string | undefined): boolean {
  if (!rationale) return false;
  return rationale.trim().length >= 3;
}

/**
 * Parses SQL file content into statements while tracking line numbers,
 * stripping strings/comments for rule checks, and checking for bypass annotations.
 */
export function parseSqlStatements(
  content: string,
  filePath = "migration.sql",
): ParsedStatement[] {
  const statements: ParsedStatement[] = [];

  let i = 0;
  let line = 1;
  const n = content.length;

  let currentRaw = "";
  let currentCleaned = "";
  let statementStartLine = 1;
  let statementActive = false;
  let pendingBypass = false;

  const BREAKPOINT = "--> statement-breakpoint";

  function finishStatement() {
    if (statementActive && currentRaw.trim().length > 0) {
      statements.push({
        file: filePath,
        line: statementStartLine,
        rawText: currentRaw.trim(),
        cleanedText: currentCleaned.trim(),
        hasDestructiveBypass: pendingBypass,
      });
      pendingBypass = false;
    }
    currentRaw = "";
    currentCleaned = "";
    statementActive = false;
  }

  while (i < n) {
    // 1. Check for Drizzle statement breakpoint: "--> statement-breakpoint"
    if (content.startsWith(BREAKPOINT, i)) {
      finishStatement();
      i += BREAKPOINT.length;
      continue;
    }

    const ch = content[i];

    // Track newlines
    if (ch === "\n") {
      line++;
      if (statementActive) {
        currentRaw += ch;
        currentCleaned += ch;
      }
      i++;
      continue;
    }

    // 2. Single-line comment: "--"
    if (ch === "-" && content[i + 1] === "-") {
      // Find end of comment line
      const commentStart = i;
      let commentEnd = content.indexOf("\n", i);
      if (commentEnd === -1) {
        commentEnd = n;
      }
      const commentText = content.slice(commentStart, commentEnd);

      // Check for inline bypass: "-- allow-destructive: <rationale>"
      const match = commentText.match(/--\s*allow-destructive\s*:\s*(.*)/i);
      if (match) {
        const rationale = match[1];
        if (isValidRationale(rationale)) {
          pendingBypass = true;
        }
      }

      if (statementActive) {
        currentRaw += commentText;
        currentCleaned += " "; // Replace comment with space in cleaned SQL
      }

      i = commentEnd;
      continue;
    }

    // 3. Multi-line block comment: "/* ... */"
    if (ch === "/" && content[i + 1] === "*") {
      const blockStart = i;
      const blockEnd = content.indexOf("*/", i + 2);
      const commentEnd = blockEnd === -1 ? n : blockEnd + 2;
      const blockText = content.slice(blockStart, commentEnd);

      // Count lines inside block comment
      for (const c of blockText) {
        if (c === "\n") line++;
      }

      if (statementActive) {
        currentRaw += blockText;
        currentCleaned += " ";
      }

      i = commentEnd;
      continue;
    }

    // 4. String literal: '...' (with '' escape)
    if (ch === "'") {
      if (!statementActive) {
        statementActive = true;
        statementStartLine = line;
      }

      currentRaw += "'";
      currentCleaned += "''"; // Normalize string literal to empty string
      i++;

      while (i < n) {
        const strChar = content[i];
        if (strChar === "\n") line++;
        currentRaw += strChar;

        if (strChar === "'") {
          if (content[i + 1] === "'") {
            // Escaped quote
            i++;
            currentRaw += content[i];
          } else {
            i++;
            break;
          }
        }
        i++;
      }
      continue;
    }

    // 5. Quoted identifier: "..." (with "" escape)
    if (ch === '"') {
      if (!statementActive) {
        statementActive = true;
        statementStartLine = line;
      }

      currentRaw += '"';
      currentCleaned += '"';
      i++;

      while (i < n) {
        const idChar = content[i];
        if (idChar === "\n") line++;
        currentRaw += idChar;
        currentCleaned += idChar;

        if (idChar === '"') {
          if (content[i + 1] === '"') {
            i++;
            currentRaw += content[i];
            currentCleaned += content[i];
          } else {
            i++;
            break;
          }
        }
        i++;
      }
      continue;
    }

    // 6. Statement terminator semicolon: ";"
    if (ch === ";") {
      if (statementActive) {
        currentRaw += ch;
        currentCleaned += ch;
        finishStatement();
      }
      i++;
      continue;
    }

    // 7. Regular character
    if (!statementActive) {
      if (/\S/.test(ch)) {
        statementActive = true;
        statementStartLine = line;
        currentRaw += ch;
        currentCleaned += ch;
      }
    } else {
      currentRaw += ch;
      currentCleaned += ch;
    }

    i++;
  }

  // Finish any trailing statement
  finishStatement();

  return statements;
}

/**
 * Inspects a parsed SQL statement for migration safety violations.
 */
export function checkStatement(stmt: ParsedStatement): MigrationViolation[] {
  if (stmt.hasDestructiveBypass) {
    return [];
  }

  const violations: MigrationViolation[] = [];
  const cleaned = stmt.cleanedText;

  // Rule 1: Flag DROP TABLE
  if (/\bDROP\s+TABLE\b/i.test(cleaned)) {
    violations.push({
      file: stmt.file,
      line: stmt.line,
      rule: "drop-table",
      statement: stmt.rawText,
      remediation: REMEDIATIONS["drop-table"],
    });
  }

  // Rule 2: Flag DROP COLUMN
  if (/\bDROP\s+COLUMN\b/i.test(cleaned)) {
    violations.push({
      file: stmt.file,
      line: stmt.line,
      rule: "drop-column",
      statement: stmt.rawText,
      remediation: REMEDIATIONS["drop-column"],
    });
  }

  // Rule 3: Flag ALTER TABLE ... ADD COLUMN with NOT NULL without DEFAULT
  if (/\bALTER\s+TABLE\b/i.test(cleaned) && /\bADD\s+COLUMN\b/i.test(cleaned)) {
    // Extract column definitions after ADD COLUMN
    const addColumnRegex = /\bADD\s+COLUMN\b/gi;
    let match: RegExpExecArray | null;

    while ((match = addColumnRegex.exec(cleaned)) !== null) {
      const startIdx = match.index + match[0].length;
      // Find the end of this column definition:
      // either end of statement or a comma at parentheses depth 0
      let depth = 0;
      let endIdx = cleaned.length;

      for (let j = startIdx; j < cleaned.length; j++) {
        const char = cleaned[j];
        if (char === "(") depth++;
        else if (char === ")") depth--;
        else if (char === "," && depth === 0) {
          endIdx = j;
          break;
        } else if (char === ";" && depth === 0) {
          endIdx = j;
          break;
        }
      }

      const colDef = cleaned.slice(startIdx, endIdx);
      const hasNotNull = /\bNOT\s+NULL\b/i.test(colDef);
      const hasDefault = /\bDEFAULT\b/i.test(colDef);

      if (hasNotNull && !hasDefault) {
        violations.push({
          file: stmt.file,
          line: stmt.line,
          rule: "unhedged-add-column",
          statement: stmt.rawText,
          remediation: REMEDIATIONS["unhedged-add-column"],
        });
        break; // One unhedged column violation per statement is sufficient
      }
    }
  }

  return violations;
}

/**
 * Gets repository root from cwd via git or fallback.
 */
function getRepoRoot(cwd: string): string {
  try {
    const res = spawnSync("git", ["rev-parse", "--show-toplevel"], {
      cwd,
      encoding: "utf-8",
    });
    if (res.status === 0 && res.stdout) {
      return res.stdout.trim();
    }
  } catch {}
  return cwd;
}

/**
 * Resolves migration files to check.
 * - When all is true, returns all `packages/db/drizzle/*.sql` files.
 * - When all is false/omitted, checks git diff for added/modified migration files.
 */
export function resolveMigrationFilesToCheck(
  options?: ResolveOptions,
): string[] {
  const cwd = options?.cwd || process.cwd();
  const repoRoot = getRepoRoot(cwd);

  const drizzleDirRel = "packages/db/drizzle";
  const drizzleDirAbs = path.resolve(repoRoot, drizzleDirRel);

  if (options?.all) {
    if (!fs.existsSync(drizzleDirAbs)) {
      return [];
    }
    const entries = fs.readdirSync(drizzleDirAbs, { withFileTypes: true });
    return entries
      .filter((e) => e.isFile() && e.name.endsWith(".sql"))
      .map((e) => `${drizzleDirRel}/${e.name}`)
      .sort();
  }

  // Not all: check git diff for added/modified files
  const filesSet = new Set<string>();

  const runGit = (args: string[]): string[] => {
    try {
      const res = spawnSync("git", args, {
        cwd: repoRoot,
        encoding: "utf-8",
      });
      if (res.status === 0 && res.stdout) {
        return res.stdout
          .split("\n")
          .map((line) => line.trim())
          .filter(Boolean);
      }
    } catch {}
    return [];
  };

  // 1. Committed diff relative to baseRef
  if (options?.baseRef) {
    const diffFiles = runGit([
      "diff",
      "--name-only",
      "--diff-filter=ACMR",
      `${options.baseRef}...HEAD`,
    ]);
    for (const f of diffFiles) filesSet.add(f);
  } else {
    // Try origin/main...HEAD, fallback to main...HEAD
    let diffFiles = runGit([
      "diff",
      "--name-only",
      "--diff-filter=ACMR",
      "origin/main...HEAD",
    ]);
    if (diffFiles.length === 0) {
      diffFiles = runGit([
        "diff",
        "--name-only",
        "--diff-filter=ACMR",
        "main...HEAD",
      ]);
    }
    for (const f of diffFiles) filesSet.add(f);
  }

  // 2. Staged changes
  const staged = runGit([
    "diff",
    "--name-only",
    "--cached",
    "--diff-filter=ACMR",
  ]);
  for (const f of staged) filesSet.add(f);

  // 3. Unstaged changes in tracked files
  const unstaged = runGit(["diff", "--name-only", "--diff-filter=ACMR"]);
  for (const f of unstaged) filesSet.add(f);

  // 4. Untracked files
  const untracked = runGit(["ls-files", "--others", "--exclude-standard"]);
  for (const f of untracked) filesSet.add(f);

  // Filter for packages/db/drizzle/*.sql and check existence
  const result: string[] = [];
  for (const rawPath of filesSet) {
    const normalized = rawPath.replace(/\\/g, "/");
    if (
      normalized.startsWith(`${drizzleDirRel}/`) &&
      normalized.endsWith(".sql")
    ) {
      const fullPath = path.resolve(repoRoot, normalized);
      if (fs.existsSync(fullPath)) {
        result.push(normalized);
      }
    }
  }

  return result.sort();
}

/**
 * Evaluates a list of migration file paths and returns the lint result.
 */
export function evaluateMigrations(filePaths: string[]): MigrationLintResult {
  const violations: MigrationViolation[] = [];
  const scannedFiles: string[] = [];

  for (const filePath of filePaths) {
    const resolvedPath = path.isAbsolute(filePath)
      ? filePath
      : path.resolve(process.cwd(), filePath);

    if (!fs.existsSync(resolvedPath)) {
      continue;
    }

    scannedFiles.push(filePath);
    const content = fs.readFileSync(resolvedPath, "utf-8");
    const statements = parseSqlStatements(content, filePath);

    for (const stmt of statements) {
      const stmtViolations = checkStatement(stmt);
      violations.push(...stmtViolations);
    }
  }

  return {
    passed: violations.length === 0,
    scannedFiles,
    violations,
  };
}
