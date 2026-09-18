import { InternalServerError } from "../../lib/errors";
import { Elysia, t } from "elysia";
import {
  MVP_MEDIA_OPENAPI,
  UnauthorizedError,
  type AuthenticationService,
} from "@repo/contracts";
import { authGuard } from "../../lib/auth";
import { errorResponse, successResponse } from "../../lib/response";
import {
  createSaveEpisodeService,
  createEpisodeRepositoryInternal,
  createSeriesRepositoryInternal,
  createSeasonsRepositoryInternal,
  createVideoSourceRepositoryInternal,
  createStorageProviderRegistry,
  EpisodeNotFoundError,
  SeasonNotFoundError,
  SeasonNotEmptyError,
  SeasonNotOngoingError,
  SeasonMissingScraperUrlError,
  SeriesFetchError,
  SeriesNotFoundError,
  VideoSourceNotFoundError,
  TmdbFetchError,
  type FetchFn,
  type BrowserFn,
  type S3StorageService,
  type StorageProviderRegistry,
} from "@repo/media-service";
import { SeriesParseError } from "@repo/media-scraper";

export interface MediaRoutesOptions {
  db: Parameters<typeof createSaveEpisodeService>[0];
  authService: AuthenticationService;
  fetchHtml?: FetchFn;
  browserFn?: BrowserFn;
  s3StorageService?: S3StorageService;
  storageProviderRegistry?: StorageProviderRegistry;
}

/**
 * Parse the optional `sourceTypes` query parameter. Accepts a
 * comma-separated string (`?sourceTypes=direct,s3`) or a repeated
 * array (`?sourceTypes=direct&sourceTypes=s3`). Returns `undefined`
 * when omitted or empty so repositories keep their default behavior.
 */
