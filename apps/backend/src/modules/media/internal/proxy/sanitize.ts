import {
  VIDHIDE_ANTI_CLICKJACK_CSS,
  stripKnownAdScripts,
} from "../embed/utils/ad-suppression";

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

    var BLOCKED_SCHEMES = ['shopee:', 'intent:', 'market:'];
    function isBlockedSchemeUrl(url) {
      if (typeof url !== 'string' || !url) return false;
      var lower = url.trim().toLowerCase();
      for (var bi = 0; bi < BLOCKED_SCHEMES.length; bi++) {
        if (lower.indexOf(BLOCKED_SCHEMES[bi]) === 0) return true;
      }
      return false;
    }

    try {
      var originalClick = HTMLAnchorElement.prototype.click;
      HTMLAnchorElement.prototype.click = function() {
        try {
          var href = this.getAttribute('href') || this.href || '';
          if (this.getAttribute('target') === '_blank' || this.target === '_blank') {
            return;
          }
          if (isBlockedSchemeUrl(href)) {
            return;
          }
        } catch (e) {}
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

    function cancelEvt(e) {
      e.preventDefault();
      e.stopPropagation();
      if (typeof e.stopImmediatePropagation === 'function') {
        e.stopImmediatePropagation();
      }
    }

    function handleBlankLink(e) {
      var target = e.target;
      while (target && target !== document) {
        if (target.tagName === 'A') {
          try {
            var href = target.getAttribute('href') || target.href || '';
            if (isBlockedSchemeUrl(href)) {
              cancelEvt(e);
              return;
            }
            if (e.isTrusted === false) {
              cancelEvt(e);
              return;
            }
            if (target.getAttribute('target') === '_blank' || target.target === '_blank') {
              cancelEvt(e);
              return;
            }
          } catch (err) {}
          return;
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
    try {
      var topRef = null;
      try { topRef = window.top; } catch (e) {}
      if (topRef && topRef !== window.self) {
        try {
          Object.defineProperty(topRef, 'location', {
            configurable: false,
            enumerable: true,
            get: function() { return window.location; },
            set: function() { return window.location; }
          });
        } catch (e) {}
      }
    } catch (e) {}
  })();
</script>`;
}
export function buildProxyBaseHref(domain: string, targetPath?: string): string {
  const root = `/api/media/proxy/${domain}/`;
  if (!targetPath) return root;
  let pathname = targetPath;
  try {
    // Accept full upstream URLs (https://domain/a/b/page.html) as well as
    // raw proxy paths (a/b/page.html, /a/b/page.html).
    if (/^https?:\/\//i.test(pathname)) {
      pathname = new URL(pathname).pathname;
    }
  } catch {
    return root;
  }
  // Strip query string / hash if a raw path with extras was passed.
  pathname = pathname.split("?")[0].split("#")[0];
  if (!pathname.startsWith("/")) pathname = `/${pathname}`;
  if (pathname.endsWith("/")) {
    return `/api/media/proxy/${domain}${pathname}`;
  }
  const lastSlash = pathname.lastIndexOf("/");
  const directory = lastSlash <= 0 ? "/" : `${pathname.slice(0, lastSlash + 1)}`;
  return `/api/media/proxy/${domain}${directory}`;
}

export function sanitizeHtmlContent(html: string, domain: string, targetUrlOrPath?: string): string {
  let processed = stripKnownAdScripts(html);

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
  // Path-aware base: preserves the proxied resource's directory so relative
  // assets (e.g. playerjs.js in a provider sub-path) resolve through the
  // proxy with their directory hierarchy intact.
  const baseHref = buildProxyBaseHref(domain, targetUrlOrPath);
  const injections = `<base href="${baseHref}">\n  ${VIDHIDE_ANTI_CLICKJACK_CSS}\n  ${buildProxyShim(domain)}`;

  if (/(<head[^>]*>)/i.test(processed)) {
    processed = processed.replace(/(<head[^>]*>)/i, `$1\n  ${injections}`);
  } else if (/(<html[^>]*>)/i.test(processed)) {
    processed = processed.replace(/(<html[^>]*>)/i, `$1\n<head>\n  ${injections}\n</head>`);
  } else {
    processed = `<head>\n  ${injections}\n</head>\n${processed}`;
  }

  return processed;
}
