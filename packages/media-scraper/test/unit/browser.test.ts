import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  closeBrowser,
  createStealthBrowserFn,
  getStealthChromium,
  initBrowser,
} from "../../src/browser";

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

  describe("global browser lifecycle", () => {
    let mockBrowser: any;
    let mockContext: any;
    let mockPage: any;
    let launchSpy: any;

    beforeEach(() => {
      mockPage = {
        goto: vi.fn().mockResolvedValue(undefined),
        waitForSelector: vi.fn().mockResolvedValue(undefined),
        content: vi.fn().mockResolvedValue("<html><body>test</body></html>"),
      };
      mockContext = {
        addInitScript: vi.fn().mockResolvedValue(undefined),
        newPage: vi.fn().mockResolvedValue(mockPage),
        close: vi.fn().mockResolvedValue(undefined),
      };
      mockBrowser = {
        newContext: vi.fn().mockResolvedValue(mockContext),
        close: vi.fn().mockResolvedValue(undefined),
      };

      const stealthChromium = getStealthChromium();
      launchSpy = vi
        .spyOn(stealthChromium, "launch")
        .mockResolvedValue(mockBrowser as any);
    });

    afterEach(async () => {
      vi.restoreAllMocks();
      await closeBrowser();
    });

    it("initBrowser boots global Chromium instance and returns it", async () => {
      const browser = await initBrowser({ headless: true });
      expect(launchSpy).toHaveBeenCalledOnce();
      expect(browser).toBe(mockBrowser);
    });

    it("initBrowser reuses existing global Chromium instance if already running", async () => {
      const b1 = await initBrowser();
      const b2 = await initBrowser();
      expect(launchSpy).toHaveBeenCalledOnce();
      expect(b1).toBe(b2);
    });

    it("closeBrowser terminates global Chromium instance and resets singleton", async () => {
      await initBrowser();
      await closeBrowser();
      expect(mockBrowser.close).toHaveBeenCalledOnce();

      // Launch again after close should create a new instance
      await initBrowser();
      expect(launchSpy).toHaveBeenCalledTimes(2);
    });

    it("createStealthBrowserFn reuses global instance and manages context lifecycle per call", async () => {
      await initBrowser();
      const browserFn = createStealthBrowserFn();

      const html = await browserFn("https://example.com");

      expect(html).toBe("<html><body>test</body></html>");
      expect(mockBrowser.newContext).toHaveBeenCalledOnce();
      expect(mockContext.newPage).toHaveBeenCalledOnce();
      expect(mockPage.goto).toHaveBeenCalledWith("https://example.com", {
        waitUntil: "domcontentloaded",
        timeout: 10000,
      });
      expect(mockContext.close).toHaveBeenCalledOnce();
      // Browser itself should NOT be closed after single browserFn call
      expect(mockBrowser.close).not.toHaveBeenCalled();
    });

    it("createStealthBrowserFn auto-initializes global browser if initBrowser was not called previously", async () => {
      const browserFn = createStealthBrowserFn();

      const html = await browserFn("https://example.com");

      expect(launchSpy).toHaveBeenCalledOnce();
      expect(html).toBe("<html><body>test</body></html>");
      expect(mockContext.close).toHaveBeenCalledOnce();
      expect(mockBrowser.close).not.toHaveBeenCalled();
    });
  });
});

