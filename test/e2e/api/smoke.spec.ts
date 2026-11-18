import { test, expect } from "@playwright/test";

test.describe("Backend API Smoke Suite", () => {
  const backendBaseUrl = "http://localhost:3000";

  test("health check returns status ok", async ({ request }) => {
    const response = await request.get(`${backendBaseUrl}/api/health`);
    expect(response.ok()).toBeTruthy();
    expect(response.status()).toBe(200);

    const body = await response.json();
    expect(body.status).toBe("ok");
  });

  test("auth -> list series -> list episodes happy path", async ({
    request,
  }) => {
    // 1. Authenticate with seeded user credentials
    const loginRes = await request.post(`${backendBaseUrl}/api/auth/login`, {
      data: {
        email: "test@example.com",
        password: "password123",
      },
    });

    expect(loginRes.ok()).toBeTruthy();
    expect(loginRes.status()).toBe(200);

    const loginData = await loginRes.json();
    const accessToken = loginData?.data?.tokens?.accessToken;
    expect(accessToken).toBeDefined();

    // 2. Fetch series catalog
    const seriesRes = await request.get(`${backendBaseUrl}/api/series`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    expect(seriesRes.ok()).toBeTruthy();
    expect(seriesRes.status()).toBe(200);

    const seriesData = await seriesRes.json();
    const seriesList =
      seriesData?.data?.series ?? seriesData?.series ?? seriesData;
    expect(Array.isArray(seriesList)).toBeTruthy();
    const seededSeries = seriesList.find(
      (s: { id: string }) => s.id === "series-e2e-1",
    );
    expect(seededSeries).toBeDefined();
    expect(seededSeries.title).toBe(
      "Akashic Records of Bastard Magic Instructor",
    );

    // 3. Fetch episodes for the seeded season
    const episodesRes = await request.get(
      `${backendBaseUrl}/api/episodes?seasonId=season-e2e-1`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      },
    );

    expect(episodesRes.ok()).toBeTruthy();
    expect(episodesRes.status()).toBe(200);

    const episodesData = await episodesRes.json();
    const episodes = episodesData?.data?.episodes ?? episodesData?.episodes;
    expect(Array.isArray(episodes)).toBeTruthy();
    expect(episodes.length).toBeGreaterThanOrEqual(1);
    expect(episodes[0].id).toBe("episode-e2e-1");
  });
});
