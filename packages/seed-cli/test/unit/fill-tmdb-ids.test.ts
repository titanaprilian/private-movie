import { describe, it, expect, vi, beforeEach } from "vitest";
import fs from "node:fs";
import {
  parseTmdbFileContent,
  findTmdbMatchForTitle,
  reconstructFileContent,
  fillTmdbIds,
} from "../../src/fill-tmdb-ids";

describe("parseTmdbFileContent", () => {
  it("parses title entries and distinguishes pending, matched, and unmatched entries", () => {
    const rawContent = `# TMDB TV Series IDs to seed
# One TMDB ID per line. Lines starting with # are comments.

# Jujutsu Kaisen
95479

# Unknown Show [UNMATCHED]

# Fullmetal Alchemist: Brotherhood

# Demon Slayer
`;

    const { lines, entries, pendingEntries } = parseTmdbFileContent(rawContent);

    expect(lines.length).toBeGreaterThan(0);
    expect(entries).toHaveLength(4);

    // Jujutsu Kaisen has ID 95479
    expect(entries[0].rawTitle).toBe("Jujutsu Kaisen");
    expect(entries[0].hasId).toBe(true);
    expect(entries[0].existingId).toBe(95479);
    expect(entries[0].isUnmatched).toBe(false);

    // Unknown Show is tagged [UNMATCHED]
    expect(entries[1].rawTitle).toBe("Unknown Show");
    expect(entries[1].hasId).toBe(false);
    expect(entries[1].isUnmatched).toBe(true);

    // Fullmetal Alchemist is pending
    expect(entries[2].rawTitle).toBe("Fullmetal Alchemist: Brotherhood");
    expect(entries[2].hasId).toBe(false);
    expect(entries[2].isUnmatched).toBe(false);

    // Demon Slayer is pending
    expect(entries[3].rawTitle).toBe("Demon Slayer");
    expect(entries[3].hasId).toBe(false);
    expect(entries[3].isUnmatched).toBe(false);

    expect(pendingEntries).toHaveLength(2);
    expect(pendingEntries.map((e) => e.rawTitle)).toEqual([
      "Fullmetal Alchemist: Brotherhood",
      "Demon Slayer",
    ]);
  });
});

describe("findTmdbMatchForTitle", () => {
  const mockFetchFn = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns TV match when TV search score is >= 0.8", async () => {
    mockFetchFn.mockImplementation((url: string) => {
      if (url.includes("/search/tv")) {
        return Promise.resolve({
          results: [
            {
              id: 95479,
              name: "Jujutsu Kaisen",
              original_name: "呪術廻戦",
              first_air_date: "2020-10-03",
              genre_ids: [16, 10759],
            },
          ],
        });
      }
      return Promise.resolve({ results: [] });
    });

    const match = await findTmdbMatchForTitle("Jujutsu Kaisen", {
      token: "test-token",
      confidenceThreshold: 0.8,
      fetchFn: mockFetchFn,
    });

    expect(match).not.toBeNull();
    expect(match?.id).toBe(95479);
    expect(match?.type).toBe("tv");
    expect(match?.score).toBeGreaterThanOrEqual(0.8);
    expect(mockFetchFn).toHaveBeenCalledTimes(1);
  });

  it("falls back to Movie search when TV search has no confident match (score < 0.8)", async () => {
    mockFetchFn.mockImplementation((url: string) => {
      if (url.includes("/search/tv")) {
        return Promise.resolve({
          results: [
            {
              id: 11111,
              name: "Completely Different Show",
              genre_ids: [35],
            },
          ],
        });
      }
      if (url.includes("/search/movie")) {
        return Promise.resolve({
          results: [
            {
              id: 822119,
              title: "Kimi no Na wa.",
              original_title: "君の名は。",
              release_date: "2016-08-26",
              genre_ids: [16, 18, 10749],
            },
          ],
        });
      }
      return Promise.resolve({ results: [] });
    });

    const match = await findTmdbMatchForTitle("Kimi no Na wa.", {
      token: "test-token",
      confidenceThreshold: 0.8,
      fetchFn: mockFetchFn,
    });

    expect(match).not.toBeNull();
    expect(match?.id).toBe(822119);
    expect(match?.type).toBe("movie");
    expect(match?.score).toBeGreaterThanOrEqual(0.8);
    expect(mockFetchFn).toHaveBeenCalledTimes(2);
  });

  it("returns null when neither TV nor Movie search produces a score >= 0.8", async () => {
    mockFetchFn.mockImplementation(() =>
      Promise.resolve({
        results: [
          {
            id: 99999,
            name: "Unrelated Random Series",
            genre_ids: [35],
          },
        ],
      })
    );

    const match = await findTmdbMatchForTitle("Nonexistent Anime Title 12345", {
      token: "test-token",
      confidenceThreshold: 0.8,
      fetchFn: mockFetchFn,
    });

    expect(match).toBeNull();
  });

  it("handles 429 rate limits by retrying after pausing", async () => {
    let attempts = 0;
    const mockSleep = vi.fn().mockResolvedValue(undefined);

    mockFetchFn.mockImplementation((url: string) => {
      if (url.includes("/search/tv")) {
        attempts++;
        if (attempts === 1) {
          return Promise.resolve({
            ok: false,
            status: 429,
            headers: new Map([["retry-after", "1"]]),
          });
        }
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              results: [
                {
                  id: 95479,
                  name: "Jujutsu Kaisen",
                  genre_ids: [16],
                },
              ],
            }),
        });
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve({ results: [] }) });
    });

    const match = await findTmdbMatchForTitle("Jujutsu Kaisen", {
      token: "test-token",
      confidenceThreshold: 0.8,
      fetchFn: mockFetchFn,
      sleepFn: mockSleep,
    });

    expect(attempts).toBe(2);
    expect(mockSleep).toHaveBeenCalledWith(1000);
    expect(match?.id).toBe(95479);
  });
});

