# Handoff: Video Scraper (MVP)

## 1. Background & Requirements

We need to scrape video data from an anime streaming site (otakudesu.blog). The actual video URL is only revealed after a user click (client-side JS), so automated crawling is out of scope.

**MVP decision (user-approved):** Manual copy-paste workflow.
The user copies the rendered HTML of the relevant page section from browser DevTools and submits it to our backend, which parses it, extracts the fields, and saves them to the database. Trigger is on-demand only ("just when I want to").

Fields to capture:

| Field        | Source                                                                                                                                         | Required |
| ------------ | ---------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| `title`      | `h1.posttl` inside `#venkonten`                                                                                                                | yes      |
| `video_url`  | `src` attribute of the `<iframe>` inside `#venkonten`                                                                                          | yes      |
| `video_type` | `<b>Tipe</b>` row inside `.infozingle` when present (e.g. `TV`); **null when absent** (sample A has no `.infozingle`, sample B has `Tipe: TV`) | no       |
| metadata     | episode list, prev/next links, genres, duration, poster image, anime page URL (see §4)                                                         | no       |

**There are multiple embed-host variants — two confirmed samples:**

- **Sample A:** iframe src = `https://odvidhide.com/embed/<id>`; no `.infozingle` info block on the page.
- **Sample B:** iframe src = `https://desustream.net/dstream/...?id=<base64>`; page also contains `.infozingle` (genres, duration, Tipe), `.download` link lists, and a poster image.

The embed host is NOT fixed — do **not** hardcode or branch on the URL prefix. Always extract `iframe[src]` generically.

## 2. Key Decisions (already made — do not relitigate)

1. **No headless browser.** No Playwright/Puppeteer. Parse pasted static HTML only.
2. **Parser:** `cheerio`, loaded as a fragment (`cheerio.load(html, null, false)`).
3. The iframe URL is a third-party embed page on varying hosts (confirmed: `odvidhide.com`, `desustream.net`; more may appear). It opens standalone in a new tab and is streamable. **Store it as-is as `video_url`.** Do not attempt to resolve it to a direct `.mp4` file in the MVP, and never branch on the host prefix.
4. `video_type`: read from the `<b>Tipe</b>` row in `.infozingle` when present (e.g. `TV`); otherwise store null. Do **not** infer it from the title.
5. Deduplication: unique on `source_url` (the otakudesu episode page URL the user provides). Re-submitting the same page **upserts** (updates in place), never duplicates.
6. `sourceUrl` is a **required** request field.

## 3. Input Sample Structures

The user pastes the HTML of `<div id="venkonten">...</div>`. There are two confirmed page variants; full copies of both are committed in this repo under `docs/handoff-fixtures/` — copy them into the target repo's test fixtures.

### 3.1 Sample A — minimal variant (no info block)

```html
<div id="venkonten">
  <div class="venser">
    <div class="venutama">
      <h1 class="posttl">
        Tsuihou sareta Tensei Juukishi wa ... Episode 7 Subtitle Indonesia
      </h1>
      <div class="prevnext">
        <select id="selectcog">
          <option value="0">Pilih Episode Lainnya</option>
          <option
            value="https://otakudesu.blog/episode/...-episode-7-sub-indo/"
          >
            Episode 7
          </option>
          <!-- ... one option per episode ... -->
        </select>
        <a href="https://otakudesu.blog/episode/...-episode-6-sub-indo/"
          >Previous Eps.</a
        >
        <a href="https://otakudesu.blog/anime/...-sub-indo/"
          >See All Episodes</a
        >
      </div>
      <div id="lightsVideo">
        <div class="player-embed" id="pembed">
          <div class="responsive-embed-stream">
            <iframe
              src="https://odvidhide.com/embed/sylmpeaf3wzs"
              width="420"
              height="370"
              allowfullscreen="true"
            ></iframe>
          </div>
        </div>
      </div>
    </div>
  </div>
</div>
```

### 3.2 Sample B — full variant (with info block + download lists)

Same skeleton as Sample A, with these additions:

