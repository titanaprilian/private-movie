import { describe, expect, it, beforeAll } from "vitest";
import { buildApp, request } from "../../utils/app";
import { registerUser, authHeaders } from "../../utils/auth";
import type { App } from "../../utils/app";

describe("POST /episodes/:id/resolve", () => {
  let app: App;

  beforeAll(async () => {
    app = await buildApp();
  });

  it("returns 404 since endpoint is removed", async () => {
    const { accessToken } = await registerUser(app);

    const response = await request(app, {
      method: "POST",
      path: "/episodes/00000000-0000-0000-0000-000000000001/resolve",
      headers: authHeaders(accessToken),
    });

    expect(response.status).toBe(404);
  });
});
