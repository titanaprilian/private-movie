package com.privatemovie.tv.modules.player.internal

/**
 * WebView compatibility config for third-party embed providers.
 *
 * Pure Kotlin with no Android framework dependencies so the provider
 * workarounds stay unit-testable on the JVM:
 *
 * - Some providers (e.g. vidhide) render nested `<iframe>` players that stay
 *   black because autoplay is blocked until a user gesture reaches the
 *   top-level document. [AUTOPLAY_UNLOCK_SCRIPT] simulates that gesture via
 *   `evaluateJavascript` inside `onPageFinished`.
 * - Other providers silently refuse to load when they detect the Android
 *   WebView `wv` flag in the User-Agent. [resolveTvUserAgent] disguises the
 *   WebView as a standard Chrome mobile browser.
 */

/**
 * Pinned standard Chrome-on-Android mobile User-Agent (no `wv` identifier).
 * Used as the global WebView override and as the fallback when the device
 * default User-Agent is missing or cannot be de-webviewed. A generic modern
 * Chrome string is sufficient to bypass lazy provider blocks; keep the
 * Chrome major version reasonably up to date.
 */
const val TV_EMBED_USER_AGENT =
    "Mozilla/5.0 (Linux; Android 11; K) AppleWebKit/537.36 " +
        "(KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36"

/** Matches a standalone `wv` token (not a substring like `swv` or `wvx`). */
private val WEBVIEW_TOKEN = Regex("(^|[\\s;(])wv([\\s;)]|$)")

/**
 * Removes the standalone `wv` (WebView) identifier from [userAgent],
 * collapsing leftover whitespace. Returns the cleaned string, which may be
 * blank when the input carried no other content.
 */
fun stripWebViewToken(userAgent: String): String =
    WEBVIEW_TOKEN.replace(userAgent) { match ->
        val prefix = match.groupValues[1]
        val suffix = match.groupValues[2]
        // Keep a single separating space only when joining two word sides
        // (e.g. "a wv b" -> "a b"); otherwise drop the token and one side.
        if (prefix.isNotBlank() && suffix.isNotBlank()) " " else prefix + suffix
    }.replace(Regex("\\s+"), " ").trim()

/**
 * Resolves the global WebView User-Agent override from the device
 * [defaultUserAgent] (`WebSettings.userAgentString`).
 *
 * Prefers the device string with the `wv` flag stripped (preserving the
 * device's real Chrome version); falls back to [TV_EMBED_USER_AGENT] when
 * the default is missing, blank, or still contaminated after stripping.
 * The result never contains the `wv` identifier. Applies to all requests,
 * including inner iframes.
 */
fun resolveTvUserAgent(defaultUserAgent: String?): String {
    if (defaultUserAgent.isNullOrBlank()) return TV_EMBED_USER_AGENT
    val stripped = stripWebViewToken(defaultUserAgent)
    if (stripped.isBlank() || WEBVIEW_TOKEN.containsMatchIn(stripped)) {
        return TV_EMBED_USER_AGENT
    }
    return stripped
}

/**
 * JavaScript snippet evaluated on the top-level document in `onPageFinished`.
 *
 * Programmatically simulates a user gesture (synthetic click / touch) on the
 * document root, which Android WebView cascades into nested iframes to unlock
 * autoplay for providers whose players otherwise stay black. Also nudges any
 * top-level `<video>` elements toward playback. Wrapped in try/catch at every
 * level: provider DOM differences are out of contract, so this is strictly
 * best-effort and must never throw.
 */
const val AUTOPLAY_UNLOCK_SCRIPT =
    "(function(){try{" +
        "var d=document;" +
        "try{" +
        "var ev;" +
        "try{ev=new MouseEvent('click',{bubbles:true,cancelable:true,view:window});}" +
        "catch(_){ev=d.createEvent('MouseEvents');ev.initEvent('click',true,true);}" +
        "d.documentElement.dispatchEvent(ev);" +
        "if(d.body){d.body.dispatchEvent(ev);}" +
        "}catch(_){}" +
        "try{" +
        "var touch;" +
        "try{touch=new TouchEvent('touchstart',{bubbles:true,cancelable:true,view:window});}" +
        "catch(_){touch=d.createEvent('TouchEvent');touch.initEvent('touchstart',true,true);}" +
        "d.documentElement.dispatchEvent(touch);" +
        "}catch(_){}" +
        "try{" +
        "var videos=d.querySelectorAll('video');" +
        "for(var i=0;i<videos.length;i++){" +
        "try{var v=videos[i];if(v.paused){var p=v.play();if(p&&p.catch){p.catch(function(){});}}}" +
        "catch(_){}" +
        "}" +
        "}catch(_){}" +
        "try{" +
        "if(typeof jwplayer !== 'undefined'){" +
        "jwplayer().play();" +
        "}" +
        "}catch(_){}" +
        "try{" +
        "var style=d.createElement('style');" +
        "style.innerHTML='.jw-player,.jwplayer{width:100% !important;height:100% !important;position:absolute !important;top:0 !important;left:0 !important;visibility:visible !important;opacity:1 !important;display:block !important;z-index:999999 !important;} .vjs-tech{position:absolute !important;top:0 !important;left:0 !important;visibility:visible !important;opacity:1 !important;display:block !important;z-index:999999 !important;}';" +
        "d.head.appendChild(style);" +
        "var divs=d.querySelectorAll('div');" +
        "for(var i=0;i<divs.length;i++){" +
        "if(divs[i].innerHTML.indexOf('Disable ADBlock')!==-1){" +
        "divs[i].style.display='none';" +
        "}" +
        "}" +
        "}catch(_){}" +
        "}catch(_){}})();"
