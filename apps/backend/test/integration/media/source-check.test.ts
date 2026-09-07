import { describe, expect, it, beforeAll, beforeEach, afterEach, vi } from "vitest";
import { buildApp, request, type App } from "../../utils/app";
import { authHeaders, registerUser } from "../../utils/auth";
import { truncateAll } from "../../utils/db";

describe("POST /api/media/sources/check", () => {
  let app: App;
  let accessToken: string;

  beforeAll(async () => {
    app = await buildApp();
  });

  beforeEach(async () => {
    await truncateAll();
    const user = await registerUser(app);
    accessToken = user.accessToken;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns 401 when authorization header is missing or invalid", async () => {
    const unauthResponse = await request(app, {
      method: "POST",
      path: "/api/media/sources/check",
      body: {
        url: "https://example.com/video.mp4",
        type: "direct",
      },
    });

    expect(unauthResponse.status).toBe(401);
    expect(unauthResponse.body).toEqual({
      error: {
        code: "UNAUTHORIZED",
        message: expect.any(String),
      },
    });

    const invalidAuthResponse = await request(app, {
      method: "POST",
      path: "/api/media/sources/check",
      headers: {
        Authorization: "Bearer invalid-token",
      },
      body: {
        url: "https://example.com/video.mp4",
        type: "direct",
      },
    });

    expect(invalidAuthResponse.status).toBe(401);
    expect(invalidAuthResponse.body).toEqual({
      error: {
        code: "UNAUTHORIZED",
        message: expect.any(String),
      },
    });
  });

  it("returns 400 when payload validation fails", async () => {
    const response = await request(app, {
      method: "POST",
      path: "/api/media/sources/check",
      headers: authHeaders(accessToken),
      body: {
        // missing url
        type: "direct",
      },
    });

    expect(response.status).toBe(400);
  });

  it("returns status: 'working' for 200 OK HEAD responses", async () => {
    let capturedUrl = "";
    let capturedMethod = "";
    let capturedHeaders: Record<string, string> = {};

    vi.spyOn(global, "fetch").mockImplementation(async (input, init) => {
      capturedUrl = input.toString();
      capturedMethod = init?.method || "GET";
      capturedHeaders = (init?.headers as Record<string, string>) || {};
      return new Response(null, {
        status: 200,
        statusText: "OK",
      });
    });

    const response = await request(app, {
      method: "POST",
      path: "/api/media/sources/check",
      headers: authHeaders(accessToken),
      body: {
        url: "https://example.com/video.mp4",
        type: "direct",
        referer: "https://custom-referer.com",
      },
    });

    expect(response.status).toBe(200);
    expect(capturedUrl).toBe("https://example.com/video.mp4");
    expect(capturedMethod).toBe("HEAD");
    expect(capturedHeaders["Referer"]).toBe("https://custom-referer.com");
    expect(response.body).toMatchObject({
      data: {
        status: "working",
        statusCode: 200,
        latencyMs: expect.any(Number),
        error: null,
      },
    });
  });

  it("falls back to ranged GET bytes=0-0 when HEAD returns 405 Method Not Allowed", async () => {
    let callCount = 0;
    const capturedMethods: string[] = [];
    const capturedRanges: string[] = [];

    vi.spyOn(global, "fetch").mockImplementation(async (_input, init) => {
      callCount++;
      capturedMethods.push(init?.method || "GET");
      const headers = (init?.headers as Record<string, string>) || {};
      if (headers["Range"]) {
        capturedRanges.push(headers["Range"]);
      }
      if (init?.method === "HEAD") {
        return new Response(null, { status: 405, statusText: "Method Not Allowed" });
      }
      return new Response("a", { status: 206, statusText: "Partial Content" });
    });

    const response = await request(app, {
      method: "POST",
      path: "/api/media/sources/check",
      headers: authHeaders(accessToken),
      body: {
        url: "https://example.com/video-nohead.mp4",
        type: "direct",
      },
    });

    expect(response.status).toBe(200);
    expect(callCount).toBe(2);
    expect(capturedMethods).toEqual(["HEAD", "GET"]);
    expect(capturedRanges).toContain("bytes=0-0");
    expect(response.body).toMatchObject({
      data: {
        status: "working",
        statusCode: 206,
        latencyMs: expect.any(Number),
        error: null,
      },
    });
  });

  it("returns status: 'broken' when target returns 404 Not Found", async () => {
    vi.spyOn(global, "fetch").mockImplementation(async () => {
      return new Response(null, {
        status: 404,
        statusText: "Not Found",
      });
    });

    const response = await request(app, {
      method: "POST",
      path: "/api/media/sources/check",
      headers: authHeaders(accessToken),
      body: {
        url: "https://example.com/notfound.mp4",
        type: "direct",
      },
    });

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      data: {
        status: "broken",
        statusCode: 404,
        latencyMs: expect.any(Number),
        error: expect.stringContaining("404"),
      },
    });
  });

  it("returns status: 'broken' when fetch throws network error or timeout", async () => {
    vi.spyOn(global, "fetch").mockImplementation(async () => {
      throw new Error("getaddrinfo ENOTFOUND broken-domain.xyz");
    });

    const response = await request(app, {
      method: "POST",
      path: "/api/media/sources/check",
      headers: authHeaders(accessToken),
      body: {
        url: "https://broken-domain.xyz/video.mp4",
        type: "direct",
      },
    });

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      data: {
        status: "broken",
        statusCode: null,
        latencyMs: expect.any(Number),
        error: expect.stringContaining("ENOTFOUND"),
      },
    });
  });
});
