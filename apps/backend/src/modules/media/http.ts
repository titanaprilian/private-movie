import { Elysia, t } from "elysia";
import { MVP_MEDIA_OPENAPI, type AuthenticationService } from "@repo/contracts";
import { authGuard } from "../../lib/auth";
import { errorResponse, successResponse } from "../../lib/response";
import type { DbClient } from "@repo/db";
import { AD_SUPPRESSION_SHIM, sanitizeHtmlContent } from "./internal/proxy-helpers";

export const UNTHROTTLED_MEDIA_ROUTE_PREFIXES = [
  "/embed",
  "/api/media/relay",
  "/api/media/proxy",
];

export interface MediaRoutesOptions {
  db: DbClient;
  authService: AuthenticationService;
}

/**
 * Root-level route for the embed sandbox bootstrap.
 * Registers at `/embed/:hash` (not under `/api` prefix).
 */
export const embedRoutes = () => {
  return new Elysia({ name: "embed-routes" }).get(
    "/embed/:hash",
    async ({ params }) => {
      const { hash } = params;

      const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Video Embed</title>
  ${AD_SUPPRESSION_SHIM}
</head>
<body>
  <script>
    (async () => {
      if ('serviceWorker' in navigator) {
        try {
          const registration = await navigator.serviceWorker.register('/media-proxy-sw.js', { scope: '/embed/' });
          await registration.update();
          await navigator.serviceWorker.ready;
          // Force the service worker to claim this page immediately
          if (registration.active) {
            await registration.active.postMessage({ type: 'CLAIM_CLIENTS' });
          }
          if (navigator.serviceWorker.clients) {
            await navigator.serviceWorker.clients.claim();
          }
          await new Promise(resolve => setTimeout(resolve, 100));
          const queryParams = window.location.search;
          const embedUrl = '/api/media/proxy-embed?url=' + encodeURIComponent('https://videobello.net/embed/${hash}' + queryParams);
          const response = await fetch(embedUrl);
          
          if (!response.ok) {
            document.body.innerHTML = '<p>Failed to load embed content</p>';
            return;
          }
          
          const embedHtml = await response.text();
          document.open();
          document.write(embedHtml);
          document.close();
        } catch (error) {
          console.error('Service Worker registration failed:', error);
          document.body.innerHTML = '<p>Service Worker failed to load</p>';
        }
      } else {
        document.body.innerHTML = '<p>Service Workers are not supported in this browser</p>';
      }
    })();
  </script>
</body>
</html>`;

      return new Response(html, {
        status: 200,
        headers: {
          "Content-Type": "text/html; charset=utf-8",
        },
      });
    },
    {
      params: t.Object({
        hash: t.String(),
      }),
    }
  );
};

export const mediaRoutes = (options: MediaRoutesOptions) => {
  const auth = authGuard(options.authService);

  return new Elysia({ name: "media-routes" })
    .get("/openapi.json", () => MVP_MEDIA_OPENAPI)
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
          let modifiedHtml = html;
          if (/(<head[^>]*>)/i.test(modifiedHtml)) {
            modifiedHtml = modifiedHtml.replace(
              /(<head[^>]*>)/i,
              `$1<base href="${origin}/">\n  ${AD_SUPPRESSION_SHIM}`
            );
          } else if (/(<html[^>]*>)/i.test(modifiedHtml)) {
            modifiedHtml = modifiedHtml.replace(
              /(<html[^>]*>)/i,
              `$1<head><base href="${origin}/">\n  ${AD_SUPPRESSION_SHIM}</head>`
            );
          } else {
            modifiedHtml = `<head><base href="${origin}/">\n  ${AD_SUPPRESSION_SHIM}</head>${modifiedHtml}`;
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
        query: t.Object({
          url: t.String(),
        }),
      }
    )
    .all(
      "/media/proxy/:domain/*",
      async ({ params, request, set }) => {
        try {
          const domain = params.domain;
          const wildcard = params["*"] || "";
          const requestUrl = new URL(request.url);
          const searchParams = requestUrl.search;
          const targetUrl = `https://${domain}/${wildcard}${searchParams}`;

          // Build headers for outbound request
          const outboundHeaders: Record<string, string> = {
            "User-Agent":
              "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
            Referer: `https://${domain}`,
          };

          // Forward safe inbound request headers
          request.headers.forEach((value, key) => {
            const lowerKey = key.toLowerCase();
            const unsafeHeaders = [
              "host",
              "origin",
              "referer",
              "cookie",
              "connection",
              "accept-encoding",
            ];
            if (!unsafeHeaders.includes(lowerKey)) {
              outboundHeaders[key] = value;
            }
          });

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
            const sanitizedHtml = sanitizeHtmlContent(html, domain);
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

          const outboundHeaders: Record<string, string> = {
            Referer: "https://dramula.com",
          };

          request.headers.forEach((value, key) => {
            const lowerKey = key.toLowerCase();
            const unsafeHeaders = [
              "host",
              "origin",
              "referer",
              "cookie",
              "connection",
              "accept-encoding",
            ];
            if (!unsafeHeaders.includes(lowerKey)) {
              outboundHeaders[key] = value;
            }
          });

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
        query: t.Object({
          url: t.String(),
        }),
      }
    )
    .post(
      "/media/sources/check",
      async ({ body, set }) => {
        let targetUrl: URL;
        try {
          targetUrl = new URL(body.url);
        } catch {
          return errorResponse(
            set,
            400,
            new Error("Invalid URL format")
          );
        }

        const startTime = Date.now();
        const outboundHeaders: Record<string, string> = {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
        };

        if (body.referer && body.referer.trim().length > 0) {
          outboundHeaders["Referer"] = body.referer.trim();
        } else {
          outboundHeaders["Referer"] = targetUrl.origin;
        }

        try {
          const headRes = await fetch(targetUrl.toString(), {
            method: "HEAD",
            headers: outboundHeaders,
            redirect: "follow",
            signal: AbortSignal.timeout(5000),
          });

          if (headRes.ok || (headRes.status >= 200 && headRes.status < 400)) {
            return successResponse({
              status: "working",
              statusCode: headRes.status,
              latencyMs: Date.now() - startTime,
              error: null,
            });
          }

          if (headRes.status === 405 || headRes.status === 403) {
            const getRes = await fetch(targetUrl.toString(), {
              method: "GET",
              headers: {
                ...outboundHeaders,
                Range: "bytes=0-0",
              },
              redirect: "follow",
              signal: AbortSignal.timeout(5000),
            });

            if (
              getRes.ok ||
              getRes.status === 206 ||
              (getRes.status >= 200 && getRes.status < 400)
            ) {
              return successResponse({
                status: "working",
                statusCode: getRes.status,
                latencyMs: Date.now() - startTime,
                error: null,
              });
            }

            return successResponse({
              status: "broken",
              statusCode: getRes.status,
              latencyMs: Date.now() - startTime,
              error: `Target server returned HTTP ${getRes.status}: ${getRes.statusText}`,
            });
          }

          return successResponse({
            status: "broken",
            statusCode: headRes.status,
            latencyMs: Date.now() - startTime,
            error: `Target server returned HTTP ${headRes.status}: ${headRes.statusText}`,
          });
        } catch (err: unknown) {
          const latencyMs = Date.now() - startTime;
          const errorMessage = err instanceof Error ? err.message : String(err);
          return successResponse({
            status: "broken",
            statusCode: null,
            latencyMs,
            error: errorMessage,
          });
        }
      },
      {
        beforeHandle: auth,
        body: t.Object({
          url: t.String(),
          type: t.Union([t.Literal("direct"), t.Literal("embed"), t.Literal("s3")]),
          referer: t.Optional(t.String()),
        }),
      }
    );
};