```html
<div id="venkonten">
  <!-- ... same head/h1/prevnext ... -->
  <div class="responsive-embed-stream">
    <iframe src="https://desustream.net/dstream/arcg/?id=WEwyVVQy..."></iframe>
    <!-- NOTE: different host -->
  </div>

  <!-- Mirror switcher: URLs are NOT in the HTML (base64 data-content resolved by JS) -> IGNORE in MVP -->
  <div class="mirrorstream">
    <ul class="m360p">
      Mirror 360p
      <li><a href="#" data-content="eyJpZCI6...">filedon</a></li>
      ...
    </ul>
  </div>

  <!-- Download link lists (file hosts per quality/codec) -> optional metadata in MVP -->
  <div class="download">
    <li>
      <strong>Mp4 360p</strong>
      <a href="https://link.desustream.com/?id=...">Filedon</a> ...
      <i>40.7 MB</i>
    </li>
  </div>

  <!-- Info block -> source of video_type, genres, duration, poster -->
  <div class="cukder">
    <img
      src="https://otakudesu.blog/wp-content/uploads/2026/07/157173.jpg"
      alt="..."
    />
    <div class="infozin">
      <div class="infozingle">
        <p>
          <b>Genres</b>: <a href=".../genres/action/">Action</a>,
          <a href=".../genres/fantasy/">Fantasy</a>
        </p>
        <p>
          <span><b>Duration</b>: 23 min. per ep.</span>
        </p>
        <p>
          <span><b>Tipe</b>: TV</span>
        </p>
      </div>
    </div>
  </div>
</div>
```

Important pitfalls:

- `.mirrorstream` links contain **no real URL** (only base64 `data-content` resolved client-side). Do not try to extract URLs from it in the MVP — ignore it entirely.
- `.download` links are redirector URLs (`link.desustream.com/?id=...`) for file downloads, not streaming URLs. They are NOT `video_url`. Optionally store them under `metadata.downloadLinks`.
- The poster is `.cukder img` — store its `src` as `metadata.posterUrl`.

## 4. Extraction Logic (reference implementation)

Scoped to `#venkonten`; anything outside it must be ignored (the fragment contains ads, jQuery, CSS — ignore all of it):

```ts
import * as cheerio from "cheerio";

const root = cheerio.load(html, null, false); // fragment mode
const box = root("#venkonten");
// if box.length === 0 -> 400 validation error

const title = box.find("h1.posttl").text().trim();
const videoUrl = box.find(".responsive-embed-stream iframe").attr("src"); // host-agnostic: odvidhide, desustream, others
// videoType: <b>Tipe</b> row in .infozingle when present (Sample B), null otherwise (Sample A)
const infoRow = (label: string) =>
  box
    .find(".infozingle b")
    .filter((_, el) => root(el).text().trim() === label)
    .first()
    .parent()
    .text()
    .replace(label, "")
    .replace(":", "")
    .trim() || null;
const videoType = infoRow("Tipe"); // e.g. "TV" or null
const duration = infoRow("Duration"); // e.g. "23 min. per ep." or null

// optional metadata
const genres = box
  .find(".infozingle b")
  .filter((_, el) => root(el).text().trim() === "Genres")
  .parent()
  .find("a")
  .map((_, el) => root(el).text().trim())
  .get(); // -> null if empty

const posterUrl = box.find(".cukder img").attr("src") ?? null;

const episodes = box
  .find("#selectcog option[value]")
  .map((_, el) => ({
    label: root(el).text().trim(),
    url: root(el).attr("value"),
  }))
  .get()
  .filter((e) => e.url && e.url !== "0" && e.url.startsWith("http"));
const animePageUrl =
  box.find(".prevnext .flir a:contains('See All Episodes')").attr("href") ??
  null;

const downloadLinks = box
  .find(".download li")
  .map((_, li) => {
    const quality = root(li).find("strong").first().text().trim(); // e.g. "Mp4 360p"
    const size = root(li).find("i").first().text().trim() || null; // e.g. "40.7 MB"
    const hosts = root(li)
      .find("a")
      .map((_, a) => ({
        host: root(a).text().trim(),
        url: root(a).attr("href"),
      }))
      .get();
    return { quality, size, hosts };
  })
  .get(); // -> null if empty (Sample A)
```

