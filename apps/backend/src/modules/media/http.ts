import { Elysia, t } from "elysia";
import { MVP_MEDIA_OPENAPI, type AuthenticationService } from "@repo/contracts";
import { authGuard } from "../../lib/auth";
import { errorResponse, successResponse } from "../../lib/response";
import type { DbClient } from "@repo/db";

export interface MediaRoutesOptions {
  db: DbClient;
  authService: AuthenticationService;
}

const AD_SUPPRESSION_SHIM = `<script>
  (function() {
    var mockWindow = {
      focus: function() {},
      blur: function() {},
      close: function() {},
      closed: true,
      document: {},
      location: { href: '' }
    };

    try {
      Object.defineProperty(window, 'open', {
        value: function() {
          return mockWindow;
        },
        writable: false,
        configurable: false
      });
    } catch (e) {
      window.open = function() {
        return mockWindow;
      };
    }

    try {
      if (typeof HTMLIFrameElement !== 'undefined' && HTMLIFrameElement.prototype) {
        var originalContentWindowGetter = Object.getOwnPropertyDescriptor(HTMLIFrameElement.prototype, 'contentWindow')?.get;
        Object.defineProperty(HTMLIFrameElement.prototype, 'contentWindow', {
          get: function() {
            var cw = originalContentWindowGetter ? originalContentWindowGetter.apply(this) : null;
            if (cw) {
              try {
                cw.open = function() { return mockWindow; };
              } catch (e) {}
            }
            return cw;
          },
          configurable: true
        });
      }
    } catch (e) {}

    try {
      if (typeof HTMLFormElement !== 'undefined' && HTMLFormElement.prototype) {
        var originalSubmit = HTMLFormElement.prototype.submit;
        HTMLFormElement.prototype.submit = function() {
          if (this.getAttribute('target') === '_blank' || this.target === '_blank') {
            return;
          }
          return originalSubmit.apply(this, arguments);
        };
      }
    } catch (e) {}

    try {
      var originalClick = HTMLAnchorElement.prototype.click;
      HTMLAnchorElement.prototype.click = function() {
        if (this.getAttribute('target') === '_blank' || this.target === '_blank') {
          return;
        }
        return originalClick.apply(this, arguments);
      };
    } catch (e) {}

    function handleBlankLink(e) {
      var target = e.target;
      while (target && target !== document) {
        if (target.tagName === 'A') {
          if (target.getAttribute('target') === '_blank' || target.target === '_blank') {
            e.preventDefault();
            e.stopPropagation();
            if (typeof e.stopImmediatePropagation === 'function') {
              e.stopImmediatePropagation();
            }
            return;
          }
        }
        target = target.parentNode;
      }
    }

    ['click', 'auxclick', 'touchend'].forEach(function(eventType) {
      document.addEventListener(eventType, handleBlankLink, true);
    });

    try {
      if (window.top !== window.self) {
        window.onbeforeunload = function() {};
      }
    } catch (e) {}
  })();
</script>`;

