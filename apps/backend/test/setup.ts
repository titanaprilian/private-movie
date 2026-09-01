import { afterAll, beforeAll, beforeEach } from "vitest";
import { closeBrowser, initBrowser } from "@repo/media-scraper";
import { truncateAll } from "./utils/db";

beforeAll(async () => {
  await initBrowser();
});

afterAll(async () => {
  await closeBrowser();
});

/**
 * Every integration test starts with a clean database. Truncation runs before
 * each individual test so that tests within the same file cannot interfere with
 * one another.
 */
beforeEach(async () => {
  await truncateAll();
});

/**
 * Vitest runs under Node, where `Bun` is undefined. The auth service relies on
 * `Bun.password` for hashing/verification, so provide a minimal test polyfill.
 *
 * Defining `globalThis.Bun` also flips Elysia's `isBun` detection (`typeof Bun
 * !== "undefined"`), which then reads `Bun.env` at construction time. The
 * polyfill therefore also exposes the other Bun globals Elysia touches so the
 * Elysia instance can be constructed and serve requests under Node.
 */
if (typeof (globalThis as Record<string, unknown>).Bun === "undefined") {
  (globalThis as Record<string, unknown>).Bun = {
    env: process.env,
    gc: () => {},
    semver: { satisfies: () => false },
    version: "test",
    file: (path: string) => new File([""], path),
    password: {
      hash: async (plaintext: string) => `test$${plaintext}`,
      verify: async (plaintext: string, hash: string) => {
        const prefix = "test$";
        if (!hash.startsWith(prefix)) {
          return false;
        }
        return hash.slice(prefix.length) === plaintext;
      },
    },
  };
}