Edge cases to handle:

- Missing `#venkonten`, missing title, or missing iframe/src → HTTP 400 with a clear error message.
- `<option value="0">` placeholder must not be treated as an episode URL.
- Trim whitespace on the title.
- All Sample-B-only fields (`videoType`, `genres`, `duration`, `posterUrl`, `downloadLinks`) must be nullable/omitted gracefully for Sample A.
- Never branch on the iframe host prefix; unknown embed hosts are fine as long as `src` exists.

## 5. Database Schema (drizzle)

Add a `videos` table (mirror existing schema conventions in the target repo's db package):

| Column                    | Type       | Notes                                                                                                                                                     |
| ------------------------- | ---------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `id`                      | uuid       | PK                                                                                                                                                        |
| `sourceUrl`               | text       | unique, not null — otakudesu page URL, upsert key                                                                                                         |
| `title`                   | text       | not null                                                                                                                                                  |
| `videoType`               | text       | nullable                                                                                                                                                  |
| `videoUrl`                | text       | not null — the iframe/embed URL                                                                                                                           |
| `metadata`                | jsonb      | `{ genres, duration, posterUrl, episodes: [{label,url}], animePageUrl, downloadLinks: [{quality,size,hosts:[{host,url}]}] }` — omit keys that don't exist |
| `createdAt` / `updatedAt` | timestamps |                                                                                                                                                           |

Generate a drizzle migration; include `videos` in the test truncation helper (`truncateAll`).

## 6. Module Layout (Deep Modules rules)

Backend module `videos`:

```
src/modules/videos/
  index.ts          # ONLY: export saveVideoFromHtml({ sourceUrl, html }) + types. NEVER export http.ts
  internal/
    parse.ts        # pure: parseVideoPage(html) -> { title, videoType, videoUrl, metadata }
    repository.ts   # drizzle upsert/find by sourceUrl
  http.ts           # Elysia plugin: POST /videos, body { sourceUrl: string(url), html: string }
```

- Register the plugin in the `createApp` composition root (`src/app.ts`), wired with `{ db }`.
- Route handlers must use the repo's `successResponse` / `errorResponse` helpers.
- Invalid HTML input → 400; success returns the saved record.

## 7. Tests (TDD-first)

- `test/unit/videos/parse.test.ts` — fixtures: `docs/handoff-fixtures/sample-a.html` and `docs/handoff-fixtures/sample-b.html` (copy them into the target repo's test fixtures).
  - **Sample A (odvidhide):** extracts title from `h1.posttl`; extracts iframe `src` as `videoUrl`; `videoType` is null (no info block); episode list metadata parsed with `value="0"` placeholder excluded; `downloadLinks` empty.
  - **Sample B (desustream):** extracts title + desustream embed `videoUrl`; `videoType === "TV"` from `<b>Tipe</b>`; genres = `["Action", "Fantasy"]`; duration = `"23 min. per ep."`; `posterUrl` from `.cukder img`; `downloadLinks` parsed with quality/size/host lists; never extracts anything from `.mirrorstream`.
  - Throws a validation error when `#venkonten` / iframe / title missing.
- `test/integration/videos/scrape.test.ts`:
  - `POST /videos` saves a row (test both fixtures)
  - re-submitting the same `sourceUrl` updates (row count stays 1)
  - invalid body / unparseable HTML → 400

## 8. Out of Scope (MVP)

- Automated crawling / headless browsers / resolving embed → direct file
- Resolving `.mirrorstream` base64 `data-content` into mirror URLs (needs browser/JS)
- Resolving `link.desustream.com/?id=...` download redirectors
- Scheduled jobs/cron
- Type inference from title
- Any frontend UI

## 9. Open Items (decide during implementation)

- Exact response shape / status codes beyond 200 & 400 — follow repo conventions.
- Whether to persist the raw pasted HTML for debugging (e.g. `metadata.rawHtml`); default: don't.
