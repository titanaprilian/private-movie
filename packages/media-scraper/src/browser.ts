import { chromium } from "playwright-extra";
import StealthPlugin from "puppeteer-extra-plugin-stealth";
import type { BrowserFn } from "./types";

let stealthInitialized = false;

export function getStealthChromium(): typeof chromium {
  if (!stealthInitialized) {
    chromium.use(StealthPlugin());
    stealthInitialized = true;
  }
  return chromium;
}

export interface CreateStealthBrowserFnOptions {
  headless?: boolean;
  timeout?: number;
  userAgent?: string;
}

export function createStealthBrowserFn(
  options: CreateStealthBrowserFnOptions = {}
): BrowserFn {
  const {
    headless = true,
    timeout = 10000,
    userAgent = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
  } = options;

  return async (url: string): Promise<string> => {
    const stealthChromium = getStealthChromium();
    const browser = await stealthChromium.launch({
      headless,
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-blink-features=AutomationControlled",
      ],
    });

    try {
      const context = await browser.newContext({
        userAgent,
        locale: "en-US",
      });

      await context.addInitScript(`
        Object.defineProperty(window, "outerWidth", {
          get: () => window.innerWidth,
        });
        Object.defineProperty(window, "outerHeight", {
          get: () => window.innerHeight,
        });
        Object.defineProperty(navigator, "webdriver", {
          get: () => false,
        });
        const noop = () => {};
        console.clear = noop;
        console.table = noop;
        console.dir = noop;
      `);

      const page = await context.newPage();
      await page.goto(url, { waitUntil: "domcontentloaded", timeout });

      try {
        await page.waitForSelector(
          "iframe[src*='videobello'], iframe[src*='embed'], iframe[src]",
          { timeout }
        );
      } catch {
        // Fallback delay if selector wait times out
      }

      const html = await page.content();
      return html;
    } finally {
      await browser.close();
    }
  };
}
