export const AD_SUPPRESSION_SHIM = `<script>
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

export const KNOWN_AD_SCRIPT_PATTERNS = [
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

export const VIDHIDE_ANTI_CLICKJACK_CSS = `<style id="pm-anti-clickjack">
  #adbd, .overdiv, div[style*="2147483647"], div[style*="opacity: 0.01"], div[style*="opacity:0.01"] {
    display: none !important;
    pointer-events: none !important;
    visibility: hidden !important;
    width: 0 !important;
    height: 0 !important;
    z-index: -9999 !important;
  }
</style>`;

export function buildProxyShim(domain: string): string {
  return `<script>
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

export const RELAY_EMBED_REFERER = "https://dramula.com";
export const RELAY_CDN_REFERER = "https://videobello.net/";
export const EMBED_UPSTREAM_ORIGIN = "https://videobello.net";
export const EMBED_USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

/**
 * CDN / player host fragments intercepted in-page by the relay interceptor
 * shim and routed through `/api/media/relay`.
 * Requests to these hosts carry the videobello player page as Referer —
 * the CDN allow-lists the player, not dramula.
 */
export const RELAY_CDN_HOST_FRAGMENTS = [
  "skylayer64.online",
  "cloudremux.online",
  "cloudflow",
  "streamflow",
  "medialayer",
  "desustream.net",
  "onenesuhd.com",
  "odstream.net",
];

export function resolveRelayReferer(hostname: string): string {
  const host = hostname.toLowerCase();
  if (host === "videobello.net" || host.endsWith(".videobello.net")) {
    return RELAY_EMBED_REFERER;
  }
  if (RELAY_CDN_HOST_FRAGMENTS.some((fragment) => host.includes(fragment))) {
    return RELAY_CDN_REFERER;
  }
  return RELAY_EMBED_REFERER;
}

