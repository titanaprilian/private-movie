import { describe, expect, it } from "vitest";
import { createStealthBrowserFn, getStealthChromium } from "../../src/browser";

describe("browser stealth module", () => {
  it("initializes stealth chromium instance", () => {
    const chromiumInstance = getStealthChromium();
    expect(chromiumInstance).toBeDefined();
    expect(typeof chromiumInstance.launch).toBe("function");
  });

  it("creates a stealth BrowserFn", () => {
    const browserFn = createStealthBrowserFn();
    expect(typeof browserFn).toBe("function");
  });
});
