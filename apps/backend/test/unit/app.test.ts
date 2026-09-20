import { describe, it, expect, vi } from "vitest";
import { createApp } from "@/app";
import type { DbClient } from "@repo/db";
import type { AuthenticationService } from "@repo/contracts";

describe("composition root global error handler", () => {
  it("passes through 404 for unknown routes (NOT_FOUND)", async () => {
    const app = createApp({
      db: {} as unknown as DbClient,
      auth: {} as unknown as AuthenticationService,
    });

    const response = await app.handle(
      new Request("http://localhost/nonexistent")
    );

    expect(response.status).toBe(404);
    expect(await response.text()).toBe("NOT_FOUND");
  });

  it("returns 500 envelope and logs error for thrown non-domain errors", async () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const mockDb = {
      $client: {
        unsafe: () => {
          throw new Error("db connection failed");
        },
      },
    } as unknown as DbClient;

    const app = createApp({
      db: mockDb,
      auth: {} as unknown as AuthenticationService,
    });

    const response = await app.handle(
      new Request("http://localhost/api/health")
    );

    expect(response.status).toBe(500);
    const body = await response.json();
    expect(body).toEqual({
      error: {
        code: "INTERNAL_SERVER",
        message: "internal server error",
      },
    });

    expect(consoleSpy).toHaveBeenCalledWith(
      "[Unhandled Server Error]",
      expect.any(Error)
    );

    consoleSpy.mockRestore();
  });
});