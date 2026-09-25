import { describe, expect, it } from "vitest";
import {
  AD_SUPPRESSION_SHIM,
  VIDHIDE_ANTI_CLICKJACK_CSS,
  buildServerRenderedEmbedDocument,
  isBlockedAdAsset,
  isBlockedAppSchemeUrl,
  sanitizeHtmlContent,
  stripKnownAdScripts,
} from "../../../src/modules/media";

describe("ad suppression", () => {
  it("strips /cdn/runtime.js popunder injector scripts", () => {
    const html = `<html><head><script src="/cdn/runtime.js"></script><script src="https://videobello.net/cdn/runtime.js?v=1"></script><script src="/player/app.js"></script></head></html>`;
    const out = stripKnownAdScripts(html);
    expect(out).not.toContain("runtime.js");
    expect(out).toContain("/player/app.js");
  });

  it("strips known ad network scripts", () => {
    const html = `<html><head><script src="https://effectivecpmnetwork.com/ads.js"></script><script>var x = 1;</script></head></html>`;
    expect(stripKnownAdScripts(html)).not.toContain("effectivecpmnetwork");
  });

  it("injects anti-clickjack CSS into server-rendered embed document", () => {
    const out = buildServerRenderedEmbedDocument(
      `<html><head><title>t</title></head><body><div>hi</div></body></html>`
    );
    expect(out).toContain("pm-anti-clickjack");
    expect(out).toContain("2147483647");
    expect(out).toContain("position: fixed");
  });

  it("strips runtime ad scripts from server-rendered embed document", () => {
    const out = buildServerRenderedEmbedDocument(
      `<html><head><script src="/cdn/runtime.js"></script><script src="/_app/main.js"></script></head><body></body></html>`
    );
    expect(out).not.toContain("/cdn/runtime.js");
    expect(out).toContain("_app/main.js");
  });

  it("sanitizeHtmlContent strips runtime scripts and injects clickjack CSS", () => {
    const out = sanitizeHtmlContent(
      `<html><head><script src="/cdn/runtime.js"></script></head><body><p>hi</p></body></html>`,
      "example.com",
      "https://example.com/v/1"
    );
    expect(out).not.toContain("runtime.js");
    expect(out).toContain("pm-anti-clickjack");
  });

  it("identifies blocked ad assets for proxy no-op", () => {
    expect(isBlockedAdAsset("https://videobello.net/cdn/runtime.js")).toBe(true);
    expect(isBlockedAdAsset("/cdn/runtime.js?v=2")).toBe(true);
    expect(isBlockedAdAsset("https://daly2024.com/tracker.js")).toBe(true);
    expect(isBlockedAdAsset("https://videobello.net/player/app.js")).toBe(false);
    expect(isBlockedAdAsset("https://cdn.example.com/hls/master.m3u8")).toBe(false);
  });

  it("identifies blocked external app schemes", () => {
    expect(isBlockedAppSchemeUrl("shopee://open")).toBe(true);
    expect(isBlockedAppSchemeUrl("intent://open#Intent")).toBe(true);
    expect(isBlockedAppSchemeUrl("market://details?id=x")).toBe(true);
    expect(isBlockedAppSchemeUrl("https://example.com")).toBe(false);
  });

  it("hardened shim cancels external schemes, synthetic clicks, and top nav", () => {
    expect(AD_SUPPRESSION_SHIM).toContain("shopee:");
    expect(AD_SUPPRESSION_SHIM).toContain("intent:");
    expect(AD_SUPPRESSION_SHIM).toContain("market:");
    expect(AD_SUPPRESSION_SHIM).toContain("isTrusted");
    expect(AD_SUPPRESSION_SHIM).toContain("window.top");
  });

  it("anti-clickjack CSS hides transparent overlays and hijack divs", () => {
    expect(VIDHIDE_ANTI_CLICKJACK_CSS).toContain("opacity: 0");
    expect(VIDHIDE_ANTI_CLICKJACK_CSS).toContain("position: fixed");
    expect(VIDHIDE_ANTI_CLICKJACK_CSS).toContain('a[href^="shopee:"]');
  });
});
