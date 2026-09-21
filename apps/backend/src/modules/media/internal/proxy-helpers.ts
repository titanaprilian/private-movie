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

/**
 * CDN / player host fragments intercepted by `apps/web/public/media-proxy-sw.js`.
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