export function sanitizeHtmlContent(html: string, domain: string): string {
  let processed = html;

  // 1. Strip known ad script tags
  processed = processed.replace(
    /<script\b[^>]*>([\s\S]*?)<\/script>/gi,
    (match, scriptContent) => {
      const isAdScript = KNOWN_AD_SCRIPT_PATTERNS.some((pattern) =>
        pattern.test(match) || pattern.test(scriptContent)
      );

      if (isAdScript) {
        return "";
      }

      return match;
    }
  );

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
 * In-page fetch/XHR interceptor shim. Routes outbound media and playlist
 * requests to BelloCloud CDN domains through the backend relay
 * (`/api/media/relay?url=...`) so the server can attach the required
 * Referer headers. Replaces the former Service Worker interception, which
 * fails on insecure origins and detaches on mobile WebKit.
 */
export function buildRelayInterceptorShim(
  proxyDomainRoot: string = "/api/media/proxy/videobello.net/"
): string {
  const fragments = JSON.stringify(RELAY_CDN_HOST_FRAGMENTS);
  return `<script id="pm-relay-interceptor">
  (function() {
    var CDN_FRAGMENTS = ${fragments};
    function shouldIntercept(url) {
      if (typeof url !== 'string' || !url) return false;
      // Recursion guard: never re-intercept relay calls. Checked first so a
      // relay URL resolved against the upstream <base> tag
      // (https://videobello.net/api/media/relay?url=...) still matches.
      if (url.indexOf('/api/media/relay') !== -1) return false;
      // Same-origin proxy assets (/_app chunks, player scripts) already route
      // through the backend reverse proxy — never send them to the relay.
      if (url.indexOf('/api/media/proxy/') !== -1) return false;
      var lower = url.toLowerCase();
      if (lower.indexOf('videobello.net') !== -1) return true;
      for (var i = 0; i < CDN_FRAGMENTS.length; i++) {
        if (lower.indexOf(CDN_FRAGMENTS[i].toLowerCase()) !== -1) return true;
      }
      return false;
    }
    function relayBase() {
      // Root relay calls to the host application's origin explicitly. A bare
      // relative path would inherit the upstream <base href> tag and be sent
      // to the provider host, causing 404 routing errors.
      try {
        if (typeof window !== 'undefined' && window.location && window.location.origin && window.location.origin !== 'null') {
          return window.location.origin + '/api/media/relay?url=';
        }
      } catch (e) {}
      return '/api/media/relay?url=';
    }
    function toRelay(url) {
      return relayBase() + encodeURIComponent(url);
    }
    function toHref(input) {
      if (typeof input === 'string') return input;
      if (input && typeof input.url === 'string') return input.url;
      if (typeof URL !== 'undefined' && input instanceof URL) return input.href;
      return input;
    }
    function absolutize(url) {
      try {
        return new URL(toHref(url), document.baseURI).href;
      } catch (e) {
        return toHref(url);
      }
    }
    function toProxy(path) {
      return '${proxyDomainRoot}' + path.replace(/^[/]+/, '');
    }
    function rewrite(url) {
      var urlStr = toHref(url);
      if (typeof urlStr === 'string') {
        if (urlStr === '/api/embed' || urlStr.indexOf('/api/embed') === 0 || (urlStr.indexOf('/api/') === 0 && urlStr.indexOf('/api/media/') === -1)) {
          return toProxy(urlStr);
        }
      }
      var abs = absolutize(url);
      if (abs.indexOf('videobello.net/api/embed') !== -1) {
        return toProxy('api/embed');
      }
      if (!shouldIntercept(abs)) return url;
      return toRelay(abs);
    }
    if (typeof window.fetch === 'function') {
      var origFetch = window.fetch;
      window.fetch = function(input, init) {
        if (typeof input === 'string') {
          input = rewrite(input);
        } else if (typeof URL !== 'undefined' && input instanceof URL) {
          var href = rewrite(input.href);
          if (href !== input.href) input = href;
        } else if (input && typeof input.url === 'string') {
          try {
            input = new Request(rewrite(input.url), input);
          } catch (e) {}
        }
        return origFetch.call(this, input, init);
      };
    }
    if (typeof XMLHttpRequest !== 'undefined') {
      var origOpen = XMLHttpRequest.prototype.open;
      XMLHttpRequest.prototype.open = function(method, url) {
        if (typeof url === 'string' || (typeof URL !== 'undefined' && url instanceof URL)) {
          arguments[1] = rewrite(url);
        }
        return origOpen.apply(this, arguments);
      };
    }
    try {
      var origScriptSrc = Object.getOwnPropertyDescriptor(HTMLScriptElement.prototype, 'src');
      if (origScriptSrc && origScriptSrc.set) {
        Object.defineProperty(HTMLScriptElement.prototype, 'src', {
          set: function(val) {
            if (typeof val === 'string' && val.indexOf('/player/') !== -1 && val.indexOf('/api/media/proxy/') === -1) {
              val = toProxy(val);
            }
            return origScriptSrc.set.call(this, val);
          },
          get: origScriptSrc.get,
          configurable: true
        });
      }
    } catch (e) {}
  })();
</script>`;
}

/**
 * Mobile playback enforcement shim. Ensures every <video> element carries
 * playsinline / webkit-playsinline so mobile WebKit plays inline instead of
 * suspending or forcing fullscreen.
 */
export const MOBILE_VIDEO_SHIM = `<script id="pm-mobile-video">
  (function() {
    function enforce(video) {
      try {
        video.setAttribute('playsinline', '');
        video.setAttribute('webkit-playsinline', '');
        if (!video.hasAttribute('preload')) video.setAttribute('preload', 'metadata');
      } catch (e) {}
    }
    function enforceAll(root) {
      try {
        var scope = root || document;
        var videos = scope.querySelectorAll ? scope.querySelectorAll('video') : [];
        for (var i = 0; i < videos.length; i++) enforce(videos[i]);
      } catch (e) {}
    }
    document.addEventListener('DOMContentLoaded', function() { enforceAll(document); });
    enforceAll(document);
    if (typeof MutationObserver !== 'undefined') {
      var observer = new MutationObserver(function(mutations) {
        for (var i = 0; i < mutations.length; i++) {
          var mutation = mutations[i];
          for (var j = 0; j < mutation.addedNodes.length; j++) {
            var node = mutation.addedNodes[j];
            if (node && node.tagName === 'VIDEO') {
              enforce(node);
            } else if (node && node.querySelectorAll) {
              enforceAll(node);
            }
          }
        }
      });
      if (document.documentElement) {
        observer.observe(document.documentElement, { childList: true, subtree: true });
      }
    }
  })();
</script>`;

export function enforceMobileVideoAttributes(html: string): string {
  return html.replace(
    /<video\b([^>]*)>/gi,
    (match, attrs) => {
      let result = attrs as string;
      if (!/\bplaysinline\b/i.test(result)) result += " playsinline";
      if (!/\bwebkit-playsinline\b/i.test(result)) result += " webkit-playsinline";
      if (!/\bpreload\s*=/i.test(result)) result += ' preload="metadata"';
      return `<video${result}>`;
    }
  );
}

/**
 * Proactively deregisters legacy Service Workers under the embed scope on
 * page load so stale worker caches from existing browser profiles cannot
 * intercept player traffic. Scoped narrowly to /embed/ registrations.
 */
export const EMBED_SW_CLEANUP_SHIM = `<script id="pm-sw-cleanup">
  (function() {
    try {
      if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator && navigator.serviceWorker && navigator.serviceWorker.getRegistrations) {
        navigator.serviceWorker.getRegistrations().then(function(registrations) {
          for (var i = 0; i < registrations.length; i++) {
            try {
              var scope = registrations[i].scope || '';
              if (scope.indexOf('/embed/') !== -1) {
                registrations[i].unregister();
              }
            } catch (e) {}
          }
        }).catch(function() {});
      }
    } catch (e) {}
  })();
</script>`;

/**
 * Compose the final server-rendered embed document: upstream player HTML +
 * base tag + SW cleanup + ad-suppression shim + relay interceptor + mobile video shim.
 */
export function buildServerRenderedEmbedDocument(
  upstreamHtml: string,
  origin: string = EMBED_UPSTREAM_ORIGIN
): string {
  let domain = "videobello.net";
  try {
    domain = new URL(origin).hostname || domain;
  } catch {
    // keep default domain
  }
  const proxyDomainRoot = `/api/media/proxy/${domain}/`;
  const proxyDocumentBase = `/api/media/proxy/${domain}/embed/`;

  let processed = enforceMobileVideoAttributes(upstreamHtml);

  // Rewrite root-relative asset tags (SvelteKit entry bundles under /_app/,
  // preloaded player scripts/styles under root paths) so native ES module
  // imports resolve same-origin through the reverse proxy instead of hitting
  // the upstream host cross-origin (CORS-blocked for modules).
  processed = processed.replace(
    /(src|href)=(["'])\/(?!\/|api\/media\/proxy\/)/gi,
    `$1=$2${proxyDomainRoot}`
  );

  // Rewrite absolute upstream URLs (https://<domain>/...) to the proxy.
  const domainEscaped = domain.replace(/\./g, "\\.");
  processed = processed.replace(
    new RegExp(`https?://${domainEscaped}/`, "gi"),
    proxyDomainRoot
  );

  // Rewrite bare stream/download paths used by inline player scripts.
  processed = processed.replace(
    /(["'])\/stream\//g,
    `$1${proxyDomainRoot}stream/`
  );
  processed = processed.replace(/(["'])\/dl\?/g, `$1${proxyDomainRoot}dl?`);

  // Same-origin base: relative entry/chunk imports (../_app/..., ./chunk.js)
  // resolve relative to the embed document path through the backend reverse proxy.
  // Using proxyDocumentBase (/api/media/proxy/<domain>/embed/) ensures that
  // `../_app/...` resolves to `/api/media/proxy/<domain>/_app/...` without stripping the domain.
  const injections =
    `<base href="${proxyDocumentBase}">\n  ${EMBED_SW_CLEANUP_SHIM}\n  ${AD_SUPPRESSION_SHIM}\n  ${buildRelayInterceptorShim(proxyDomainRoot)}\n  ${MOBILE_VIDEO_SHIM}`;
  if (/(<head[^>]*>)/i.test(processed)) {
    processed = processed.replace(/(<head[^>]*>)/i, `$1\n  ${injections}`);
  } else if (/(<html[^>]*>)/i.test(processed)) {
    processed = processed.replace(
      /(<html[^>]*>)/i,
      `$1\n<head>\n  ${injections}\n</head>`
    );
  } else {
    processed = `<head>\n  ${injections}\n</head>\n${processed}`;
  }

  return processed;
}

export function buildEmbedErrorDocument(message: string): string {
  const safe = message
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Video unavailable</title>
</head>
<body>
  <p>${safe}</p>
</body>
</html>`;
}
