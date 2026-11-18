import { defineConfig, devices } from "@playwright/test";

const e2eDatabaseUrl =
  process.env.E2E_DATABASE_URL ||
  (process.env.DATABASE_URL?.includes("_test")
    ? process.env.DATABASE_URL
    : "postgres://postgres:root_password@localhost:5432/private_movie_test");

export default defineConfig({
  testDir: "./test/e2e",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: "http://localhost:5173",
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: [
    {
      command: "bun run --filter=@repo/backend start",
      url: "http://localhost:3000/api/health",
      reuseExistingServer: !process.env.CI,
      stdout: "pipe",
      stderr: "pipe",
      timeout: 120 * 1000,
      env: {
        PORT: "3000",
        DATABASE_URL: e2eDatabaseUrl,
        JWT_SECRET:
          process.env.JWT_SECRET ||
          "514fbdf9f074b52110b9f1d48a73ea7edf8a8f9abbc0766c7319fe1a4650fadc",
        CORS_ORIGIN: "http://localhost:5173,http://localhost:3000",
      },
    },
    {
      command: "bun run --filter=@repo/web preview",
      url: "http://localhost:5173",
      reuseExistingServer: !process.env.CI,
      stdout: "pipe",
      stderr: "pipe",
      timeout: 120 * 1000,
      env: {
        VITE_API_URL: "http://localhost:3000",
      },
    },
  ],
});
