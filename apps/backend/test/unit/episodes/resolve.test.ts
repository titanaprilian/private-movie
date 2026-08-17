import { describe, expect, it } from "vitest";
import type { FetchFn } from "@/modules/media";
import {
  ResolvedMirror,
  resolveMirrors,
  MirrorResolveError,
} from "@/modules/media/internal/episodes/resolve";

const NONCE_ACTION = "aa1208d27f29ca340c92c66d1926f13f";
const MIRROR_ACTION = "2a3505c93b0035d3f455df82bf976b84";

function buildMockFetch(options?: {
  nonceData?: string;
  mirrorData?: string;
  nonceFail?: boolean;
}): FetchFn {
  const nonceData = options?.nonceData ?? "fake-nonce-123";
  const mirrorData =
    options?.mirrorData ??
    Buffer.from(
      '<div id="pembed"><iframe src="https://player.example.com/embed/abc123" frameborder="0"></iframe></div>'
    ).toString("base64");

  return {
    async get() {
      throw new Error("get() is not supported by this mock");
    },
    async post(_url: string, _body: string) {
      const params = new URLSearchParams(_body);
      const action = params.get("action") ?? "";

      if (action === NONCE_ACTION) {
        if (options?.nonceFail) {
          throw new Error("nonce fetch failed");
        }
        return JSON.stringify({ data: nonceData });
      }

      if (action === MIRROR_ACTION) {
        return JSON.stringify({ data: mirrorData });
      }

      throw new Error(`unknown action: ${action}`);
    },
  };
}

describe("resolveMirrors", () => {
  describe("successful resolution", () => {
    it("resolves all mirrors and extracts iframe src URLs", async () => {
      const fetchFn = buildMockFetch();
      const payloads = [
        { id: 1, i: 0, q: "720p", label: "odstream" },
        { id: 2, i: 0, q: "720p", label: "vidhide" },
        { id: 3, i: 0, q: "720p", label: "mega" },
      ];

      const mirrors: ResolvedMirror[] = await resolveMirrors({
        payloads,
        fetchFn,
        nonceAction: NONCE_ACTION,
        mirrorAction: MIRROR_ACTION,
      });

      expect(mirrors).toHaveLength(3);
      expect(mirrors.map((m) => m.label)).toEqual([
        "odstream",
        "vidhide",
        "mega",
      ]);
      expect(
        mirrors.every(
          (m) => m.url === "https://player.example.com/embed/abc123"
        )
      ).toBe(true);
    });
  });

  describe("partial failure", () => {
    it("skips failed mirrors and returns successfully resolved ones", async () => {
      const failingFetch: FetchFn = {
        async get() {
          throw new Error("get() is not supported by this mock");
        },
        async post(_url: string, _body: string) {
          const params = new URLSearchParams(_body);
          const action = params.get("action") ?? "";

          if (action === NONCE_ACTION) {
            return JSON.stringify({ data: "fake-nonce" });
          }

          if (action !== MIRROR_ACTION) {
            throw new Error(`unknown action: ${action}`);
          }

          const i = parseInt(params.get("i") ?? "-1", 10);
          if (i === 1) {
            throw new Error("mirror request failed for vidhide");
          }

          const html = '<div id="pembed"><iframe src="https://player.example.com/embed/ok" frameborder="0"></iframe></div>';
          return JSON.stringify({ data: Buffer.from(html).toString("base64") });
        },
      };

      const mirrors = await resolveMirrors({
        payloads: [
          { id: 1, i: 0, q: "720p", label: "odstream" },
          { id: 2, i: 1, q: "720p", label: "vidhide" },
          { id: 3, i: 2, q: "720p", label: "mega" },
        ],
        fetchFn: failingFetch,
        nonceAction: NONCE_ACTION,
        mirrorAction: MIRROR_ACTION,
      });

      expect(mirrors).toHaveLength(2);
      expect(mirrors.map((m) => m.label)).toEqual(["odstream", "mega"]);
    });
  });

  describe("complete failure", () => {
    it("throws MirrorResolveError when all mirrors fail", async () => {
      const neverSucceeding: FetchFn = {
        async get() {
          throw new Error("get() is not supported");
        },
        async post() {
          throw new Error("everything fails");
        },
      };

      await expect(
        resolveMirrors({
          payloads: [
            { id: 1, i: 0, q: "720p", label: "odstream" },
            { id: 2, i: 1, q: "720p", label: "vidhide" },
          ],
          fetchFn: neverSucceeding,
          nonceAction: NONCE_ACTION,
          mirrorAction: MIRROR_ACTION,
        })
      ).rejects.toThrow(MirrorResolveError);
    });
  });

  describe("nonce fetch failure", () => {
    it("aborts resolution when nonce cannot be fetched", async () => {
      const nonceFailingFetch = buildMockFetch({ nonceFail: true });

      await expect(
        resolveMirrors({
          payloads: [{ id: 1, i: 0, q: "720p", label: "odstream" }],
          fetchFn: nonceFailingFetch,
          nonceAction: NONCE_ACTION,
          mirrorAction: MIRROR_ACTION,
        })
      ).rejects.toThrow(/failed to fetch nonce/i);
    });
  });

  describe("empty mirrors", () => {
    it("returns empty array when no mirror payloads are provided", async () => {
      const fetchFn = buildMockFetch();

      const mirrors = await resolveMirrors({
        payloads: [],
        fetchFn,
        nonceAction: NONCE_ACTION,
        mirrorAction: MIRROR_ACTION,
      });

      expect(mirrors).toEqual([]);
    });
  });
});
