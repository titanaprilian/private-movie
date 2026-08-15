import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  parseSeriesPage,
  SeriesParseError,
} from "@/modules/media/internal/series/parse";

describe("parseSeriesPage", () => {
  const sampleSeriesListHtml = fs.readFileSync(
    path.resolve(import.meta.dirname, "../../fixtures/series/sample-series-list.html"),
    "utf8"
  );

  it("extracts series title and poster from sample-series-list.html using targetUrl", () => {
    const targetUrl =
      "https://otakudesu.blog/anime/tsuihou-game-chishiki-suru-sub-indo/";
    const result = parseSeriesPage(sampleSeriesListHtml, targetUrl);

    expect(result.title).toBe(
      "Tsuihou sareta Tensei Juukishi wa Game Chishiki de Musou suru"
    );
    expect(result.posterUrl).toBe(
      "https://otakudesu.blog/wp-content/uploads/2026/07/Tsuihou-sareta-Tensei-Juukishi-wa-Game-Chishiki-de-Musou-suru.jpg"
    );
  });

  it("extracts series title and poster from sample-series-list.html using targetUrl without trailing slash", () => {
    const targetUrl =
      "https://otakudesu.blog/anime/tsuihou-game-chishiki-suru-sub-indo";
    const result = parseSeriesPage(sampleSeriesListHtml, targetUrl);

    expect(result.title).toBe(
      "Tsuihou sareta Tensei Juukishi wa Game Chishiki de Musou suru"
    );
    expect(result.posterUrl).toBe(
      "https://otakudesu.blog/wp-content/uploads/2026/07/Tsuihou-sareta-Tensei-Juukishi-wa-Game-Chishiki-de-Musou-suru.jpg"
    );
  });

  it("extracts first series title and poster from sample-series-list.html when no targetUrl matches", () => {
    const result = parseSeriesPage(sampleSeriesListHtml);

    expect(result.title).toBe("Uchi no Otouto-domo ga Sumimasen");
    expect(result.posterUrl).toBe(
      "https://otakudesu.blog/wp-content/uploads/2026/07/Uchi-no-Otouto-domo-ga-Sumimasen.jpg"
    );
  });

  it("extracts series title and poster from single series HTML structure with fallback selectors", () => {
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

    const result = parseSeriesPage(html);
    expect(result.title).toBe("My Awesome Anime");
    expect(result.posterUrl).toBe("https://example.com/poster.jpg");
    expect(result.description).toBe("This is a great anime series summary.");
  });

  it("extracts series info from single series HTML with alternative selectors (.posttl, .thumb img, .sinopsis)", () => {
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

    const result = parseSeriesPage(html);
    expect(result.title).toBe("Alternative Title Anime");
    expect(result.posterUrl).toBe("https://example.com/alt-poster.jpg");
    expect(result.description).toBe("Alternative synopsis description text.");
  });

  it("extracts series info using strategy 1 with link title attribute and container poster", () => {
    const html = `
      <div class="detpost">
        <a href="https://otakudesu.blog/anime/my-series/" title="Title From Attribute"></a>
        <div class="thumb">
          <img src="https://example.com/container-poster.png" />
        </div>
      </div>
    `;

    const result = parseSeriesPage(
      html,
      "https://otakudesu.blog/anime/my-series/"
    );
    expect(result.title).toBe("Title From Attribute");
    expect(result.posterUrl).toBe("https://example.com/container-poster.png");
    expect(result.description).toBeNull();
  });

  it("extracts series info using strategy 3 fallback (.detpost a with title attribute)", () => {
    const html = `
      <div class="detpost">
        <a href="https://otakudesu.blog/anime/fallback-series/" title="Fallback Series Title">
          <img src="https://example.com/fallback-poster.jpg" />
        </a>
      </div>
    `;

    const result = parseSeriesPage(html);
    expect(result.title).toBe("Fallback Series Title");
    expect(result.posterUrl).toBe("https://example.com/fallback-poster.jpg");
    expect(result.description).toBeNull();
  });

  it("throws SeriesParseError with 'missing series title' when HTML is empty or malformed", () => {
    const html = `<div><p>Empty page with no title</p></div>`;
    expect(() => parseSeriesPage(html)).toThrowError(
      new SeriesParseError("missing series title")
    );
  });
});
