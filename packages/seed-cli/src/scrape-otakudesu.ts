import fs from "node:fs";
import path from "node:path";
import * as cheerio from "cheerio";

export interface ScrapeOtakudesuOptions {
  totalPages?: number;
  delayMs?: number;
  outputPath?: string;
  baseUrl?: string;
  fetchFn?: (url: string) => Promise<string>;
  sleepFn?: (ms: number) => Promise<void>;
  logFn?: (message: string) => void;
}

export function sanitizeTitle(title: string): string {
  return title
    .replace(/(?:Season\s\d+|Part\s\d+|\(TV\))/gi, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

export function parseAnimeTitlesFromHtml(html: string): string[] {
  const $ = cheerio.load(html);
  const titles: string[] = [];
  $(".detpost").each((_, element) => {
    let title =
      $(element).find(".jdlflm").text().trim() ||
      $(element).find("h2").text().trim() ||
      $(element).find("a").attr("title")?.trim();
    if (title) {
      title = sanitizeTitle(title);
      titles.push(title);
    }
  });
  return titles;
}

export function formatTitlesForSeedFile(titles: string[]): string {
  if (titles.length === 0) return "";
  return titles.map((title) => `# ${title}\n\n`).join("");
}

export function resolveOutputPath(customPath?: string): string {
  if (customPath) return path.resolve(customPath);
  const cwd = process.cwd();
  if (cwd.endsWith("packages/seed-cli") || fs.existsSync(path.resolve(cwd, "tmdb-ids.txt"))) {
    return path.resolve(cwd, "tmdb-ids.txt");
  }
  return path.resolve(cwd, "packages/seed-cli/tmdb-ids.txt");
}

export const DEFAULT_BASE_URL = "https://otakudesu.blog/complete-anime/page/";
export const DEFAULT_TOTAL_PAGES = 67;
export const DEFAULT_DELAY_MS = 500;

export async function defaultFetchHtml(url: string): Promise<string> {
  const response = await fetch(url, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    },
  });
  if (!response.ok) {
    throw new Error(`Failed to fetch ${url}: HTTP ${response.status}`);
  }
  return await response.text();
}

export async function scrapeOtakudesu(
  options: ScrapeOtakudesuOptions = {}
): Promise<{ totalScraped: number }> {
  const totalPages = options.totalPages ?? DEFAULT_TOTAL_PAGES;
  const delayMs = options.delayMs ?? DEFAULT_DELAY_MS;
  const baseUrl = options.baseUrl ?? DEFAULT_BASE_URL;
  const outputPath = resolveOutputPath(options.outputPath);
  const fetchFn = options.fetchFn ?? defaultFetchHtml;
  const sleepFn =
    options.sleepFn ??
    ((ms: number) => new Promise((resolve) => setTimeout(resolve, ms)));
  const log = options.logFn ?? console.log;

  log(`Starting crawl of ${totalPages} pages from ${baseUrl}...`);
  log(`Output file destination: ${outputPath}`);

  let totalScraped = 0;

  for (let page = 1; page <= totalPages; page++) {
    const pageUrl = `${baseUrl}${page}/`;
    log(`[Page ${page}/${totalPages}] Fetching ${pageUrl}...`);

    try {
      const html = await fetchFn(pageUrl);
      const titles = parseAnimeTitlesFromHtml(html);
      log(`[Page ${page}/${totalPages}] Extracted ${titles.length} titles.`);

      if (titles.length > 0) {
        const formattedText = formatTitlesForSeedFile(titles);
        fs.appendFileSync(outputPath, formattedText);
        totalScraped += titles.length;
      }
    } catch (err) {
      log(
        `[Page ${page}/${totalPages}] Error fetching/parsing page: ${
          err instanceof Error ? err.message : String(err)
        }`
      );
    }

    if (page < totalPages && delayMs > 0) {
      await sleepFn(delayMs);
    }
  }

  log(`Scraping complete. Total titles appended: ${totalScraped}`);
  return { totalScraped };
}

if (import.meta.main) {
  scrapeOtakudesu().catch((err) => {
    console.error("Fatal error during scraping:", err);
    process.exit(1);
  });
}
