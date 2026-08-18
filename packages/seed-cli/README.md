# `@repo/seed-cli`

Standalone CLI script for seeding Otakudesu anime series, episodes, and video sources into the local PostgreSQL database.

## Environment Variables

| Variable | Default | Description |
| --- | --- | --- |
| `DATABASE_URL` | *(required if db not passed)* | PostgreSQL connection string (e.g., `postgresql://postgres:postgres@localhost:5432/privatemovie`) |
| `SEED_FILE_PATH` | `packages/media-scraper/test/fixtures/full/sample-full-list.json` | Path to JSON file containing anime series list |
| `SEED_BATCH_SIZE` | `20` | Number of series to process in each batch before pausing |
| `SEED_BATCH_DELAY_MS` | `2000` | Delay in milliseconds between batches to avoid rate limits |
| `SEED_MAX_ITEMS` | *(none / all)* | Limit total series to process (useful for subset testing) |

---

## 1. Running a Test Run on a Small Subset

To test the seeding process on a small subset (e.g., first 5 series):

```bash
SEED_MAX_ITEMS=5 bun run db:seed
```

Or directly via `seed-cli`:

```bash
SEED_MAX_ITEMS=5 bun --cwd packages/seed-cli src/index.ts
```

### Verification Checklist
- Check console output for summary table (`SEEDING SUMMARY`).
- Query local database to confirm entries are present:
  - `series`: sourceUrl, title, posterUrl, description
  - `episodes`: seriesId, sourceUrl, title, videoType
  - `video_sources`: episodeId, url, type, label, quality

---

## 2. Running the Full Seeding Process

Ensure your local PostgreSQL database is running and up-to-date (`bun run db:push` or `bun run db:migrate`), then run:

```bash
bun run db:seed
```

Or with custom batch parameters:

```bash
SEED_BATCH_SIZE=20 SEED_BATCH_DELAY_MS=2000 bun run db:seed
```

---

## 3. Post-Seeding Cleanup Instructions

Once database seeding is completed successfully and verified, you can safely remove the `seed-cli` package from the repository:

1. Delete the package directory:
   ```bash
   rm -rf packages/seed-cli
   ```
2. Remove any workspace references if needed and re-install node_modules:
   ```bash
   bun install
   ```
