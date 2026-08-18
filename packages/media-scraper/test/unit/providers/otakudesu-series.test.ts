import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  OtakudesuProvider,
  SeriesParseError,
  type FetchFn,
} from "../../../src";

describe("OtakudesuProvider series parsing", () => {
  const sampleSeriesListHtml = fs.readFileSync(
    path.resolve(import.meta.dirname, "../../fixtures/sample-series-list.html"),
    "utf8"
  );

  const provider = new OtakudesuProvider();

  const createMockFetchFn = (html: string): FetchFn => ({
    get: async () => html,
    post: async () => "",
  });

  it("identifies matching URLs with canHandle", () => {
    expect(provider.canHandle("https://otakudesu.blog/anime/test")).toBe(true);
    expect(provider.canHandle("https://otakudesu.cloud/anime/test")).toBe(true);
    expect(provider.canHandle("https://other-domain.com/anime/test")).toBe(false);
  });

  it("extracts series title and poster from sample-series-list.html using targetUrl", async () => {
    const targetUrl =
      "https://otakudesu.blog/anime/tsuihou-game-chishiki-suru-sub-indo/";
    const fetchFn = createMockFetchFn(sampleSeriesListHtml);
    const result = await provider.parseSeries(targetUrl, fetchFn);

    expect(result.title).toBe(
      "Tsuihou sareta Tensei Juukishi wa Game Chishiki de Musou suru"
    );
    expect(result.posterUrl).toBe(
      "https://otakudesu.blog/wp-content/uploads/2026/07/Tsuihou-sareta-Tensei-Juukishi-wa-Game-Chishiki-de-Musou-suru.jpg"
    );
  });

  it("extracts series title and poster from sample-series-list.html using targetUrl without trailing slash", async () => {
    const targetUrl =
      "https://otakudesu.blog/anime/tsuihou-game-chishiki-suru-sub-indo";
    const fetchFn = createMockFetchFn(sampleSeriesListHtml);
    const result = await provider.parseSeries(targetUrl, fetchFn);

    expect(result.title).toBe(
      "Tsuihou sareta Tensei Juukishi wa Game Chishiki de Musou suru"
    );
    expect(result.posterUrl).toBe(
      "https://otakudesu.blog/wp-content/uploads/2026/07/Tsuihou-sareta-Tensei-Juukishi-wa-Game-Chishiki-de-Musou-suru.jpg"
    );
  });

  it("extracts first series title and poster from sample-series-list.html when no targetUrl matches", async () => {
    const targetUrl = "https://otakudesu.blog/anime/unknown-series/";
    const fetchFn = createMockFetchFn(sampleSeriesListHtml);
    const result = await provider.parseSeries(targetUrl, fetchFn);

    expect(result.title).toBe("Uchi no Otouto-domo ga Sumimasen");
    expect(result.posterUrl).toBe(
      "https://otakudesu.blog/wp-content/uploads/2026/07/Uchi-no-Otouto-domo-ga-Sumimasen.jpg"
    );
  });

  it("extracts series title and poster from single series HTML structure with fallback selectors", async () => {
    const html = `
      <div id="venkonten">
        <div class="fotoanime">
          <img src="https://example.com/poster.jpg" />
          <h1>My Awesome Anime</h1>
        </div>
        <div class="sinopc">
          <p>This is a great anime series summary.</p>
        </div>
      </div>
    `;

    const fetchFn = createMockFetchFn(html);
    const result = await provider.parseSeries("https://otakudesu.blog/anime/my-awesome-anime", fetchFn);
    expect(result.title).toBe("My Awesome Anime");
    expect(result.posterUrl).toBe("https://example.com/poster.jpg");
    expect(result.description).toBe("This is a great anime series summary.");
  });

  it("extracts series info from single series HTML with alternative selectors (.posttl, .thumb img, .sinopsis)", async () => {
    const html = `
      <div id="venkonten">
        <h1 class="posttl">Alternative Title Anime</h1>
        <div class="thumb">
          <img src="https://example.com/alt-poster.jpg" />
        </div>
        <div class="sinopsis">
          <p>Alternative synopsis description text.</p>
        </div>
      </div>
    `;

    const fetchFn = createMockFetchFn(html);
    const result = await provider.parseSeries("https://otakudesu.blog/anime/alt-anime", fetchFn);
    expect(result.title).toBe("Alternative Title Anime");
    expect(result.posterUrl).toBe("https://example.com/alt-poster.jpg");
    expect(result.description).toBe("Alternative synopsis description text.");
  });

  it("extracts series info using strategy 1 with link title attribute and container poster", async () => {
    const html = `
      <div class="detpost">
        <a href="https://otakudesu.blog/anime/my-series/" title="Title From Attribute"></a>
        <div class="thumb">
          <img src="https://example.com/container-poster.png" />
        </div>
      </div>
    `;

    const fetchFn = createMockFetchFn(html);
    const result = await provider.parseSeries(
      "https://otakudesu.blog/anime/my-series/",
      fetchFn
    );
    expect(result.title).toBe("Title From Attribute");
    expect(result.posterUrl).toBe("https://example.com/container-poster.png");
    expect(result.description).toBeNull();
  });

  it("extracts series info using strategy 3 fallback (.detpost a with title attribute)", async () => {
    const html = `
      <div class="detpost">
        <a href="https://otakudesu.blog/anime/fallback-series/" title="Fallback Series Title">
          <img src="https://example.com/fallback-poster.jpg" />
        </a>
      </div>
    `;

    const fetchFn = createMockFetchFn(html);
    const result = await provider.parseSeries("https://otakudesu.blog/anime/some-series", fetchFn);
    expect(result.title).toBe("Fallback Series Title");
    expect(result.posterUrl).toBe("https://example.com/fallback-poster.jpg");
    expect(result.description).toBeNull();
  });

  it("throws SeriesParseError with 'missing series title' when HTML is empty or malformed", async () => {
    const html = `<div><p>Empty page with no title</p></div>`;
    const fetchFn = createMockFetchFn(html);
    await expect(
      provider.parseSeries("https://otakudesu.blog/anime/empty", fetchFn)
    ).rejects.toThrowError(new SeriesParseError("missing series title"));
  });
});
