import { describe, it, expect } from "vitest";
import {
  RELAY_CDN_REFERER,
  RELAY_EMBED_REFERER,
  resolveRelayReferer,
} from "../../../src/modules/media";

describe("resolveRelayReferer", () => {
  it("returns dramula referer for videobello.net", () => {
    expect(resolveRelayReferer("videobello.net")).toBe(RELAY_EMBED_REFERER);
    expect(resolveRelayReferer("www.videobello.net")).toBe(RELAY_EMBED_REFERER);
  });

  it("returns videobello player referer for CDN domains", () => {
    const cdnHosts = [
      "cloudremux.online",
      "cdn.cloudremux.online",
      "skylayer64.online",
      "cloudflow.example.com",
      "streamflow.example.com",
      "medialayer.example.com",
      "desustream.net",
      "onenesuhd.com",
      "odstream.net",
    ];
    for (const host of cdnHosts) {
      expect(resolveRelayReferer(host)).toBe(RELAY_CDN_REFERER);
    }
  });

  it("preserves legacy dramula referer for unrelated domains", () => {
    expect(resolveRelayReferer("httpbin.org")).toBe(RELAY_EMBED_REFERER);
    expect(resolveRelayReferer("vidhidepro.com")).toBe(RELAY_EMBED_REFERER);
  });
});