function parseSourceTypesParam(input: unknown): string[] | undefined {
  if (input === undefined || input === null) {
    return undefined;
  }
  const rawList = Array.isArray(input) ? input : [input];
  const out: string[] = [];
  for (const item of rawList) {
    if (typeof item !== "string") {
      continue;
    }
    for (const part of item.split(",")) {
      const trimmed = part.trim();
      if (trimmed.length > 0) {
        out.push(trimmed);
      }
    }
  }
  return out.length > 0 ? out : undefined;
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
  // Replace <script ...>...</script> or <script .../> matching known ad patterns
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
      // Decode HTML entities if any (e.g. &quot;)
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
        // If the original used single quotes, double quotes inside are safe; if double quotes, escape them
        if (quote === "'") {
          return `data-page='${newJson}'`;
        } else {
          return `data-page="${newJson.replace(/"/g, '&quot;')}"`;
        }
      }
    } catch {
      // If parsing fails, fall back to string replacements
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
  // https://domain/ -> /api/media/proxy/domain/
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
  return new Elysia({ name: "embed-routes" })
    .get(
      "/embed/:hash",
      async ({ params }) => {
        const { hash } = params;
        
        // Generate the HTML bootstrap document that:
        // 1. Registers the Service Worker
        // 2. Waits for activation and claims control
        // 3. Fetches the actual embed HTML from /api/media/proxy-embed
        // 4. Injects it via document.write()
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
      // Register the Service Worker
      if ('serviceWorker' in navigator) {
        try {
          const registration = await navigator.serviceWorker.register('/media-proxy-sw.js', { scope: '/embed/' });
          
          // Force network update of the Service Worker to prevent caching stale logic
          await registration.update();
          
          // Wait for the service worker to be active and claim control
          await navigator.serviceWorker.ready;
          
          // Force the service worker to claim this page immediately
          if (registration.active) {
            await registration.active.postMessage({ type: 'CLAIM_CLIENTS' });
          }
          
          // Wait a bit to ensure clients.claim() has completed
          await new Promise(resolve => setTimeout(resolve, 100));
          
          // Now fetch the actual embed HTML from proxy-embed
          // The hash will be used to construct the actual videobello URL, preserving query parameters
          const queryParams = window.location.search;
          const embedUrl = '/api/media/proxy-embed?url=' + encodeURIComponent('https://videobello.net/embed/${hash}' + queryParams);
          const response = await fetch(embedUrl);
          
          if (!response.ok) {
            document.body.innerHTML = '<p>Failed to load embed content</p>';
            return;
          }
          
          const embedHtml = await response.text();
          
          // Inject the embed HTML into the document
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
  const storageRegistry =
    options.storageProviderRegistry ??
    createStorageProviderRegistry(options.db, options.s3StorageService);

  const mediaService = createSaveEpisodeService(options.db, {
    fetchHtml: options.fetchHtml,
    browserFn: options.browserFn,
    s3StorageService: options.s3StorageService,
  });
  const episodeRepository = createEpisodeRepositoryInternal(options.db, {
    s3StorageService: options.s3StorageService,
    storageProviderRegistry: storageRegistry,
  });
  const seriesRepository = createSeriesRepositoryInternal(options.db, {
    s3StorageService: options.s3StorageService,
    storageProviderRegistry: storageRegistry,
  });
  const seasonsRepository = createSeasonsRepositoryInternal(options.db);
  const videoSourceRepository = createVideoSourceRepositoryInternal(options.db, {
    s3StorageService: options.s3StorageService,
    storageProviderRegistry: storageRegistry,
  });

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
            const unsafeHeaders = ["host", "origin", "referer", "cookie", "connection", "accept-encoding"];
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
              new Error(`Target server returned ${targetResponse.status}: ${targetResponse.statusText}`)
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
          // Validate URL parameter
          if (!query.url) {
            return errorResponse(
              set,
              400,
              new Error("Missing required 'url' query parameter")
            );
          }

          // Parse and validate the target URL
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

          // Build headers for the outbound request
          const outboundHeaders: Record<string, string> = {
            // Spoof the Referer to bypass CDN restrictions
            Referer: "https://dramula.com",
          };

          // Forward safe headers from the client
          request.headers.forEach((value, key) => {
            const lowerKey = key.toLowerCase();
            const unsafeHeaders = ['host', 'origin', 'referer', 'cookie', 'connection', 'accept-encoding'];
            if (!unsafeHeaders.includes(lowerKey)) {
              outboundHeaders[key] = value;
            }
          });

          // Fetch from the target URL with spoofed headers and corresponding method/body
          const targetResponse = await fetch(targetUrl.toString(), {
            method: request.method,
            headers: outboundHeaders,
            body: ['GET', 'HEAD'].includes(request.method.toUpperCase()) ? undefined : await request.clone().arrayBuffer()
          });

          // If target returns error, pass it through
          if (!targetResponse.ok) {
            return errorResponse(
              set,
              targetResponse.status,
              new Error(`Target server returned ${targetResponse.status}: ${targetResponse.statusText}`)
            );
          }

          // Stream the response directly without buffering
          // Preserve important headers from the target response
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

          // Return the stream directly
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
      async ({ body, headers, set }) => {
        const authHeader = headers["authorization"];
        if (!authHeader || !authHeader.startsWith("Bearer ")) {
          return errorResponse(
            set,
            401,
            new UnauthorizedError("missing or invalid authorization header")
          );
        }
        const token = authHeader.substring(7);
        try {
          await options.authService.verifyAccessToken(token);
        } catch {
          return errorResponse(set, 401, new UnauthorizedError("unauthorized"));
        }

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
          // Attempt a HEAD request first with a 5-second timeout and follow redirects
          const headRes = await fetch(targetUrl.toString(), {
            method: "HEAD",
            headers: outboundHeaders,
            redirect: "follow",
            signal: AbortSignal.timeout(5000),
          });

          // If HEAD succeeds (2xx) or returns 3xx (if not redirected), consider it working
          if (headRes.ok || (headRes.status >= 200 && headRes.status < 400)) {
            return successResponse({
              status: "working",
              statusCode: headRes.status,
              latencyMs: Date.now() - startTime,
              error: null,
            });
          }

          // If HEAD is 405 Method Not Allowed or 403 Forbidden, fall back to a ranged GET bytes=0-0
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

            if (getRes.ok || getRes.status === 206 || (getRes.status >= 200 && getRes.status < 400)) {
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
        body: t.Object({
          url: t.String(),
          type: t.Union([t.Literal("direct"), t.Literal("embed"), t.Literal("s3")]),
          referer: t.Optional(t.String()),
        }),
      }
    )
    .get(
      "/series",
      async ({ query }) => {
        const page = query.page ?? 1;
        const limit = query.limit ?? 20;
        const { source, q, genre, filter } = query;
        const result = await seriesRepository.list({
          page,
          limit,
          source,
          q,
          genre,
          filter,
        });
        return successResponse({
          series: result.series,
          meta: {
            total: result.total,
            page,
            limit,
          },
        });
      },
      {
        query: t.Object({
          page: t.Optional(t.Number({ default: 1, minimum: 1 })),
          limit: t.Optional(t.Number({ default: 20, minimum: 1, maximum: 100 })),
          source: t.Optional(t.Union([t.Literal("otakudesu"), t.Literal("dramula")])),
          q: t.Optional(t.String()),
          genre: t.Optional(t.String()),
          filter: t.Optional(t.Union([t.Literal("all"), t.Literal("featured"), t.Literal("ongoing")])),
        }),
      }
    )
    .get(
      "/series/home-feed",
      async ({ query }) => {
        const sourceTypes = parseSourceTypesParam(query?.sourceTypes);
        const feed = await seriesRepository.getHomeFeed(sourceTypes);
        return successResponse(feed);
      }
    )
    .get(
      "/series/:id",
      async ({ params, query, set }) => {
        const sourceTypes = parseSourceTypesParam(query?.sourceTypes);
        const s = await seriesRepository.findByIdWithEpisodes(params.id, sourceTypes);
        if (!s) {
          return errorResponse(
            set,
            404,
            new SeriesNotFoundError(`Series with id ${params.id} not found`)
          );
        }
        return successResponse(s);
      },
      {
        params: t.Object({
          id: t.String(),
        }),
      }
    )
    .post(
      "/preview-scrape-series",
      async ({ body }) => {
        const result = await mediaService.previewScrapeSeries(body);
        return successResponse(result);
      },
      {
        beforeHandle: authGuard(options.authService),
        body: t.Object({
          sourceUrl: t.String({ format: "uri" }),
          source: t.Union([t.Literal("otakudesu"), t.Literal("dramula")]),
          html: t.Optional(t.String()),
        }),
      }
    )
    .post(
      "/series/:id/preview-bulk-sources",
      async ({ params, body, headers, set }) => {
        const authHeader = headers["authorization"];
        if (!authHeader || !authHeader.startsWith("Bearer ")) {
          return errorResponse(
            set,
            401,
            new UnauthorizedError("missing or invalid authorization header")
          );
        }
        const token = authHeader.substring(7);
        try {
          await options.authService.verifyAccessToken(token);
        } catch {
          return errorResponse(set, 401, new UnauthorizedError("unauthorized"));
        }

        try {
          const result = await mediaService.previewBulkSources({
            seriesId: params.id,
            sourceUrl: body.sourceUrl,
            source: body.source,
            episodeOffset: body.episodeOffset,
            seasonId: body.seasonId,
            html: body.html,
          });
          return successResponse(result);
        } catch (error) {
          if (error instanceof SeriesNotFoundError) {
            return errorResponse(set, 404, error);
          }
          if (error instanceof SeriesFetchError || error instanceof SeriesParseError) {
            return errorResponse(set, 400, error);
          }
          throw error;
        }
      },
      {
        params: t.Object({
          id: t.String(),
        }),
        body: t.Object({
          sourceUrl: t.String({ format: "uri" }),
          source: t.Union([t.Literal("otakudesu"), t.Literal("dramula")]),
          episodeOffset: t.Optional(t.Number()),
          seasonId: t.Optional(t.String()),
          html: t.Optional(t.String()),
        }),
      }
    )

    // --- TMDB MANUAL MATCH START ---
    .post(
      "/series/:id/tmdb-sync",
      async ({ params, body, headers, set }) => {
        const authHeader = headers["authorization"];
        if (!authHeader || !authHeader.startsWith("Bearer ")) {
          return errorResponse(
            set,
            401,
            new UnauthorizedError("missing or invalid authorization header")
          );
        }
        const token = authHeader.substring(7);
        try {
          await options.authService.verifyAccessToken(token);
        } catch {
          return errorResponse(set, 401, new UnauthorizedError("unauthorized"));
        }

        try {
          const result = await mediaService.syncTmdb(params.id, body);
          return successResponse(result);
        } catch (e: unknown) {
          if (e instanceof SeriesNotFoundError) {
            return errorResponse(set, 404, e);
          }
          if (e instanceof TmdbFetchError) {
            return errorResponse(set, e.status === 404 ? 404 : 400, e);
          }
          if (e instanceof Error) {
            return errorResponse(set, 400, e);
          }
          return errorResponse(set, 500, new InternalServerError());
        }
      },
      {
        params: t.Object({
          id: t.String({ format: "uuid" }),
        }),
        body: t.Object({
          type: t.Union([t.Literal("tv"), t.Literal("movie")]),
          tmdbId: t.Numeric(),
          includeSpecials: t.Optional(t.Boolean()),
        }),
      }
    )
    .get(
      "/series/:id/tmdb-sync-preview",
      async ({ params, query, headers, set }) => {
        const authHeader = headers["authorization"];
        if (!authHeader || !authHeader.startsWith("Bearer ")) {
          return errorResponse(
            set,
            401,
            new UnauthorizedError("missing or invalid authorization header")
          );
        }
        const token = authHeader.substring(7);
        try {
          await options.authService.verifyAccessToken(token);
        } catch {
          return errorResponse(set, 401, new UnauthorizedError("unauthorized"));
        }

        try {
          const result = await mediaService.getTmdbSyncPreview(params.id, {
            type: query.type,
            tmdbId: query.tmdbId,
            includeSpecials: query.includeSpecials,
          });
          return successResponse(result);
        } catch (e: unknown) {
          if (e instanceof SeriesNotFoundError) {
            return errorResponse(set, 404, e);
          }
          if (e instanceof TmdbFetchError) {
            return errorResponse(set, e.status === 404 ? 404 : 400, e);
          }
          if (e instanceof Error) {
            return errorResponse(set, 400, e);
          }
          return errorResponse(set, 500, new InternalServerError());
        }
      },
      {
        params: t.Object({
          id: t.String({ format: "uuid" }),
        }),
        query: t.Object({
          type: t.Union([t.Literal("tv"), t.Literal("movie")]),
          tmdbId: t.Numeric(),
          includeSpecials: t.Optional(t.Boolean()),
        }),
      }
    )
    .post(
      "/series/tmdb-import",
      async ({ body, headers, set }) => {
        const authHeader = headers["authorization"];
        if (!authHeader || !authHeader.startsWith("Bearer ")) {
          return errorResponse(
            set,
            401,
            new UnauthorizedError("missing or invalid authorization header")
          );
        }
        const token = authHeader.substring(7);
        try {
          await options.authService.verifyAccessToken(token);
        } catch {
          return errorResponse(set, 401, new UnauthorizedError("unauthorized"));
        }

        try {
          const result = await mediaService.importTmdb({
            type: body.type,
            tmdbId: body.tmdbId,
            includeSpecials: body.includeSpecials,
          });
          return successResponse(result);
        } catch (e: unknown) {
          if (e instanceof TmdbFetchError) {
            return errorResponse(set, e.status === 404 ? 404 : 400, e);
          }
          if (e instanceof Error) {
            return errorResponse(set, 400, e);
          }
          return errorResponse(set, 500, new InternalServerError());
        }
      },
      {
        body: t.Object({
          type: t.Union([t.Literal("tv"), t.Literal("movie")]),
          tmdbId: t.Numeric(),
          includeSpecials: t.Optional(t.Boolean()),
        }),
      }
    )
    .get(
      "/series/tmdb-preview",
      async ({ query, headers, set }) => {
        const authHeader = headers["authorization"];
        if (!authHeader || !authHeader.startsWith("Bearer ")) {
          return errorResponse(
            set,
            401,
            new UnauthorizedError("missing or invalid authorization header")
          );
        }
        const token = authHeader.substring(7);
        try {
          await options.authService.verifyAccessToken(token);
        } catch {
          return errorResponse(set, 401, new UnauthorizedError("unauthorized"));
        }

        try {
          const result = await mediaService.getTmdbPreview(
            query.type,
            query.tmdbId,
            query.includeSpecials
          );
          return successResponse(result);
        } catch (e: unknown) {
          if (e instanceof TmdbFetchError) {
            return errorResponse(set, e.status === 404 ? 404 : 400, e);
          }
          if (e instanceof Error) {
            return errorResponse(set, 400, e);
          }
          return errorResponse(set, 500, new InternalServerError());
        }
      },
      {
        query: t.Object({
          type: t.Union([t.Literal("tv"), t.Literal("movie")]),
          tmdbId: t.Numeric(),
          includeSpecials: t.Optional(t.Boolean()),
        }),
      }
    )
    .get(
      "/seasons/:id",
      async ({ params, set }) => {
        const season = await seasonsRepository.findById(params.id);
        if (!season) {
          return errorResponse(
            set,
            404,
            new SeasonNotFoundError(`Season with id ${params.id} not found`)
          );
        }
        return successResponse(season);
      },
      {
        params: t.Object({
          id: t.String(),
        }),
      }
    )
    .patch(
      "/seasons/:id",
      async ({ params, body, headers, set }) => {
        const authHeader = headers["authorization"];
        if (!authHeader || !authHeader.startsWith("Bearer ")) {
          return errorResponse(
            set,
            401,
            new UnauthorizedError("missing or invalid authorization header")
          );
        }
        const token = authHeader.substring(7);
        try {
          await options.authService.verifyAccessToken(token);
        } catch {
          return errorResponse(set, 401, new UnauthorizedError("unauthorized"));
        }

        try {
          const updated = await seasonsRepository.updateSeason(params.id, {
            ...(body.title !== undefined ? { title: body.title } : {}),
            ...(body.description !== undefined ? { description: body.description } : {}),
            ...(body.posterUrl !== undefined ? { posterUrl: body.posterUrl } : {}),
            ...(body.status !== undefined ? { status: body.status } : {}),
            ...(body.scraperUrl !== undefined ? { scraperUrl: body.scraperUrl } : {}),
            ...(body.source !== undefined ? { source: body.source } : {}),
            ...(body.episodeOffset !== undefined ? { episodeOffset: body.episodeOffset } : {}),
          });
          return successResponse(updated);
        } catch (error: unknown) {
          if (error instanceof SeasonNotFoundError) {
            return errorResponse(set, 404, error);
          }
          throw error;
        }
      },
      {
        params: t.Object({ id: t.String({ format: "uuid" }) }),
        body: t.Object({
          title: t.Optional(t.String({ minLength: 1 })),
          description: t.Optional(t.Nullable(t.String())),
          posterUrl: t.Optional(t.Nullable(t.String())),
          status: t.Optional(t.String()),
          scraperUrl: t.Optional(t.Nullable(t.String())),
          source: t.Optional(t.Nullable(t.String())),
          episodeOffset: t.Optional(t.Integer()),
        }),
      }
    )
    .delete(
      "/seasons/:id",
      async ({ params, headers, set }) => {
        const authHeader = headers["authorization"];
        if (!authHeader || !authHeader.startsWith("Bearer ")) {
          return errorResponse(
            set,
            401,
            new UnauthorizedError("missing or invalid authorization header")
          );
        }
        const token = authHeader.substring(7);
        try {
          await options.authService.verifyAccessToken(token);
        } catch {
          return errorResponse(set, 401, new UnauthorizedError("unauthorized"));
        }

        try {
          await seasonsRepository.deleteSeason(params.id);
          return successResponse({ deleted: true });
        } catch (error: unknown) {
          if (error instanceof SeasonNotFoundError) {
            return errorResponse(set, 404, error);
          }
          if (error instanceof SeasonNotEmptyError) {
            return errorResponse(set, 409, error);
          }
          throw error;
        }
      },
      {
        params: t.Object({ id: t.String({ format: "uuid" }) }),
      }
    )
    .post(
      "/seasons/:id/scrape-ongoing",
      async ({ params, headers, set }) => {
        const authHeader = headers["authorization"];
        if (!authHeader || !authHeader.startsWith("Bearer ")) {
          return errorResponse(
            set,
            401,
            new UnauthorizedError("missing or invalid authorization header")
          );
        }
        const token = authHeader.substring(7);
        try {
          await options.authService.verifyAccessToken(token);
        } catch {
          return errorResponse(set, 401, new UnauthorizedError("unauthorized"));
        }

        try {
          const result = await mediaService.syncAndScrapeOngoingSeason(params.id);
          if (!result.success) {
            if (result.error?.includes("ongoing status")) {
              return errorResponse(set, 400, new SeasonNotOngoingError(result.error));
            }
            if (result.error?.includes("missing scraperUrl")) {
              return errorResponse(set, 400, new SeasonMissingScraperUrlError(result.error));
            }
            return errorResponse(
              set,
              400,
              new Error(result.error ?? "Failed to scrape ongoing season")
            );
          }
          return successResponse(result);
        } catch (error: unknown) {
          if (error instanceof SeasonNotFoundError) {
            return errorResponse(set, 404, error);
          }
          if (
            error instanceof SeasonNotOngoingError ||
            error instanceof SeasonMissingScraperUrlError
          ) {
            return errorResponse(set, 400, error);
          }
          if (error instanceof Error) {
            return errorResponse(set, 400, error);
          }
          return errorResponse(set, 500, new InternalServerError());
        }
      },
      {
        params: t.Object({ id: t.String({ format: "uuid" }) }),
      }
    )
    // --- TMDB MANUAL MATCH END ---
    
    .put(
      "/series/:id",
      async ({ params, body, headers, set }) => {
        const authHeader = headers["authorization"];
        if (!authHeader || !authHeader.startsWith("Bearer ")) {
          return errorResponse(
            set,
            401,
            new UnauthorizedError("missing or invalid authorization header")
          );
        }
        const token = authHeader.substring(7);
        try {
          await options.authService.verifyAccessToken(token);
        } catch {
          return errorResponse(set, 401, new UnauthorizedError("unauthorized"));
        }

        try {
          const updated = await seriesRepository.updateSeries(params.id, body);
          return successResponse(updated);
        } catch (error) {
          if (error instanceof SeriesNotFoundError) {
            return errorResponse(set, 404, error);
          }
          throw error;
        }
      },
      {
        params: t.Object({
          id: t.String({ format: "uuid" }),
        }),
        body: t.Object({
          title: t.Optional(t.String()),
          description: t.Optional(t.Nullable(t.String())),
          posterUrl: t.Optional(t.Nullable(t.String())),
          isFeatured: t.Optional(t.Boolean()),
          genreIds: t.Optional(t.Array(t.String())),
        }),
      }
    )
    .patch(
      "/series/:id",
      async ({ params, body, headers, set }) => {
        const authHeader = headers["authorization"];
        if (!authHeader || !authHeader.startsWith("Bearer ")) {
          return errorResponse(
            set,
            401,
            new UnauthorizedError("missing or invalid authorization header")
          );
        }
        const token = authHeader.substring(7);
        try {
          await options.authService.verifyAccessToken(token);
        } catch {
          return errorResponse(set, 401, new UnauthorizedError("unauthorized"));
        }

        try {
          const updated = await seriesRepository.updateSeries(params.id, body);
          return successResponse(updated);
        } catch (error) {
          if (error instanceof SeriesNotFoundError) {
            return errorResponse(set, 404, error);
          }
          throw error;
        }
      },
      {
        params: t.Object({
          id: t.String({ format: "uuid" }),
        }),
        body: t.Object({
          title: t.Optional(t.String()),
          description: t.Optional(t.Nullable(t.String())),
          posterUrl: t.Optional(t.Nullable(t.String())),
          isFeatured: t.Optional(t.Boolean()),
          genreIds: t.Optional(t.Array(t.String())),
        }),
      }
    )
    .patch(
      "/series/:id/episodes/order",
      async ({ params, body, headers, set }) => {
        const authHeader = headers["authorization"];
        if (!authHeader || !authHeader.startsWith("Bearer ")) {
          return errorResponse(
            set,
            401,
            new UnauthorizedError("missing or invalid authorization header")
          );
        }
        const token = authHeader.substring(7);
        try {
          await options.authService.verifyAccessToken(token);
        } catch {
          return errorResponse(set, 401, new UnauthorizedError("unauthorized"));
        }

        const seriesRow = await seriesRepository.findById(params.id);
        if (!seriesRow) {
          return errorResponse(
            set,
            404,
            new SeriesNotFoundError(`Series with id ${params.id} not found`)
          );
        }

        try {
          await episodeRepository.updateOrders(body);
          return successResponse({ success: true });
        } catch (error) {
          if (error instanceof EpisodeNotFoundError) {
            return errorResponse(set, 404, error);
          }
          throw error;
        }
      },
      {
        params: t.Object({
          id: t.String({ format: "uuid" }),
        }),
        body: t.Array(
          t.Object({
            id: t.String({ format: "uuid" }),
            order: t.Number(),
            seasonId: t.Optional(t.String({ format: "uuid" })),
          })
        ),
      }
    )
    .delete(
      "/series/:id",
      async ({ params, headers, set }) => {
        const authHeader = headers["authorization"];
        if (!authHeader || !authHeader.startsWith("Bearer ")) {
          return errorResponse(
            set,
            401,
            new UnauthorizedError("missing or invalid authorization header")
          );
        }
        const token = authHeader.substring(7);
        try {
          await options.authService.verifyAccessToken(token);
        } catch {
          return errorResponse(set, 401, new UnauthorizedError("unauthorized"));
        }

        try {
          const deleted = await seriesRepository.deleteSeries(params.id);
          return successResponse(deleted);
        } catch (error) {
          if (error instanceof SeriesNotFoundError) {
            return errorResponse(set, 404, error);
          }
          throw error;
        }
      },
      {
        params: t.Object({
          id: t.String({ format: "uuid" }),
        }),
      }
    );
};