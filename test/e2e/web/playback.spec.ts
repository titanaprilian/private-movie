import { test, expect } from "@playwright/test";

test.describe("Web Playback Happy Path", () => {
  test("login -> series detail -> playback page loads and player mounts", async ({
    page,
  }) => {
    // Pre-dismiss adblock advisory dialog to avoid asynchronous overlay race conditions
    await page.addInitScript(() => {
      window.localStorage.setItem("adblock_warning_dismissed", "true");
    });

    // 1. Visit admin login page
    await page.goto("/admin/login");
    await expect(page.getByTestId("admin-login-card")).toBeVisible();

    // 2. Fill login credentials and submit
    await page.locator("#admin-email").fill("test@example.com");
    await page.locator("#admin-password").fill("password123");
    await page.getByRole("button", { name: /enter console/i }).click();

    // 3. Verify successful authentication redirect
    await page.waitForURL((url) => !url.pathname.includes("login"), {
      timeout: 15000,
    });

    // 4. Navigate to home catalog
    await page.goto("/");
    await expect(page.getByTestId("hero-slider")).toBeVisible({
      timeout: 15000,
    });

    // 5. Click hero play button to navigate to series detail
    const homePlayButton = page.getByTestId("hero-play");
    await expect(homePlayButton).toBeVisible();
    await homePlayButton.click();

    // 6. Verify navigation to the series watch/detail page
    await page.waitForURL((url) => url.pathname.includes("/watch/"), {
      timeout: 15000,
    });

    // Ensure any modal overlay is dismissed if presented
    const adblockDismiss = page.getByRole("button", {
      name: /continue anyway/i,
    });
    if (await adblockDismiss.isVisible({ timeout: 1000 }).catch(() => false)) {
      await adblockDismiss.click();
    }

    // 7. Click play on the series detail page to launch video playback
    const detailPlayButton = page.getByTestId("hero-play");
    await expect(detailPlayButton).toBeVisible({ timeout: 15000 });
    await detailPlayButton.click();

    // 8. Verify watch player container and player frame mount
    const playerContainer = page.getByTestId("watch-player-container");
    await expect(playerContainer).toBeVisible({ timeout: 15000 });

    const playerFrame = page.getByTestId("watch-player");
    await expect(playerFrame).toBeVisible({ timeout: 15000 });

    // 9. Capture verification proof
    await page.screenshot({
      path: "artifacts/verify/playback/player-mounted.png",
      fullPage: true,
    });
  });
});
