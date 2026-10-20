import {
  EMBED_UPSTREAM_ORIGIN,
  RELAY_CDN_HOST_FRAGMENTS,
} from "../proxy/utils/transport";
import {
  AD_SUPPRESSION_SHIM,
  VIDHIDE_ANTI_CLICKJACK_CSS,
  stripKnownAdScripts,
} from "./utils/ad-suppression";

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
      if (url.indexOf('/api/media/crypto-subtle') !== -1) return false;
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
 * Client-side debug logger. Forwards console messages, unhandled errors,
 * and failed fetch requests to /api/media/debug-log for real-time mobile debugging.
 */
export const DEBUG_LOGGER_SHIM = `<script id="pm-debug-logger">
  (function() {
    function sendLog(type, data) {
      try {
        var payload = JSON.stringify({
          time: new Date().toISOString(),
          ua: navigator.userAgent,
          type: type,
          data: data
        });
        if (navigator.sendBeacon) {
          navigator.sendBeacon('/api/media/debug-log', payload);
        } else {
          var xhr = new XMLHttpRequest();
          xhr.open('POST', '/api/media/debug-log', true);
          xhr.setRequestHeader('Content-Type', 'application/json');
          xhr.send(payload);
        }
      } catch (e) {}
    }

    var origError = console.error;
    console.error = function() {
      try {
        sendLog('console.error', Array.prototype.slice.call(arguments).map(String));
      } catch (e) {}
      origError.apply(console, arguments);
    };

    var origWarn = console.warn;
    console.warn = function() {
      try {
        sendLog('console.warn', Array.prototype.slice.call(arguments).map(String));
      } catch (e) {}
      origWarn.apply(console, arguments);
    };

    window.addEventListener('error', function(e) {
      sendLog('window.error', { message: e.message, filename: e.filename, lineno: e.lineno, colno: e.colno });
    });

    window.addEventListener('unhandledrejection', function(e) {
      sendLog('unhandledrejection', { reason: String(e.reason) });
    });

    var origFetch = window.fetch;
    window.fetch = function(input, init) {
      var url = typeof input === 'string' ? input : (input && input.url ? input.url : String(input));
      var method = (init && init.method) || (input && input.method) || 'GET';
      return origFetch.apply(this, arguments).then(function(res) {
        if (!res.ok) {
          try {
            res.clone().text().then(function(bodyText) {
              sendLog('fetch.error', { url: url, method: method, status: res.status, body: bodyText.slice(0, 500) });
            }).catch(function() {
              sendLog('fetch.error', { url: url, method: method, status: res.status });
            });
          } catch (e) {
            sendLog('fetch.error', { url: url, method: method, status: res.status });
          }
        } else {
          sendLog('fetch.ok', { url: url, method: method, status: res.status });
        }
        return res;
      }).catch(function(err) {
        sendLog('fetch.fail', { url: url, method: method, error: String(err) });
        throw err;
      });
    };
  })();
</script>`;
/**
 * Polyfill for window.crypto.subtle on non-secure contexts (e.g. mobile LAN IP testing over HTTP).
 * When accessed over http://192.168.x.x, browsers disable window.crypto.subtle per W3C spec.
 * This transparently proxies cryptographic calls (AES-CBC, AES-GCM, digest) to the backend
 * using native WebCrypto, ensuring mobile can decrypt player stream keys without HTTPS setup.
 */
