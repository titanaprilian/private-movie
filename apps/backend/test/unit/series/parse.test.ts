import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  parseSeriesPage,
  SeriesParseError,
} from "../../../src/modules/media/internal/series/parse";

describe("parseSeriesPage", () => {
  const sampleSeriesListHtml = fs.readFileSync(
    path.join(__dirname, "../../fixtures/episodes/sample-series-list.html"),
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

  it("extracts first series title and poster from sample-series-list.html when no targetUrl matches", () => {
    const result = parseSeriesPage(sampleSeriesListHtml);

    expect(result.title).toBe("Uchi no Otouto-domo ga Sumimasen");
    expect(result.posterUrl).toBe(
      "https://otakudesu.blog/wp-content/uploads/2026/07/Uchi-no-Otouto-domo-ga-Sumimasen.jpg"
    );
  });

  it("extracts series title and poster from single series HTML structure", () => {
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

  it("throws SeriesParseError when title is missing", () => {
    const html = `<div><p>Empty page</p></div>`;
    expect(() => parseSeriesPage(html)).toThrow(SeriesParseError);
  });
});