describe("reconstructFileContent", () => {
  it("inserts matched ID below title and tags unmatched title line with [UNMATCHED]", () => {
    const rawContent = `# TMDB TV Series IDs to seed

# Jujutsu Kaisen

# Obscure Anime
`;
    const { lines, pendingEntries } = parseTmdbFileContent(rawContent);

    const batchResults = [
      {
        entry: pendingEntries[0],
        match: { id: 95479, score: 0.95, type: "tv" as const },
      },
      {
        entry: pendingEntries[1],
        match: null,
      },
    ];

    const updatedContent = reconstructFileContent(lines, batchResults);

    expect(updatedContent).toContain("# Jujutsu Kaisen\n95479");
    expect(updatedContent).toContain("# Obscure Anime [UNMATCHED]");
  });
});

describe("fillTmdbIds orchestrator", () => {
  it("processes pending titles concurrently in batches and updates the file in-place", async () => {
    const sampleContent = `# TMDB TV Series IDs to seed

# Jujutsu Kaisen

# Kimi no Na wa.

# Unknown Show 12345
`;
    const spyExists = vi.spyOn(fs, "existsSync").mockReturnValue(true);
    const spyRead = vi.spyOn(fs, "readFileSync").mockReturnValue(sampleContent);
    const spyWrite = vi.spyOn(fs, "writeFileSync").mockImplementation(() => {});

    const mockFetchFn = vi.fn().mockImplementation((url: string) => {
      if (url.includes("/search/tv")) {
        if (url.includes("Jujutsu")) {
          return Promise.resolve({
            results: [{ id: 95479, name: "Jujutsu Kaisen", genre_ids: [16] }],
          });
        }
        return Promise.resolve({ results: [] });
      }
      if (url.includes("/search/movie")) {
        if (url.includes("Kimi")) {
          return Promise.resolve({
            results: [{ id: 822119, title: "Kimi no Na wa.", genre_ids: [16] }],
          });
        }
        return Promise.resolve({ results: [] });
      }
      return Promise.resolve({ results: [] });
    });

    const summary = await fillTmdbIds({
      idsFilePath: "/dummy/tmdb-ids.txt",
      token: "test-token",
      batchSize: 2,
      confidenceThreshold: 0.8,
      fetchFn: mockFetchFn,
      logFn: () => {},
    });

    expect(summary.totalEntries).toBe(3);
    expect(summary.skippedEntries).toBe(0);
    expect(summary.pendingEntries).toBe(3);
    expect(summary.matchedTvCount).toBe(1);
    expect(summary.matchedMovieCount).toBe(1);
    expect(summary.unmatchedCount).toBe(1);

    expect(spyWrite).toHaveBeenCalled();
    const lastWrittenContent = spyWrite.mock.calls[spyWrite.mock.calls.length - 1][1] as string;

    expect(lastWrittenContent).toContain("# Jujutsu Kaisen\n95479");
    expect(lastWrittenContent).toContain("# Kimi no Na wa.\n822119");
    expect(lastWrittenContent).toContain("# Unknown Show 12345 [UNMATCHED]");

    spyExists.mockRestore();
    spyRead.mockRestore();
    spyWrite.mockRestore();
  });
});
