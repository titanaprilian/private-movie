package com.privatemovie.tv.modules.player

import com.privatemovie.tv.modules.player.internal.AUTOPLAY_UNLOCK_SCRIPT
import com.privatemovie.tv.modules.player.internal.TV_EMBED_USER_AGENT
import com.privatemovie.tv.modules.player.internal.resolveTvUserAgent
import com.privatemovie.tv.modules.player.internal.stripWebViewToken
import org.junit.Assert.assertFalse
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class EmbedWebViewConfigTest {

    private fun containsWvToken(ua: String): Boolean =
        Regex("(^|[\\s;(])wv([\\s;)]|$)").containsMatchIn(ua)

    @Test
    fun `pinned user agent is a standard chrome mobile string without wv flag`() {
        assertFalse(containsWvToken(TV_EMBED_USER_AGENT))
        assertTrue(TV_EMBED_USER_AGENT.contains("Chrome/"))
        assertTrue(TV_EMBED_USER_AGENT.contains("Mobile"))
        assertTrue(TV_EMBED_USER_AGENT.contains("Safari/"))
    }

    @Test
    fun `stripWebViewToken removes the wv identifier`() {
        val webViewUa =
            "Mozilla/5.0 (Linux; Android 11; K) AppleWebKit/537.36 " +
                "(KHTML, like Gecko) Version/4.0 Chrome/120.0.0.0 Mobile Safari/537.36 wv"
        val stripped = stripWebViewToken(webViewUa)
        assertFalse(containsWvToken(stripped))
        assertTrue(stripped.contains("Chrome/120.0.0.0"))
    }

    @Test
    fun `stripWebViewToken removes semicolon wv variant`() {
        val webViewUa =
            "Mozilla/5.0 (Linux; Android 10; K; wv) AppleWebKit/537.36 " +
                "(KHTML, like Gecko) Version/4.0 Chrome/120.0.0.0 Mobile Safari/537.36"
        assertFalse(containsWvToken(stripWebViewToken(webViewUa)))
    }

    @Test
    fun `resolveTvUserAgent de-webviews the default user agent`() {
        val webViewUa =
            "Mozilla/5.0 (Linux; Android 11; K) AppleWebKit/537.36 " +
                "(KHTML, like Gecko) Version/4.0 Chrome/120.0.0.0 Mobile Safari/537.36 wv"
        val resolved = resolveTvUserAgent(webViewUa)
        assertFalse(containsWvToken(resolved))
        assertTrue(resolved.contains("Chrome/"))
    }

    @Test
    fun `resolveTvUserAgent falls back to pinned agent when default is missing`() {
        assertEquals(TV_EMBED_USER_AGENT, resolveTvUserAgent(null))
        assertEquals(TV_EMBED_USER_AGENT, resolveTvUserAgent("   "))
    }

    @Test
    fun `resolveTvUserAgent falls back to pinned agent when wv cannot be stripped`() {
        // Degenerate UA consisting only of the flag: stripping leaves nothing
        // useful, so the pinned Chrome mobile string must win.
        assertEquals(TV_EMBED_USER_AGENT, resolveTvUserAgent("wv"))
    }

    @Test
    fun `autoplay unlock script simulates a user gesture on the top-level document`() {
        assertTrue(AUTOPLAY_UNLOCK_SCRIPT.isNotBlank())
        // Synthetic gesture dispatched at the document root cascades autoplay
        // permission into nested iframes under Android WebView policy.
        assertTrue(AUTOPLAY_UNLOCK_SCRIPT.contains("document"))
        val simulatesGesture = AUTOPLAY_UNLOCK_SCRIPT.contains("click") ||
            AUTOPLAY_UNLOCK_SCRIPT.contains("touchstart") ||
            AUTOPLAY_UNLOCK_SCRIPT.contains("MouseEvent") ||
            AUTOPLAY_UNLOCK_SCRIPT.contains("PointerEvent")
        assertTrue(simulatesGesture)
    }

    @Test
    fun `autoplay unlock script nudges top-level video elements without throwing`() {
        assertTrue(AUTOPLAY_UNLOCK_SCRIPT.contains("play("))
        assertTrue(AUTOPLAY_UNLOCK_SCRIPT.contains("try"))
    }
}
