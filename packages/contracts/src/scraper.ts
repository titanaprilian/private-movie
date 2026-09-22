/**
 * Scraper provider contracts shared by the frontend "Add from URL" dropdown
 * and the backend Elysia `source` validators.
 *
 * Add new providers here — backend validation derives from this array.
 */

export const SCRAPER_PROVIDERS = ["otakudesu", "dramula"] as const;

export type ScraperProvider = (typeof SCRAPER_PROVIDERS)[number];
