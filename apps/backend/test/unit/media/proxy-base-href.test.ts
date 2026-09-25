import { describe, expect, it } from "vitest";
import {
  buildProxyBaseHref,
  sanitizeHtmlContent,
} from "../../../src/modules/media";

describe("buildProxyBaseHref", () => {
  it("returns domain root when no target path is given", () => {
    expect(buildProxyBaseHref("example.com")).toBe(
      "/api/media/proxy/example.com/"
    );
  });

  it("returns domain root for root-level file paths", () => {
    expect(buildProxyBaseHref("filedon.co", "/embed-xyz.html")).toBe(
      "/api/media/proxy/filedon.co/"
    );
  });

  it("preserves a single directory level", () => {
    expect(buildProxyBaseHref("vidhidepro.com", "/v/abcd123")).toBe(
      "/api/media/proxy/vidhidepro.com/v/"
    );
  });

  it("preserves deeply nested directory paths", () => {
    expect(
      buildProxyBaseHref("example.com", "/a/b/c/player.html")
    ).toBe("/api/media/proxy/example.com/a/b/c/");
  });

  it("keeps trailing-slash directory paths as-is", () => {
    expect(buildProxyBaseHref("example.com", "/a/b/c/")).toBe(
      "/api/media/proxy/example.com/a/b/c/"
    );
  });

  it("accepts full upstream URLs and strips query/hash", () => {
    expect(
      buildProxyBaseHref("example.com", "https://example.com/a/b/page.html?x=1#y")
    ).toBe("/api/media/proxy/example.com/a/b/");
  });
});

describe("sanitizeHtmlContent path-aware base", () => {
  const doc = (body: string) =>
    `<!DOCTYPE html><html><head><title>t</title></head><body>${body}</body></html>`;

  it("injects root base for root-level upstream paths", () => {
    const out = sanitizeHtmlContent(
      doc(`<script src="playerjs.js"></script>`),
      "filedon.co",
      "https://filedon.co/embed-xyz.html"
    );
    expect(out).toContain('<base href="/api/media/proxy/filedon.co/">');
  });

  it("injects directory-preserving base for nested upstream paths", () => {
    const out = sanitizeHtmlContent(
      doc(`<script src="playerjs.js"></script>`),
      "example.com",
      "https://example.com/a/b/embed.html"
    );
    expect(out).toContain('<base href="/api/media/proxy/example.com/a/b/">');
    // Relative script resolves through the proxy directory hierarchy.
    const resolved = new URL(
      "playerjs.js",
      "http://localhost/api/media/proxy/example.com/a/b/"
    ).href;
    expect(resolved).toBe(
      "http://localhost/api/media/proxy/example.com/a/b/playerjs.js"
    );
  });

  it("defaults to domain root when no target is provided (backwards compatible)", () => {
    const out = sanitizeHtmlContent(doc(`<p>hi</p>`), "example.com");
    expect(out).toContain('<base href="/api/media/proxy/example.com/">');
  });
});
