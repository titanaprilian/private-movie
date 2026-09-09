package com.privatemovie.tv.modules.player

import com.privatemovie.tv.modules.player.internal.EpisodePlaybackDecision
import com.privatemovie.tv.modules.player.internal.PLAYER_EPISODE_ORDER_KEY
import com.privatemovie.tv.modules.player.internal.PLAYER_EPISODE_TITLE_KEY
import com.privatemovie.tv.modules.player.internal.PLAYER_SEASON_NUMBER_KEY
import com.privatemovie.tv.modules.player.internal.PLAYER_SEASON_TITLE_KEY
import com.privatemovie.tv.modules.player.internal.PLAYER_SERIES_TITLE_KEY
import com.privatemovie.tv.modules.player.internal.PLAYER_SOURCE_TYPE_KEY
import com.privatemovie.tv.modules.player.internal.PLAYER_SOURCE_URL_KEY
import com.privatemovie.tv.modules.player.internal.PlaybackRenderer
import com.privatemovie.tv.modules.player.internal.PlaybackSourceRef
import com.privatemovie.tv.modules.player.internal.buildPlayerHandoff
import com.privatemovie.tv.modules.player.internal.decideEpisodePlayback
import com.privatemovie.tv.modules.player.internal.formatPlayerHeadline
import com.privatemovie.tv.modules.player.internal.formatPlayerSubtitle
import com.privatemovie.tv.modules.player.internal.resolvePlayerHandoff
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * End-to-end verification for the Android TV MVP path:
 * Home -> Watch/Detail -> Player against the real backend contract.
 *
 * Covers the source-picker handoff for normalized playback targets
 * (direct vs embed, absolute vs backend-relative) and clear failure
 * handling for unavailable or unsupported sources.
 */
class WatchToPlayerFlowTest {

    @Test
    fun `episode with no sources is unavailable and never navigates to player`() {
        assertEquals(
            EpisodePlaybackDecision.Unavailable,
            decideEpisodePlayback(sourceCount = 0)
        )
    }

    @Test
    fun `episode with a single source plays directly without a picker`() {
        assertEquals(
            EpisodePlaybackDecision.PlaySingle,
            decideEpisodePlayback(sourceCount = 1)
        )
    }

    @Test
    fun `episode with multiple sources requires the source picker`() {
        assertEquals(
            EpisodePlaybackDecision.NeedsSourcePicker,
            decideEpisodePlayback(sourceCount = 2)
        )
        assertEquals(
            EpisodePlaybackDecision.NeedsSourcePicker,
            decideEpisodePlayback(sourceCount = 5)
        )
    }

    @Test
    fun `handoff carries the normalized source type and url to the player`() {
        val handoff = buildPlayerHandoff(
            episodeId = "ep-1",
            source = PlaybackSourceRef(type = "direct", url = "https://cdn.example.com/stream/ep1.m3u8")
        )

        assertEquals("ep-1", handoff.episodeId)
        assertEquals("direct", handoff.sourceTypeName)
        assertEquals("https://cdn.example.com/stream/ep1.m3u8", handoff.sourceUrl)
    }

    @Test
    fun `handoff without a source leaves player args empty for failure handling`() {
        val handoff = buildPlayerHandoff(episodeId = "ep-empty", source = null)

        assertEquals("ep-empty", handoff.episodeId)
        assertNull(handoff.sourceTypeName)
        assertNull(handoff.sourceUrl)
    }

    @Test
    fun `handoff uses stable saved-state keys shared with navigation`() {
        assertEquals("playbackSourceType", PLAYER_SOURCE_TYPE_KEY)
        assertEquals("playbackUrl", PLAYER_SOURCE_URL_KEY)
    }

