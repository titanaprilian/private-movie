import { describe, expect, it } from "vitest";
import {
  parseVideoQuality,
  sortVideoSources,
} from "../../../src/internal/playback/normalization";

describe("parseVideoQuality", () => {
  it("extracts integer quality from standard strings", () => {
    expect(parseVideoQuality("1080p")).toBe(1080);
    expect(parseVideoQuality("720p")).toBe(720);
    expect(parseVideoQuality("480p")).toBe(480);
    expect(parseVideoQuality("360P")).toBe(360);
    expect(parseVideoQuality("4k")).toBe(4);
    expect(parseVideoQuality("2160p")).toBe(2160);
  });

  it("handles labels and strings with embedded numbers", () => {
    expect(parseVideoQuality("HD 1080p")).toBe(1080);
    expect(parseVideoQuality("Stream 720")).toBe(720);
  });

  it("returns 0 for null, undefined, or strings without digits", () => {
    expect(parseVideoQuality(null)).toBe(0);
    expect(parseVideoQuality(undefined)).toBe(0);
    expect(parseVideoQuality("")).toBe(0);
    expect(parseVideoQuality("HD")).toBe(0);
    expect(parseVideoQuality("unknown")).toBe(0);
  });
});

describe("sortVideoSources", () => {
  it("sorts strictly by tier priority: s3 > direct > embed", () => {
    const sources = [
      { id: "1", type: "embed", url: "https://embed.com/1", quality: "1080p" },
      { id: "2", type: "s3", url: "episodes/1.mp4", quality: "720p" },
      { id: "3", type: "direct", url: "https://direct.com/1.mp4", quality: "1080p" },
    ];

    const sorted = sortVideoSources(sources);
    expect(sorted.map((s) => s.id)).toEqual(["2", "3", "1"]);
  });

  it("breaks ties within the same tier by resolution quality descending", () => {
    const sources = [
      { id: "1", type: "direct", url: "https://direct.com/480", quality: "480p" },
      { id: "2", type: "direct", url: "https://direct.com/1080", quality: "1080p" },
      { id: "3", type: "direct", url: "https://direct.com/720", quality: "720p" },
      { id: "4", type: "direct", url: "https://direct.com/none", quality: null },
    ];

    const sorted = sortVideoSources(sources);
    expect(sorted.map((s) => s.id)).toEqual(["2", "3", "1", "4"]);
  });

  it("breaks ties with identical tier and quality by createdAt ascending", () => {
    const t1 = new Date("2026-01-01T10:00:00Z");
    const t2 = new Date("2026-01-01T11:00:00Z");
    const t3 = new Date("2026-01-01T12:00:00Z");

    const sources = [
      { id: "3", type: "direct", url: "https://direct.com/3", quality: "1080p", createdAt: t3 },
      { id: "1", type: "direct", url: "https://direct.com/1", quality: "1080p", createdAt: t1 },
      { id: "2", type: "direct", url: "https://direct.com/2", quality: "1080p", createdAt: t2 },
    ];

    const sorted = sortVideoSources(sources);
    expect(sorted.map((s) => s.id)).toEqual(["1", "2", "3"]);
  });

  it("handles string createdAt and missing createdAt gracefully", () => {
    const sources = [
      { id: "2", type: "embed", url: "https://embed.com/2", createdAt: "2026-01-02T00:00:00Z" },
      { id: "1", type: "embed", url: "https://embed.com/1", createdAt: "2026-01-01T00:00:00Z" },
      { id: "3", type: "embed", url: "https://embed.com/3" },
    ];

    const sorted = sortVideoSources(sources);
    expect(sorted.map((s) => s.id)).toEqual(["3", "1", "2"]); // 0 timestamp before t1 before t2
  });

  it("handles non-standard source types safely by assigning lowest priority", () => {
    const sources = [
      { id: "1", type: "unknown", url: "https://foo.com/1" },
      { id: "2", type: "embed", url: "https://embed.com/1" },
      { id: "3", type: "s3", url: "episodes/1.mp4" },
    ];

    const sorted = sortVideoSources(sources);
    expect(sorted.map((s) => s.id)).toEqual(["3", "2", "1"]);
  });

  it("does not mutate the original array and returns a new sorted copy", () => {
    const original = [
      { id: "1", type: "embed", url: "https://embed.com/1" },
      { id: "2", type: "s3", url: "episodes/1.mp4" },
    ];

    const sorted = sortVideoSources(original);
    expect(sorted).not.toBe(original);
    expect(original[0].id).toBe("1");
    expect(sorted[0].id).toBe("2");
  });
});