const KNOWN_AD_SCRIPT_PATTERNS = [
  /css\.js/i,
  /tag\.min\.js/i,
  /code\.min\.js/i,
  /daly2024/i,
  /effectivecpmnetwork/i,
  /bvtpk/i,
  /humeraldurezza/i,
  /clarity/i,
  /yandex/i,
  /googletagmanager/i,
  /\/ad\?type=/i,
  /_ASO/i,
  /curiescores/i,
  /psoroumukr/i,
  /var t=\["sandbox","hasAttribute"/i,
];

const VIDHIDE_ANTI_CLICKJACK_CSS = `<style id="pm-anti-clickjack">
  #adbd, .overdiv, div[style*="2147483647"], div[style*="opacity: 0.01"], div[style*="opacity:0.01"] {
    display: none !important;
    pointer-events: none !important;
    visibility: hidden !important;
    width: 0 !important;
    height: 0 !important;
    z-index: -9999 !important;
  }
</style>`;

function buildProxyShim(domain: string): string {
  return `<script>
  (function() {
    var domain = ${JSON.stringify(domain)};
    var proxyPrefix = '/api/media/proxy/' + domain;

    function redirectUrl(url) {
      if (typeof url !== 'string' || !url) return url;
      if (url.startsWith('/') && !url.startsWith('/api/')) {
        return proxyPrefix + url;
      }
      if (url.startsWith('http://') || url.startsWith('https://')) {
        try {
          var u = new URL(url);
          if (u.host === domain) {
            return proxyPrefix + u.pathname + u.search + u.hash;
          }
        } catch (e) {}
      }
      return url;
    }

    if (typeof window.fetch === 'function') {
      var origFetch = window.fetch;
      window.fetch = function(input, init) {
        if (typeof input === 'string') {
          input = redirectUrl(input);
        } else if (input && typeof input.url === 'string') {
          try {
            input = new Request(redirectUrl(input.url), input);
          } catch (e) {}
        }
        return origFetch.call(this, input, init);
      };
    }

    if (typeof XMLHttpRequest !== 'undefined') {
      var origOpen = XMLHttpRequest.prototype.open;
      XMLHttpRequest.prototype.open = function(method, url) {
        if (typeof url === 'string') {
          url = redirectUrl(url);
        }
        return origOpen.apply(this, arguments);
      };
    }

    try {
      if (typeof HTMLScriptElement !== 'undefined') {
        var origScriptSrc = Object.getOwnPropertyDescriptor(HTMLScriptElement.prototype, 'src');
        if (origScriptSrc && origScriptSrc.set) {
          Object.defineProperty(HTMLScriptElement.prototype, 'src', {
            set: function(val) {
              return origScriptSrc.set.call(this, redirectUrl(val));
            },
            get: origScriptSrc.get,
            configurable: true
          });
        }
      }
      if (typeof HTMLLinkElement !== 'undefined') {
        var origLinkHref = Object.getOwnPropertyDescriptor(HTMLLinkElement.prototype, 'href');
        if (origLinkHref && origLinkHref.set) {
          Object.defineProperty(HTMLLinkElement.prototype, 'href', {
            set: function(val) {
              return origLinkHref.set.call(this, redirectUrl(val));
            },
            get: origLinkHref.get,
            configurable: true
          });
        }
      }
      if (typeof HTMLMediaElement !== 'undefined') {
        var origMediaSrc = Object.getOwnPropertyDescriptor(HTMLMediaElement.prototype, 'src');
        if (origMediaSrc && origMediaSrc.set) {
          Object.defineProperty(HTMLMediaElement.prototype, 'src', {
            set: function(val) {
              return origMediaSrc.set.call(this, redirectUrl(val));
            },
            get: origMediaSrc.get,
            configurable: true
          });
        }
      }
      if (typeof HTMLSourceElement !== 'undefined') {
        var origSourceSrc = Object.getOwnPropertyDescriptor(HTMLSourceElement.prototype, 'src');
        if (origSourceSrc && origSourceSrc.set) {
          Object.defineProperty(HTMLSourceElement.prototype, 'src', {
            set: function(val) {
              return origSourceSrc.set.call(this, redirectUrl(val));
            },
            get: origSourceSrc.get,
            configurable: true
          });
        }
      }
    } catch (e) {}

    try {
      var _jwplayer;
      Object.defineProperty(window, 'jwplayer', {
        get: function() {
          return _jwplayer;
        },
        set: function(fn) {
          if (typeof fn === 'function') {
            var wrapper = function(id) {
              var player = fn.apply(this, arguments);
              if (player && typeof player.setup === 'function' && !player.__setupWrapped) {
                player.__setupWrapped = true;
                var origSetup = player.setup;
                player.setup = function(config) {
                  if (config && Array.isArray(config.sources)) {
                    config.sources.forEach(function(s) {
                      if (s && typeof s.file === 'string') {
                        s.file = redirectUrl(s.file);
                      }
                    });
                  }
                  if (config && typeof config.file === 'string') {
                    config.file = redirectUrl(config.file);
                  }
                  return origSetup.call(this, config);
                };
              }
              return player;
            };
            for (var k in fn) {
              try { wrapper[k] = fn[k]; } catch(e) {}
            }
            _jwplayer = wrapper;
          } else {
            _jwplayer = fn;
          }
        },
        configurable: true
      });
    } catch (e) {}

    var mockWindow = {
      focus: function() {},
      blur: function() {},
      close: function() {},
      closed: true,
      document: {},
      location: { href: '' }
    };

    try {
      Object.defineProperty(window, 'open', {
        value: function() {
          return mockWindow;
        },
        writable: false,
        configurable: false
      });
    } catch (e) {
      window.open = function() {
        return mockWindow;
      };
    }

    try {
      if (typeof HTMLIFrameElement !== 'undefined' && HTMLIFrameElement.prototype) {
        var originalContentWindowGetter = Object.getOwnPropertyDescriptor(HTMLIFrameElement.prototype, 'contentWindow')?.get;
        Object.defineProperty(HTMLIFrameElement.prototype, 'contentWindow', {
          get: function() {
            var cw = originalContentWindowGetter ? originalContentWindowGetter.apply(this) : null;
            if (cw) {
              try {
                cw.open = function() { return mockWindow; };
              } catch (e) {}
            }
            return cw;
          },
          configurable: true
        });
      }
    } catch (e) {}

    try {
      if (typeof HTMLFormElement !== 'undefined' && HTMLFormElement.prototype) {
        var originalSubmit = HTMLFormElement.prototype.submit;
        HTMLFormElement.prototype.submit = function() {
          if (this.getAttribute('target') === '_blank' || this.target === '_blank') {
            return;
          }
          return originalSubmit.apply(this, arguments);
        };
      }
    } catch (e) {}

    try {
      var originalClick = HTMLAnchorElement.prototype.click;
      HTMLAnchorElement.prototype.click = function() {
        if (this.getAttribute('target') === '_blank' || this.target === '_blank') {
          return;
        }
        return originalClick.apply(this, arguments);
      };
    } catch (e) {}

    function handleBlankLink(e) {
      var target = e.target;
      while (target && target !== document) {
        if (target.tagName === 'A') {
          if (target.getAttribute('target') === '_blank' || target.target === '_blank') {
            e.preventDefault();
            e.stopPropagation();
            if (typeof e.stopImmediatePropagation === 'function') {
              e.stopImmediatePropagation();
            }
            return;
          }
        }
        target = target.parentNode;
      }
    }

    ['click', 'auxclick', 'touchend'].forEach(function(eventType) {
      document.addEventListener(eventType, handleBlankLink, true);
    });

    try {
      if (window.top !== window.self) {
        window.onbeforeunload = function() {};
      }
    } catch (e) {}
  })();
</script>`;
}

function sanitizeHtmlContent(html: string, domain: string): string {
  let processed = html;

  // 1. Strip known ad script tags
  processed = processed.replace(/<script\b[^>]*>([\s\S]*?)<\/script>/gi, (match, scriptBody) => {
    for (const pattern of KNOWN_AD_SCRIPT_PATTERNS) {
      if (pattern.test(match) || pattern.test(scriptBody)) {
        return "";
      }
    }
    return match;
  });

  // 2. Filedon embed sanitization: sanitize data-page attribute
  processed = processed.replace(/data-page=(['"])([\s\S]*?)\1/gi, (match, quote, jsonStr) => {
    try {
      const decoded = jsonStr
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&amp;/g, "&");
      const parsed = JSON.parse(decoded);
      if (typeof parsed === "object" && parsed !== null) {
        if (parsed.props) {
          parsed.props.ads_enabled = false;
          parsed.props.ad_slots = {};
          parsed.props.footer_script = "";
          parsed.props.ads_on_embed = false;
          if (parsed.props.files && parsed.props.files.user) {
            parsed.props.files.user.ads_on_embed = false;
            parsed.props.files.user.ads_on_download = false;
            if (parsed.props.files.user.player_setting) {
              parsed.props.files.user.player_setting.remove_ads_enabled = true;
            }
          }
        }
        parsed.ads_enabled = false;
        parsed.ad_slots = {};
        parsed.footer_script = "";
        parsed.ads_on_embed = false;
        const newJson = JSON.stringify(parsed);
        if (quote === "'") {
          return `data-page='${newJson}'`;
        } else {
          return `data-page="${newJson.replace(/"/g, '&quot;')}"`;
        }
      }
    } catch {
      const fallback = jsonStr
        .replace(/"ads_enabled"\s*:\s*true/g, '"ads_enabled":false')
        .replace(/"ads_on_embed"\s*:\s*true/g, '"ads_on_embed":false')
        .replace(/"ad_slots"\s*:\s*\{[^}]*\}/g, '"ad_slots":{}')
        .replace(/"footer_script"\s*:\s*"[^"]*"/g, '"footer_script":""');
      return `data-page=${quote}${fallback}${quote}`;
    }
    return match;
  });

  // 3. Rewrite root-relative src and href attributes to go through reverse proxy
  processed = processed.replace(
    /(src|href)=(["'])\/(?!\/|api\/media\/proxy\/)/gi,
    `$1=$2/api/media/proxy/${domain}/`
  );

  // 4. Rewrite absolute links matching target domain
  const domainEscaped = domain.replace(/\./g, "\\.");
  const domainRegex = new RegExp(`https?://${domainEscaped}/`, "gi");
  processed = processed.replace(domainRegex, `/api/media/proxy/${domain}/`);

  // 5. Rewrite Vidhide stream links in inline scripts
  processed = processed.replace(/(["'])\/stream\//g, `$1/api/media/proxy/${domain}/stream/`);
  processed = processed.replace(/(["'])\/dl\?/g, `$1/api/media/proxy/${domain}/dl?`);

  // 6. Inject base tag, hardened shim, and anti-clickjack CSS into <head>
  const injections = `<base href="/api/media/proxy/${domain}/">\n  ${VIDHIDE_ANTI_CLICKJACK_CSS}\n  ${buildProxyShim(domain)}`;

  if (/(<head[^>]*>)/i.test(processed)) {
    processed = processed.replace(/(<head[^>]*>)/i, `$1\n  ${injections}`);
  } else if (/(<html[^>]*>)/i.test(processed)) {
    processed = processed.replace(/(<html[^>]*>)/i, `$1\n<head>\n  ${injections}\n</head>`);
  } else {
    processed = `<head>\n  ${injections}\n</head>\n${processed}`;
  }

  return processed;
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
