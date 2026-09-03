import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  MVP_MEDIA_OPENAPI,
  MVP_MEDIA_PUBLIC_PATHS,
} from "../../src/media-openapi";

describe("MVP public media OpenAPI contract", () => {
  it("covers the public home feed and series details endpoints", () => {
    for (const path of MVP_MEDIA_PUBLIC_PATHS) {
      expect(
        Object.keys(MVP_MEDIA_OPENAPI.paths),
        `missing OpenAPI path ${path}`,
      ).toContain(path);
    }

    expect(
      MVP_MEDIA_OPENAPI.paths["/api/series/home-feed"].get.operationId,
    ).toBe("getHomeFeed");
    expect(MVP_MEDIA_OPENAPI.paths["/api/series/{id}"].get.operationId).toBe(
      "getSeriesById",
    );
  });

  it("includes the shared success and error envelope schemas", () => {
    const schemas = MVP_MEDIA_OPENAPI.components.schemas;
    expect(schemas.SuccessEnvelope).toBeDefined();
    expect(schemas.ErrorEnvelope).toBeDefined();
    expect(schemas.ErrorResponse).toBeDefined();
    expect(schemas.HomeFeedSuccessResponse).toBeDefined();
    expect(schemas.SeriesDetailsSuccessResponse).toBeDefined();
  });

  it("stays in sync with the committed publishable artifact", () => {
    const artifactPath = resolve(
      import.meta.dirname,
      "..",
      "..",
      "openapi",
      "mvp-media.openapi.json",
    );
    const artifact = JSON.parse(readFileSync(artifactPath, "utf8"));
    expect(artifact).toEqual(JSON.parse(JSON.stringify(MVP_MEDIA_OPENAPI)));
  });
});