export const WEBCRYPTO_INSECURE_POLYFILL_SHIM = `<script id="pm-webcrypto-polyfill">
  (function() {
    if (typeof window === 'undefined') return;
    window.crypto = window.crypto || {};
    if (window.crypto.subtle) return;

    function toBase64(buf) {
      var bytes = new Uint8Array(buf);
      var binary = '';
      for (var i = 0; i < bytes.byteLength; i++) {
        binary += String.fromCharCode(bytes[i]);
      }
      return btoa(binary);
    }

    function fromBase64(str) {
      var binary = atob(str);
      var bytes = new Uint8Array(binary.length);
      for (var i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
      }
      return bytes.buffer;
    }

    function toBuffer(val) {
      if (!val) return null;
      if (val instanceof ArrayBuffer) return val;
      if (ArrayBuffer.isView(val)) return val.buffer.slice(val.byteOffset, val.byteOffset + val.byteLength);
      return val;
    }

    window.crypto.subtle = {
      importKey: function(format, keyData, algorithm, extractable, keyUsages) {
        var rawBuf = toBuffer(keyData);
        var keyObj = {
          type: 'secret',
          extractable: extractable,
          algorithm: typeof algorithm === 'string' ? { name: algorithm } : algorithm,
          usages: keyUsages,
          _rawBase64: rawBuf ? toBase64(rawBuf) : null
        };
        return Promise.resolve(keyObj);
      },

      decrypt: function(algorithm, key, data) {
        var alg = Object.assign({}, typeof algorithm === 'string' ? { name: algorithm } : algorithm);
        if (alg.iv) alg.iv = toBase64(toBuffer(alg.iv));
        if (alg.counter) alg.counter = toBase64(toBuffer(alg.counter));
        var dataB64 = toBase64(toBuffer(data));
        return fetch('/api/media/crypto-subtle', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            op: 'decrypt',
            algorithm: alg,
            keyRaw: key ? key._rawBase64 : null,
            keyAlgorithm: key ? key.algorithm : null,
            data: dataB64
          })
        }).then(function(res) {
          if (!res.ok) throw new Error('Decryption failed on insecure origin proxy');
          return res.json();
        }).then(function(resJson) {
          return fromBase64(resJson.result);
        });
      },

      encrypt: function(algorithm, key, data) {
        var alg = Object.assign({}, typeof algorithm === 'string' ? { name: algorithm } : algorithm);
        if (alg.iv) alg.iv = toBase64(toBuffer(alg.iv));
        if (alg.counter) alg.counter = toBase64(toBuffer(alg.counter));
        var dataB64 = toBase64(toBuffer(data));
        return fetch('/api/media/crypto-subtle', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            op: 'encrypt',
            algorithm: alg,
            keyRaw: key ? key._rawBase64 : null,
            keyAlgorithm: key ? key.algorithm : null,
            data: dataB64
          })
        }).then(function(res) {
          if (!res.ok) throw new Error('Encryption failed on insecure origin proxy');
          return res.json();
        }).then(function(resJson) {
          return fromBase64(resJson.result);
        });
      },

      digest: function(algorithm, data) {
        var alg = typeof algorithm === 'string' ? { name: algorithm } : algorithm;
        var dataB64 = toBase64(toBuffer(data));
        return fetch('/api/media/crypto-subtle', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            op: 'digest',
            algorithm: alg,
            data: dataB64
          })
        }).then(function(res) {
          return res.json();
        }).then(function(resJson) {
          return fromBase64(resJson.result);
        });
      },

      sign: function(algorithm, key, data) {
        var alg = Object.assign({}, typeof algorithm === 'string' ? { name: algorithm } : algorithm);
        var dataB64 = toBase64(toBuffer(data));
        return fetch('/api/media/crypto-subtle', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            op: 'sign',
            algorithm: alg,
            keyRaw: key ? key._rawBase64 : null,
            keyAlgorithm: key ? key.algorithm : null,
            data: dataB64
          })
        }).then(function(res) {
          if (!res.ok) throw new Error('Signing failed on insecure origin proxy');
          return res.json();
        }).then(function(resJson) {
          return fromBase64(resJson.result);
        });
      },

      verify: function(algorithm, key, signature, data) {
        var alg = Object.assign({}, typeof algorithm === 'string' ? { name: algorithm } : algorithm);
        var sigB64 = toBase64(toBuffer(signature));
        var dataB64 = toBase64(toBuffer(data));
        return fetch('/api/media/crypto-subtle', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            op: 'verify',
            algorithm: alg,
            keyRaw: key ? key._rawBase64 : null,
            keyAlgorithm: key ? key.algorithm : null,
            signature: sigB64,
            data: dataB64
          })
        }).then(function(res) {
          if (!res.ok) throw new Error('Verification failed on insecure origin proxy');
          return res.json();
        }).then(function(resJson) {
          return Boolean(resJson.result);
        });
      },

      exportKey: function(format, key) {
        if (format === 'raw' && key && key._rawBase64) {
          return Promise.resolve(fromBase64(key._rawBase64));
        }
        return Promise.reject(new Error('Only raw key export supported'));
      }
    };
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

  let processed = stripKnownAdScripts(enforceMobileVideoAttributes(upstreamHtml));

  // Rewrite root-relative asset tags (SvelteKit entry bundles under /_app/,
  // preloaded player scripts/styles under root paths) so native ES module
  // imports resolve same-origin through the reverse proxy instead of hitting
  // the upstream host cross-origin (CORS-blocked for modules).
  // Rewrite relative/root asset tags and inline dynamic imports for SvelteKit.
  // WebKit on iOS resolves dynamic imports in inline scripts against window.location.href,
  // ignoring <base href>. Absolute same-origin URLs ensure both Chrome and WebKit load correctly.
  processed = processed.replace(
    /import\((['"])(?:\.\.\/|\.\/|\/)?_app\//g,
    `import($1${proxyDomainRoot}_app/`
  );
  processed = processed.replace(
    /(src|href)=(["'])(?:\.\.\/|\.\/)?_app\//gi,
    `$1=$2${proxyDomainRoot}_app/`
  );
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
    `<base href="${proxyDocumentBase}">\n  ${DEBUG_LOGGER_SHIM}\n  ${WEBCRYPTO_INSECURE_POLYFILL_SHIM}\n  ${EMBED_SW_CLEANUP_SHIM}\n  ${VIDHIDE_ANTI_CLICKJACK_CSS}\n  ${AD_SUPPRESSION_SHIM}\n  ${buildRelayInterceptorShim(proxyDomainRoot)}\n  ${MOBILE_VIDEO_SHIM}`;
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
