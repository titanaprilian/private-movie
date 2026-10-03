import { describe, expect, it, vi } from "vitest";
import { createStealthBrowser, getStealthChromium } from "../../src/browser";

describe("browser stealth module", () => {
  it("initializes stealth chromium instance", () => {
    const chromiumInstance = getStealthChromium();
    expect(chromiumInstance).toBeDefined();
    expect(typeof chromiumInstance.launch).toBe("function");
  });

  it("calling the browser factory returns an object with browser function and async close", async () => {
    const stealthChromium = getStealthChromium();
    const mockBrowser: any = {
      newContext: vi.fn(),
      close: vi.fn().mockResolvedValue(undefined),
    };
    const launchSpy = vi
      .spyOn(stealthChromium, "launch")
      .mockResolvedValue(mockBrowser as any);

    try {
      const handle = await createStealthBrowser();
      expect(typeof handle.browserFn).toBe("function");
      expect(typeof handle.close).toBe("function");
      const result = handle.close();
      expect(result instanceof Promise).toBe(true);
      await result;
      expect(mockBrowser.close).toHaveBeenCalledOnce();
      expect(launchSpy).toHaveBeenCalledOnce();
    } finally {
      vi.restoreAllMocks();
    }
  });

  it("does not export a freestanding browser close function", async () => {
    const mod = await import("../../src/browser");
    expect("closeBrowser" in mod).toBe(false);
    expect("createStealthBrowserFn" in mod).toBe(false);
    expect("initBrowser" in mod).toBe(false);
  });

  describe("stealth browser handle lifecycle", () => {
    it("close terminates the browser instance and repeated closes resolve cleanly", async () => {
      const stealthChromium = getStealthChromium();
      const mockBrowser: any = {
        newContext: vi.fn(),
        close: vi.fn().mockResolvedValue(undefined),
      };
      const launchSpy = vi
        .spyOn(stealthChromium, "launch")
        .mockResolvedValue(mockBrowser as any);

      try {
        const handle = await createStealthBrowser({ headless: true });
        expect(launchSpy).toHaveBeenCalledOnce();

        await handle.close();
        expect(mockBrowser.close).toHaveBeenCalledOnce();

        // Idempotent: subsequent closes resolve cleanly without side effects
        await handle.close();
        await handle.close();
        expect(mockBrowser.close).toHaveBeenCalledOnce();
      } finally {
        vi.restoreAllMocks();
      }
    });

    it("browserFn scrapes via owned instance and manages context lifecycle per call", async () => {
      const stealthChromium = getStealthChromium();
      const mockPage: any = {
        goto: vi.fn().mockResolvedValue(undefined),
        waitForSelector: vi.fn().mockResolvedValue(undefined),
        content: vi.fn().mockResolvedValue("<html><body>test</body></html>"),
      };
      const mockContext: any = {
        addInitScript: vi.fn().mockResolvedValue(undefined),
        newPage: vi.fn().mockResolvedValue(mockPage),
        close: vi.fn().mockResolvedValue(undefined),
      };
      const mockBrowser: any = {
        newContext: vi.fn().mockResolvedValue(mockContext),
        close: vi.fn().mockResolvedValue(undefined),
      };
      vi.spyOn(stealthChromium, "launch").mockResolvedValue(mockBrowser as any);

      try {
        const handle = await createStealthBrowser();

        const html = await handle.browserFn("https://example.com");

        expect(html).toBe("<html><body>test</body></html>");
        expect(mockBrowser.newContext).toHaveBeenCalledOnce();
        expect(mockContext.newPage).toHaveBeenCalledOnce();
        expect(mockPage.goto).toHaveBeenCalledWith("https://example.com", {
          waitUntil: "domcontentloaded",
          timeout: 10000,
        });
        expect(mockContext.close).toHaveBeenCalledOnce();
        // Browser itself should NOT be closed after a single browserFn call
        expect(mockBrowser.close).not.toHaveBeenCalled();

        await handle.close();
        expect(mockBrowser.close).toHaveBeenCalledOnce();
      } finally {
        vi.restoreAllMocks();
      }
    });
  });
});
