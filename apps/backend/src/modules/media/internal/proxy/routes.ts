import { Elysia } from "elysia";
import { errorResponse } from "../../../../lib/response";
import {
  AD_BLOCK_NOOP_RESPONSE,
  proxyEmbedQuerySchema,
  relayQuerySchema,
  type MediaRoutesOptions,
} from "../../schemas";
import { sanitizeHtmlContent } from "./sanitize";
import {
  AD_SUPPRESSION_SHIM,
  VIDHIDE_ANTI_CLICKJACK_CSS,
  isBlockedAdAsset,
  stripKnownAdScripts,
} from "../embed/utils/ad-suppression";
import {
  buildProxyOutboundHeaders,
  resolveRelayReferer,
} from "./utils/transport";

export const proxyRoutes = (_options: MediaRoutesOptions) => {
  return new Elysia({ name: "media-proxy-routes" })
    .get(
      "/media/proxy-embed",
      async ({ query, set }) => {
        try {
          const parsedUrl = new URL(query.url);
          const origin = parsedUrl.origin;
          const res = await fetch(query.url, {
            headers: {
              "User-Agent":
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
              Referer: "https://dramula.com",
            },
          });
          if (!res.ok) {
            return errorResponse(
              set,
              res.status,
              new Error(`Failed to fetch embed content: ${res.statusText}`)
            );
          }
          const html = await res.text();
          let modifiedHtml = stripKnownAdScripts(html);
          const embedInjections = `${VIDHIDE_ANTI_CLICKJACK_CSS}\n  ${AD_SUPPRESSION_SHIM}`;
          if (/(<head[^>]*>)/i.test(modifiedHtml)) {
            modifiedHtml = modifiedHtml.replace(
              /(<head[^>]*>)/i,
              `$1<base href="${origin}/">\n  ${embedInjections}`
            );
          } else if (/(<html[^>]*>)/i.test(modifiedHtml)) {
            modifiedHtml = modifiedHtml.replace(
              /(<html[^>]*>)/i,
              `$1<head><base href="${origin}/">\n  ${embedInjections}</head>`
            );
          } else {
            modifiedHtml = `<head><base href="${origin}/">\n  ${embedInjections}</head>${modifiedHtml}`;
          }
          return new Response(modifiedHtml, {
            status: 200,
            headers: {
              "Content-Type": "text/html; charset=utf-8",
            },
          });
        } catch (error) {
          return errorResponse(
            set,
            400,
            error instanceof Error ? error : new Error("Invalid URL or fetch failed")
          );
        }
      },
      {
        query: proxyEmbedQuerySchema,
        detail: { hide: true },
      }
    )
    .all(
      "/media/proxy/:domain/*",
      async ({ params, request, set }) => {
        try {
          const domain = params.domain;
          let wildcard = params["*"] || "";
          // Strip protocol and duplicate domain prefixes (e.g. from JWPlayer chunk resolution)
          wildcard = wildcard.replace(/^https?:\/+/i, "");
          if (wildcard.toLowerCase().startsWith(`${domain.toLowerCase()}/`)) {
            wildcard = wildcard.slice(domain.length + 1);
          }
          const requestUrl = new URL(request.url);
          const searchParams = requestUrl.search;
          const targetUrl = `https://${domain}/${wildcard}${searchParams}`;
          if (isBlockedAdAsset(targetUrl) || isBlockedAdAsset(`/${wildcard}${searchParams}`)) {
            return AD_BLOCK_NOOP_RESPONSE();
          }

          const outboundHeaders = buildProxyOutboundHeaders(
            request,
            resolveRelayReferer(domain) || `https://${domain}`
          );

          const isGetOrHead = ["GET", "HEAD"].includes(request.method.toUpperCase());
          const targetResponse = await fetch(targetUrl, {
            method: request.method,
            headers: outboundHeaders,
            body: isGetOrHead ? undefined : await request.clone().arrayBuffer(),
          });

          if (!targetResponse.ok) {
            return errorResponse(
              set,
              targetResponse.status,
              new Error(
                `Target server returned ${targetResponse.status}: ${targetResponse.statusText}`
              )
            );
          }

          const rawContentType = targetResponse.headers.get("Content-Type") || "";
          const isHtml = rawContentType.toLowerCase().includes("text/html");

          if (isHtml) {
            const html = await targetResponse.text();
            const sanitizedHtml = sanitizeHtmlContent(html, domain, targetUrl);
            return new Response(sanitizedHtml, {
              status: 200,
              headers: {
                "Content-Type": rawContentType || "text/html; charset=utf-8",
                "Access-Control-Allow-Origin": "*",
              },
            });
          }

          // Sub-resources & streams: stream response directly with CORS
          const responseHeaders: HeadersInit = {
            "Access-Control-Allow-Origin": "*",
          };

          const contentType = targetResponse.headers.get("Content-Type");
          if (contentType) {
            responseHeaders["Content-Type"] = contentType;
          }

          const contentLength = targetResponse.headers.get("Content-Length");
          if (contentLength) {
            responseHeaders["Content-Length"] = contentLength;
          }

          const contentRange = targetResponse.headers.get("Content-Range");
          if (contentRange) {
            responseHeaders["Content-Range"] = contentRange;
          }

          const acceptRanges = targetResponse.headers.get("Accept-Ranges");
          if (acceptRanges) {
            responseHeaders["Accept-Ranges"] = acceptRanges;
          }

          return new Response(targetResponse.body, {
            status: targetResponse.status,
            headers: responseHeaders,
          });
        } catch (error) {
          return errorResponse(
            set,
            500,
            error instanceof Error ? error : new Error("Proxy request failed")
          );
        }
      },
      {
        detail: { hide: true },
      }
    )
    .all(
      "/media/relay",
      async ({ query, set, request }) => {
        try {
          if (!query.url) {
            return errorResponse(
              set,
              400,
              new Error("Missing required 'url' query parameter")
            );
          }

          let targetUrl: URL;
          try {
            targetUrl = new URL(query.url);
          } catch {
            return errorResponse(
              set,
              400,
              new Error("Invalid URL format")
            );
          }

          if (isBlockedAdAsset(query.url)) {
            return AD_BLOCK_NOOP_RESPONSE();
          }

          const outboundHeaders = buildProxyOutboundHeaders(
            request,
            resolveRelayReferer(targetUrl.hostname)
          );

          const targetResponse = await fetch(targetUrl.toString(), {
            method: request.method,
            headers: outboundHeaders,
            body: ["GET", "HEAD"].includes(request.method.toUpperCase())
              ? undefined
              : await request.clone().arrayBuffer(),
          });

          if (!targetResponse.ok) {
            return errorResponse(
              set,
              targetResponse.status,
              new Error(
                `Target server returned ${targetResponse.status}: ${targetResponse.statusText}`
              )
            );
          }

          const responseHeaders: HeadersInit = {};

          const contentType = targetResponse.headers.get("Content-Type");
          if (contentType) {
            responseHeaders["Content-Type"] = contentType;
          }

          const contentLength = targetResponse.headers.get("Content-Length");
          if (contentLength) {
            responseHeaders["Content-Length"] = contentLength;
          }

          const contentRange = targetResponse.headers.get("Content-Range");
          if (contentRange) {
            responseHeaders["Content-Range"] = contentRange;
          }

          const acceptRanges = targetResponse.headers.get("Accept-Ranges");
          if (acceptRanges) {
            responseHeaders["Accept-Ranges"] = acceptRanges;
          }

          return new Response(targetResponse.body, {
            status: targetResponse.status,
            headers: responseHeaders,
          });
        } catch (error) {
          return errorResponse(
            set,
            500,
            error instanceof Error ? error : new Error("Relay request failed")
          );
        }
      },
      {
        query: relayQuerySchema,
        detail: { hide: true },
      }
    );
};