    @Test
    fun `direct absolute target resolves to native playback`() {
        val resolved = resolvePlayerHandoff(
            handoff = buildPlayerHandoff(
                episodeId = "ep-1",
                source = PlaybackSourceRef(type = "direct", url = "https://cdn.example.com/stream/ep1.m3u8")
            ),
            backendBaseUrl = "http://10.0.2.2:3000"
        )

        assertEquals(PlaybackRenderer.NATIVE, resolved.renderer)
        assertEquals("https://cdn.example.com/stream/ep1.m3u8", resolved.resolvedUrl)
        assertNull(resolved.failureMessage)
        assertTrue(resolved.isPlayable)
    }

    @Test
    fun `s3 target resolves to native playback`() {
        val resolved = resolvePlayerHandoff(
            handoff = buildPlayerHandoff(
                episodeId = "ep-1",
                source = PlaybackSourceRef(type = "s3", url = "https://s3.example.com/stream/ep1.mp4")
            ),
            backendBaseUrl = "http://10.0.2.2:3000"
        )

        assertEquals(PlaybackRenderer.NATIVE, resolved.renderer)
        assertEquals("https://s3.example.com/stream/ep1.mp4", resolved.resolvedUrl)
        assertNull(resolved.failureMessage)
        assertTrue(resolved.isPlayable)
    }

    @Test
    fun `missing source produces a clear playback failure instead of a renderer`() {
        val resolved = resolvePlayerHandoff(
            handoff = buildPlayerHandoff(episodeId = "ep-empty", source = null),
            backendBaseUrl = "http://10.0.2.2:3000"
        )

        assertNull(resolved.resolvedUrl)
        assertEquals("No playable source for this episode", resolved.failureMessage)
    }

    @Test
    fun `blank url produces a clear playback failure`() {
        val resolved = resolvePlayerHandoff(
            handoff = buildPlayerHandoff(
                episodeId = "ep-1",
                source = PlaybackSourceRef(type = "embed", url = "   ")
            ),
            backendBaseUrl = "http://10.0.2.2:3000"
        )

        assertNull(resolved.resolvedUrl)
        assertEquals("No playable source for this episode", resolved.failureMessage)
    }

    @Test
    fun `unknown source type resolves to native renderer`() {
        val resolved = resolvePlayerHandoff(
            handoff = buildPlayerHandoff(
                episodeId = "ep-1",
                source = PlaybackSourceRef(type = "hls-legacy", url = "https://cdn.example.com/stream.m3u8")
            ),
            backendBaseUrl = "http://10.0.2.2:3000"
        )

        assertEquals(PlaybackRenderer.NATIVE, resolved.renderer)
        assertEquals("https://cdn.example.com/stream.m3u8", resolved.resolvedUrl)
        assertTrue(resolved.isPlayable)
    }

    @Test
    fun `headline formats series title or defaults gracefully`() {
        assertEquals("Demon Slayer", formatPlayerHeadline("Demon Slayer"))
        assertEquals("Private Movie", formatPlayerHeadline(null))
        assertEquals("Private Movie", formatPlayerHeadline("  "))
    }

    @Test
    fun `subtitle formats season and episode metadata cleanly`() {
        assertEquals(
            "Season 1 • Episode 1 — Cruelty",
            formatPlayerSubtitle(
                seasonNumber = 1,
                seasonTitle = "Season 1",
                episodeOrder = 1,
                episodeTitle = "Cruelty"
            )
        )
        assertEquals(
            "Episode 1 — Cruelty",
            formatPlayerSubtitle(
                seasonNumber = null,
                seasonTitle = null,
                episodeOrder = 1,
                episodeTitle = "Cruelty"
            )
        )
        assertEquals(
            "Episode 2",
            formatPlayerSubtitle(
                seasonNumber = null,
                seasonTitle = null,
                episodeOrder = 2,
                episodeTitle = null
            )
        )
        assertEquals(
            "",
            formatPlayerSubtitle(
                seasonNumber = null,
                seasonTitle = null,
                episodeOrder = null,
                episodeTitle = null
            )
        )
    }
}
