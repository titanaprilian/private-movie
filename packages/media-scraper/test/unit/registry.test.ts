import { beforeEach, describe, expect, it } from "vitest";
import { MediaScraper, type MediaProvider, type FetchFn } from "../../src";

describe("MediaScraper Registry", () => {
  const dummyProvider: MediaProvider = {
    name: "dummy",
    canHandle: (url: string) => url.includes("example.com"),
    parseSeries: async () => ({ title: "Test", episodes: [] }),
    parseEpisode: async () => ({ title: "Test Ep", videoSources: [] }),
    resolveVideoSources: async () => [],
  };

  beforeEach(() => {
    MediaScraper.unregisterAll();
  });

  it("returns null when no provider matches the URL", () => {
    expect(MediaScraper.getProviderForUrl("https://unknown.com/video")).toBeNull();
  });

  it("returns registered provider when URL matches canHandle", () => {
    MediaScraper.registerProvider(dummyProvider);
    const provider = MediaScraper.getProviderForUrl("https://example.com/video");
    expect(provider).toBe(dummyProvider);
    expect(provider?.name).toBe("dummy");
  });

  it("supports instance-based provider registration and lookup", () => {
    const scraper = new MediaScraper([dummyProvider]);
    expect(scraper.getProviderForUrl("https://example.com/item")).toBe(dummyProvider);
    expect(scraper.getProviderForUrl("https://other.com/item")).toBeNull();
  });
});
