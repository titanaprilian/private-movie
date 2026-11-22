import { test, expect } from "@playwright/test";

test.describe("Mobile Direct Video Player Layout Investigation", () => {
  test("measures player dimensions in mobile portrait vs mobile landscape", async ({
    page,
  }) => {
    // Dismiss adblock warning
    await page.addInitScript(() => {
      window.localStorage.setItem("adblock_warning_dismissed", "true");
    });

    // Intercept series API to return a direct source
    await page.route("**/api/series/*", async (route) => {
      const response = await route.fetch();
      const json = await response.json();
      const payload = json.data ?? json;
      const updateEp = (ep: any) => {
        ep.videoSources = [
          {
            id: "source-direct-test",
            episodeId: ep.id,
            type: "direct",
            url: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4",
            label: "Direct 1080p",
            quality: "1080p",
          },
        ];
        ep.sources = ep.videoSources;
      };
      if (payload && payload.seasons) {
        for (const season of payload.seasons) {
          for (const ep of season.episodes || []) {
            updateEp(ep);
          }
        }
      }
      if (payload && payload.episodes) {
        for (const ep of payload.episodes) {
          updateEp(ep);
        }
      }
      await route.fulfill({ json });
    });

    // 1. Authenticate
    await page.goto("/admin/login");
    await expect(page.getByTestId("admin-login-card")).toBeVisible();
    await page.locator("#admin-email").fill("test@example.com");
    await page.locator("#admin-password").fill("password123");
    await page.getByRole("button", { name: /enter console/i }).click();
    await page.waitForURL((url) => !url.pathname.includes("login"), {
      timeout: 15000,
    });

    // 2. Set viewport to mobile portrait (iPhone 14: 390x844)
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/watch/series-e2e-1?ep=episode-e2e-1");

    // Wait for custom video player to mount
    const playerContainer = page.getByTestId("watch-player-container");
    await expect(playerContainer).toBeVisible({ timeout: 15000 });
    const videoElement = page.getByTestId("custom-video-element");
    await expect(videoElement).toBeVisible({ timeout: 15000 });

    const portraitBox = await playerContainer.boundingBox();
    console.log("=== PORTRAIT MEASUREMENTS (390x844) ===");
    console.log("Container Bounding Box:", portraitBox);

    await page.screenshot({
      path: "artifacts/verify/playback/direct-player-mobile-portrait.png",
      fullPage: false,
    });

    // 3. Set viewport to mobile landscape (horizontal layout: 844x390)
    await page.setViewportSize({ width: 844, height: 390 });
    // Allow layout reflow
    await page.waitForTimeout(500);

    const landscapeBox = await playerContainer.boundingBox();
    const videoBox = await videoElement.boundingBox();
    console.log("=== LANDSCAPE MEASUREMENTS (844x390) ===");
    console.log("Container Bounding Box in Landscape:", landscapeBox);
    console.log("Video Element Bounding Box in Landscape:", videoBox);

    expect(landscapeBox).not.toBeNull();
    expect(landscapeBox!.width).toBeGreaterThan(550);
    expect(landscapeBox!.height).toBeGreaterThan(300);

    await page.screenshot({
      path: "artifacts/verify/playback/direct-player-mobile-landscape.png",
      fullPage: false,
    });

    // Also take a screenshot with smaller landscape phone (e.g. 667x375 iPhone SE or 800x360 Galaxy)
    await page.setViewportSize({ width: 667, height: 375 });
    await page.waitForTimeout(500);
    const smallLandscapeBox = await playerContainer.boundingBox();
    console.log("=== SMALL LANDSCAPE MEASUREMENTS (667x375) ===");
    console.log(
      "Container Bounding Box in Small Landscape:",
      smallLandscapeBox,
    );

    await page.screenshot({
      path: "artifacts/verify/playback/direct-player-mobile-landscape-small.png",
      fullPage: false,
    });
  });
});
