import fs from "node:fs/promises";
import { Elysia } from "elysia";
import {
  AD_BLOCK_NOOP_RESPONSE,
  embedHashParamsSchema,
} from "../../schemas";
import {
  EMBED_UPSTREAM_ORIGIN,
  EMBED_USER_AGENT,
  RELAY_EMBED_REFERER,
} from "../proxy/utils/transport";
import {
  buildEmbedErrorDocument,
  buildServerRenderedEmbedDocument,
} from "./document";
import { isBlockedAdAsset } from "./utils/ad-suppression";

/**
 * Root-level route for the embed sandbox.
 * Server-renders the upstream BelloCloud player HTML (single HTTP response,
 * no Service Worker) with an in-page fetch/XHR relay interceptor and mobile
 * video attributes injected.
 * Registers at `/embed/:hash` (not under `/api` prefix).
 */
export const embedRoutes = () => {
  return new Elysia({ name: "embed-routes" }).get(
    "/embed/:hash",
    async ({ params, request }) => {
      const { hash } = params;

      // BelloCloud/Dramula hashes are base64-ish with dot separators and
      // checksums (e.g. `ZXBpc29kZToxMDM4Nw.bf0e5daa`, `...00000000`,
      // trailing `=` padding). Reject only empty hashes and characters
      // that could break out of the upstream path — never `/` or `\`.
      if (!hash || !/^[A-Za-z0-9_.~:=-]+$/.test(hash)) {
        return new Response(
          buildEmbedErrorDocument("This video is currently unavailable."),
          {
            status: 400,
            headers: { "Content-Type": "text/html; charset=utf-8" },
          }
        );
      }

      let upstreamUrl: URL;
      try {
        upstreamUrl = new URL(`${EMBED_UPSTREAM_ORIGIN}/embed/${hash}`);
        const incoming = new URL(request.url);
        upstreamUrl.search = incoming.search;
        // Guard against dot-segment normalization escaping /embed/.
        if (!upstreamUrl.pathname.startsWith("/embed/")) {
          return new Response(
            buildEmbedErrorDocument("This video is currently unavailable."),
            {
              status: 400,
              headers: { "Content-Type": "text/html; charset=utf-8" },
            }
          );
        }
      } catch {
        return new Response(
          buildEmbedErrorDocument("This video is currently unavailable."),
          {
            status: 400,
            headers: { "Content-Type": "text/html; charset=utf-8" },
          }
        );
      }

      let upstream: Response;
      try {
        upstream = await fetch(upstreamUrl.toString(), {
          headers: {
            "User-Agent": EMBED_USER_AGENT,
            Referer: RELAY_EMBED_REFERER,
          },
        });
      } catch {
        return new Response(
          buildEmbedErrorDocument(
            "Could not load the video player. Please try again later."
          ),
          {
            status: 502,
            headers: { "Content-Type": "text/html; charset=utf-8" },
          }
        );
      }

      if (!upstream.ok) {
        return new Response(
          buildEmbedErrorDocument(
            "Could not load the video player. Please try again later."
          ),
          {
            status: 502,
            headers: { "Content-Type": "text/html; charset=utf-8" },
          }
        );
      }

      let upstreamHtml: string;
      try {
        upstreamHtml = await upstream.text();
      } catch {
        return new Response(
          buildEmbedErrorDocument(
            "Could not load the video player. Please try again later."
          ),
          {
            status: 502,
            headers: { "Content-Type": "text/html; charset=utf-8" },
          }
        );
      }

      if (!upstreamHtml || !upstreamHtml.trim()) {
        return new Response(
          buildEmbedErrorDocument("This video is currently unavailable."),
          {
            status: 502,
            headers: { "Content-Type": "text/html; charset=utf-8" },
          }
        );
      }

      const document = buildServerRenderedEmbedDocument(
        upstreamHtml,
        upstream.url ? new URL(upstream.url).origin : EMBED_UPSTREAM_ORIGIN
      );

      return new Response(document, {
        status: 200,
        headers: {
          "Content-Type": "text/html; charset=utf-8",
        },
      });
    },
    {
      params: embedHashParamsSchema,
      detail: { hide: true },
    }
  ).get(
    "/player/*",
    async ({ params, set }) => {
      const wildcard = params["*"] || "";
      if (isBlockedAdAsset(wildcard) || isBlockedAdAsset(`/player/${wildcard}`)) {
        return AD_BLOCK_NOOP_RESPONSE();
      }
      const targetUrl = `${EMBED_UPSTREAM_ORIGIN}/player/${wildcard}`;
      try {
        const res = await fetch(targetUrl, {
          headers: {
            "User-Agent": EMBED_USER_AGENT,
            Referer: RELAY_EMBED_REFERER,
          },
        });
        if (!res.ok) {
          set.status = res.status;
          return "Player asset not found";
        }
        const contentType =
          res.headers.get("Content-Type") || "application/javascript";
        return new Response(res.body, {
          status: 200,
          headers: {
            "Content-Type": contentType,
            "Access-Control-Allow-Origin": "*",
          },
        });
      } catch {
        set.status = 502;
        return "Upstream unavailable";
      }
    },
    {
      detail: { hide: true },
    }
  ).all(
    "/_app/*",
    async ({ params, request, set }) => {
      const wildcard = params["*"] || "";
      if (isBlockedAdAsset(wildcard) || isBlockedAdAsset(`/_app/${wildcard}`)) {
        return AD_BLOCK_NOOP_RESPONSE();
      }
      const requestUrl = new URL(request.url);
      const targetUrl = `${EMBED_UPSTREAM_ORIGIN}/_app/${wildcard}${requestUrl.search}`;
      try {
        const res = await fetch(targetUrl, {
          headers: {
            "User-Agent": EMBED_USER_AGENT,
            Referer: RELAY_EMBED_REFERER,
          },
        });
        if (!res.ok) {
          set.status = res.status;
          return "Asset not found";
        }
        const contentType =
          res.headers.get("Content-Type") || "application/javascript";
        return new Response(res.body, {
          status: 200,
          headers: {
            "Content-Type": contentType,
            "Access-Control-Allow-Origin": "*",
          },
        });
      } catch {
        set.status = 502;
        return "Upstream unavailable";
      }
    },
    {
      detail: { hide: true },
    }
  );
};

/**
 * Embed API surface mounted under `/api` via the module coordinator:
 * upstream embed API forward and the client debug-log sink used by the
 * server-rendered embed document.
 */
export const embedApiRoutes = () => {
  return new Elysia({ name: "embed-api-routes" })
    .post(
      "/media/debug-log",
      async ({ body }) => {
        try {
          const line = `[${new Date().toISOString()}] ${typeof body === "string" ? body : JSON.stringify(body)}\n`;
          await fs.appendFile("/tmp/player-mobile.log", line);
        } catch {
          /* best-effort debug logging; ignore filesystem errors */
        }
        return { ok: true };
      },
      {
        detail: { hide: true },
      }
    )
    .post(
      "/embed",
      async ({ request, set }) => {
        try {
          const body = await request.clone().arrayBuffer();
          const res = await fetch(`${EMBED_UPSTREAM_ORIGIN}/api/embed`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "User-Agent": EMBED_USER_AGENT,
              Referer: RELAY_EMBED_REFERER,
            },
            body,
          });
          const text = await res.text();
          return new Response(text, {
            status: res.status,
            headers: {
              "Content-Type": "application/json",
              "Access-Control-Allow-Origin": "*",
            },
          });
        } catch {
          set.status = 502;
          return { error: "Failed to forward embed API request" };
        }
      },
      {
        detail: { hide: true },
      }
    );
};
