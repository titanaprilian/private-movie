import fs from "node:fs";
import path from "node:path";

export interface MarkdownLink {
  text: string;
  target: string;
  line: number;
}

export interface DocLinkViolation {
  file: string;
  line: number;
  target: string;
  reason: "file_not_found" | "anchor_not_found";
  details?: string;
}

export interface DocCheckResult {
  passed: boolean;
  totalFiles: number;
  totalLinks: number;
  violations: DocLinkViolation[];
}

export const DEFAULT_IGNORED_DIRS = [
  "node_modules",
  ".turbo",
  "dist",
  ".git",
  "coverage",
  "build",
  ".gradle",
];

/**
 * Derives a GitHub-compatible anchor slug from heading text.
 */
export function githubSlug(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/<[^>]+>/g, "")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/[^\p{L}\p{M}\p{N}\p{Pc}\- ]/gu, "")
    .replace(/\s/g, "-");
}

/**
 * Extracts all valid heading and HTML anchors from markdown content.
 */
export function extractMarkdownAnchors(content: string): Set<string> {
  const anchors = new Set<string>();
  const counts = new Map<string, number>();
  let inCodeBlock = false;

  const lines = content.split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith("```") || trimmed.startsWith("~~~")) {
      inCodeBlock = !inCodeBlock;
      continue;
    }
    if (inCodeBlock) continue;

    const headingMatch = line.match(/^#{1,6}\s+(.+)$/);
    if (headingMatch) {
      const title = headingMatch[1].trim();
      const baseSlug = githubSlug(title);
      if (baseSlug) {
        const count = counts.get(baseSlug) ?? 0;
        counts.set(baseSlug, count + 1);
        const slug = count === 0 ? baseSlug : `${baseSlug}-${count}`;
        anchors.add(slug);
      }
    }

    // Match explicit HTML anchors <a id="..." or <a name="..." or <span id="..."
    const htmlAnchorRegex =
      /<(?:[a-zA-Z0-9]+)[^>]*(?:id|name)=["']([^"']+)["']/gi;
    let match: RegExpExecArray | null;
    while ((match = htmlAnchorRegex.exec(line)) !== null) {
      if (match[1]) {
        anchors.add(match[1]);
      }
    }
  }

  return anchors;
}

/**
 * Extracts all non-external links and image links from markdown content, ignoring code blocks.
 */
export function extractMarkdownLinks(content: string): MarkdownLink[] {
  const links: MarkdownLink[] = [];
  let inCodeBlock = false;

  const lines = content.split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();
    if (trimmed.startsWith("```") || trimmed.startsWith("~~~")) {
      inCodeBlock = !inCodeBlock;
      continue;
    }
    if (inCodeBlock) continue;

    // Matches [text](target) and ![alt](target)
    const linkRegex = /!?\[([^\]]*)\]\(([^)]+)\)/g;
    let match: RegExpExecArray | null;
    while ((match = linkRegex.exec(line)) !== null) {
      const text = match[1];
      const rawTarget = match[2].trim();

      // Skip external protocols or non-navigational schemes
      if (
        !rawTarget ||
        rawTarget.startsWith("http://") ||
        rawTarget.startsWith("https://") ||
        rawTarget.startsWith("mailto:") ||
        rawTarget.startsWith("tel:") ||
        rawTarget.startsWith("javascript:")
      ) {
        continue;
      }

      links.push({
        text,
        target: rawTarget,
        line: i + 1,
      });
    }
  }

  return links;
}

/**
 * Recursively locates markdown files within a directory, ignoring specified directories.
 */
export function findMarkdownFiles(
  dir: string,
  ignoredDirs: string[] = DEFAULT_IGNORED_DIRS,
): string[] {
  const results: string[] = [];

  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    if (ignoredDirs.includes(entry.name)) continue;

    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...findMarkdownFiles(fullPath, ignoredDirs));
    } else if (entry.isFile() && entry.name.endsWith(".md")) {
      results.push(fullPath);
    }
  }

  return results;
}

/**
 * Checks all local markdown links in a given file.
 */
export function checkFileLinks(
  filePath: string,
  content: string,
  fileExistsFn: (p: string) => boolean = fs.existsSync,
  readFileFn: (p: string) => string = (p) => fs.readFileSync(p, "utf-8"),
  anchorCache: Map<string, Set<string>> = new Map(),
): DocLinkViolation[] {
  const violations: DocLinkViolation[] = [];
  const links = extractMarkdownLinks(content);
  const fileDir = path.dirname(filePath);

  if (filePath.endsWith(".md") && !anchorCache.has(filePath)) {
    anchorCache.set(filePath, extractMarkdownAnchors(content));
  }

  for (const link of links) {
    // Strip query parameters if present
    const [pathAndAnchor] = link.target.split("?");
    const [relPath, anchor] = pathAndAnchor.split("#");

    const targetFilePath = relPath
      ? path.resolve(fileDir, decodeURIComponent(relPath))
      : filePath;

    if (!fileExistsFn(targetFilePath)) {
      violations.push({
        file: filePath,
        line: link.line,
        target: link.target,
        reason: "file_not_found",
        details: `Target file does not exist: ${targetFilePath}`,
      });
      continue;
    }

    if (anchor) {
      let targetAnchors = anchorCache.get(targetFilePath);
      if (!targetAnchors) {
        if (targetFilePath.endsWith(".md")) {
          try {
            const targetContent = readFileFn(targetFilePath);
            targetAnchors = extractMarkdownAnchors(targetContent);
          } catch {
            targetAnchors = new Set();
          }
        } else {
          // If referencing a non-markdown file with an anchor, allow it or treat as no anchors
          targetAnchors = new Set();
        }
        anchorCache.set(targetFilePath, targetAnchors);
      }

      if (targetFilePath.endsWith(".md") && !targetAnchors.has(anchor)) {
        violations.push({
          file: filePath,
          line: link.line,
          target: link.target,
          reason: "anchor_not_found",
          details: `Anchor #${anchor} not found in target file: ${targetFilePath}`,
        });
      }
    }
  }

  return violations;
}

/**
 * Scans all documentation files or a targeted subset for broken local links and anchors.
 */
export function checkAllDocs(
  rootDir: string,
  files?: string[],
): DocCheckResult {
  const targetFiles =
    files && files.length > 0 ? files : findMarkdownFiles(rootDir);

  const anchorCache = new Map<string, Set<string>>();
  const allViolations: DocLinkViolation[] = [];
  let totalLinks = 0;

  for (const file of targetFiles) {
    if (!fs.existsSync(file)) continue;
    const content = fs.readFileSync(file, "utf-8");
    const links = extractMarkdownLinks(content);
    totalLinks += links.length;

    const violations = checkFileLinks(
      file,
      content,
      fs.existsSync,
      (p) => fs.readFileSync(p, "utf-8"),
      anchorCache,
    );
    allViolations.push(...violations);
  }

  return {
    passed: allViolations.length === 0,
    totalFiles: targetFiles.length,
    totalLinks,
    violations: allViolations,
  };
}
