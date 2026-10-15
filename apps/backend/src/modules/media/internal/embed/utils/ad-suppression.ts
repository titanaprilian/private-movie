export const BLOCKED_APP_SCHEMES = ["shopee:", "intent:", "market:"];

export function isBlockedAppSchemeUrl(url: unknown): boolean {
  if (typeof url !== "string" || !url) return false;
  const lower = url.trim().toLowerCase();
  return BLOCKED_APP_SCHEMES.some((scheme) => lower.startsWith(scheme));
}

/**
 * Returns true when a proxy/relay target is a known ad delivery asset that
 * must never reach the client. Matched requests get a 204 no-op instead of
 * an upstream fetch. Covers the obfuscated BelloCloud `/cdn/runtime.js`
 * popunder injector plus known ad network script endpoints.
 */
export function isBlockedAdAsset(target: string): boolean {
  if (!target || typeof target !== "string") return false;
  const lower = target.toLowerCase();
  if (lower.includes("/cdn/runtime.js")) return true;
  try {
    const parsed = new URL(target, "https://placeholder.local");
    const host = parsed.hostname.toLowerCase();
    const path = `${parsed.pathname}${parsed.search}`.toLowerCase();
    if (path.includes("/cdn/runtime.js")) return true;
    if (
      KNOWN_AD_SCRIPT_PATTERNS.some(
        (pattern) => pattern.test(target) || pattern.test(`${host}${path}`)
      )
    ) {
      // Only treat as a blocked asset when the match looks like a script /
      // ad endpoint request, not arbitrary page HTML containing the words.
      if (
        /\.(js|css)(\?|$|#)/.test(path) ||
        path.includes("/ad") ||
        /tag\.min\.js|code\.min\.js|css\.js/.test(path)
      ) {
        return true;
      }
      // Known ad network hosts are always blocked regardless of path.
      if (
        /daly2024|effectivecpmnetwork|bvtpk|humeraldurezza|googletagmanager|yandex|clarity|exoclick|adcash|propeller|popunder|onclickads|cpmnetwork|whos\.amung\.us|amung/i.test(
          host
        )
      ) {
        return true;
      }
    }
  } catch {
    return lower.includes("/cdn/runtime.js") || lower.includes("runtime.js");
  }
  return false;
}

export function stripKnownAdScripts(html: string): string {
  return html.replace(
    /<script\b[^>]*>([\s\S]*?)<\/script>/gi,
    (match, scriptContent) => {
      const isAdScript = KNOWN_AD_SCRIPT_PATTERNS.some(
        (pattern) =>
          pattern.test(match) || pattern.test(scriptContent as string)
      );
      return isAdScript ? "" : match;
    }
  );
}

export const AD_SUPPRESSION_SHIM = `<script>
  (function() {
    var BLOCKED_SCHEMES = ['shopee:', 'intent:', 'market:'];
    function isBlockedSchemeUrl(url) {
      if (typeof url !== 'string' || !url) return false;
      var lower = url.trim().toLowerCase();
      for (var i = 0; i < BLOCKED_SCHEMES.length; i++) {
        if (lower.indexOf(BLOCKED_SCHEMES[i]) === 0) return true;
      }
      return false;
    }
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

    function cancelEvent(e) {
      e.preventDefault();
      e.stopPropagation();
      if (typeof e.stopImmediatePropagation === 'function') {
        e.stopImmediatePropagation();
      }
    }

    function anchorForEvent(e) {
      var target = e.target;
      while (target && target !== document) {
        if (target.tagName === 'A') return target;
        target = target.parentNode;
      }
      return null;
    }

    function handleBlankLink(e) {
      var anchor = anchorForEvent(e);
      if (!anchor) return;
      try {
        var href = anchor.getAttribute('href') || anchor.href || '';
        // Block external application intent schemes unconditionally.
        if (isBlockedSchemeUrl(href)) {
          cancelEvent(e);
          return;
        }
        // Block synthetic unprompted clicks (popup/clickjack injectors
        // dispatching non-trusted clicks on hijack anchors).
        if (e.isTrusted === false) {
          cancelEvent(e);
          return;
        }
        // Block hijacked top-level navigation via _blank targets.
        if (anchor.getAttribute('target') === '_blank' || anchor.target === '_blank') {
          cancelEvent(e);
          return;
        }
      } catch (err) {}
    }

    ['click', 'auxclick', 'touchend'].forEach(function(eventType) {
      document.addEventListener(eventType, handleBlankLink, true);
    });

    // Harden against top-level navigation hijacks: neutralize popup
    // redirects that assign window.top.location or open external schemes.
    try {
      window.addEventListener('beforeunload', function(e) {
        try {
          var active = document.activeElement;
          if (active && active.tagName === 'A') {
            var href = active.getAttribute('href') || '';
            if (isBlockedSchemeUrl(href)) {
              e.preventDefault();
              e.returnValue = '';
            }
          }
        } catch (err) {}
      }, true);
    } catch (e) {}
    try {
      document.addEventListener('click', function(e) {
        try {
          var anchor = anchorForEvent(e);
          if (anchor) {
            var href = anchor.getAttribute('href') || '';
            if (isBlockedSchemeUrl(href)) cancelEvent(e);
          }
        } catch (err) {}
      }, true);
    } catch (e) {}

    try {
      if (window.top !== window.self) {
        window.onbeforeunload = function() {};
      }
    } catch (e) {}
    // Prevent direct top-frame navigation attempts from ad scripts.
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

export const KNOWN_AD_SCRIPT_PATTERNS = [
  /css\.js/i,
  /tag\.min\.js/i,
  /code\.min\.js/i,
  /\/cdn\/runtime\.js/i,
  /runtime\.js/i,
  /popunder/i,
  /daly2024/i,
  /effectivecpmnetwork/i,
  /effectivecpm/i,
  /bvtpk/i,
  /humeraldurezza/i,
  /clarity/i,
  /yandex/i,
  /googletagmanager/i,
  /exoclick/i,
  /adcash/i,
  /propeller/i,
  /onclickads/i,
  /onclck/i,
  /clickadu/i,
  /shopee/i,
  /\/ad\?type=/i,
  /_ASO/i,
  /curiescores/i,
  /psoroumukr/i,
  /var t=\["sandbox","hasAttribute"/i,
  /whos\.amung\.us/i,
  /amungid/i,
];

export const VIDHIDE_ANTI_CLICKJACK_CSS = `<style id="pm-anti-clickjack">
  #adbd, .overdiv, div[style*="2147483647"], div[style*="opacity: 0.01"], div[style*="opacity:0.01"],
  div[style*="position: fixed"][style*="2147483647"], div[style*="position:fixed"][style*="2147483647"],
  div[style*="position: fixed"][style*="inset: 0"][style*="2147483647"], div[style*="position:fixed"][style*="inset:0"][style*="2147483647"],
  a[href^="shopee:"], a[href^="intent:"], a[href^="market:"] {
    display: none !important;
    pointer-events: none !important;
    visibility: hidden !important;
    width: 0 !important;
    height: 0 !important;
    z-index: -9999 !important;
    opacity: 0 !important;
  }
</style>`;
