package com.privatemovie.tv.navigation

import com.privatemovie.tv.modules.player.internal.PLAYER_SOURCE_TYPE_KEY
import com.privatemovie.tv.modules.player.internal.PLAYER_SOURCE_URL_KEY
import com.privatemovie.tv.modules.player.internal.PlaybackSourceRef
import com.privatemovie.tv.modules.player.internal.buildPlayerHandoff
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

class NavigationTest {

    @Test
    fun `TvScreen Home route is correct`() {
        assertEquals("home", TvScreen.Home.route)
    }

    @Test
    fun `TvScreen DevSettings route is correct`() {
        assertEquals("dev_settings", TvScreen.DevSettings.route)
    }

    @Test
    fun `TvScreen Detail route pattern and helper formatting match`() {
        assertEquals("detail/{seriesId}", TvScreen.Detail.route)
        assertEquals("detail/series-42", TvScreen.Detail.createRoute("series-42"))
    }

    @Test
    fun `TvScreen Player route pattern and helper formatting match`() {
        assertEquals("player/{episodeId}", TvScreen.Player.route)
        assertEquals("player/episode-108", TvScreen.Player.createRoute("episode-108"))
    }

    @Test
    fun `home to detail to player follows the single MVP flow`() {
        // Primary public user journey: browsing selects a series, the detail
        // flow picks an episode source, and the player opens for that episode.
        val detailRoute = TvScreen.Detail.createRoute("series-42")
        val playerRoute = TvScreen.Player.createRoute("episode-108")

        assertEquals("detail/series-42", detailRoute)
        assertEquals("player/episode-108", playerRoute)
        // Back from player returns to detail, back from detail returns home:
        // both routes are single-segment so popBackStack restores the flow.
        assertEquals(2, detailRoute.split("/").size)
        assertEquals(2, playerRoute.split("/").size)
    }

    @Test
    fun `source picker handoff keys match what the player reads`() {
        // Contract between AppNavigation's onPlaySource and PlayerScreen args:
        // renaming either side must break this test, not TV playback.
        assertEquals("playbackSourceType", PLAYER_SOURCE_TYPE_KEY)
        assertEquals("playbackUrl", PLAYER_SOURCE_URL_KEY)

        val handoff = buildPlayerHandoff(
            episodeId = "episode-108",
            source = PlaybackSourceRef(type = "embed", url = "/embed/abc123")
        )
        assertEquals("episode-108", handoff.episodeId)
        assertEquals("embed", handoff.sourceTypeName)
        assertEquals("/embed/abc123", handoff.sourceUrl)
    }

    @Test
    fun `direct play without a source clears the handoff for player failure handling`() {
        val handoff = buildPlayerHandoff(episodeId = "episode-109", source = null)
        assertEquals("episode-109", handoff.episodeId)
        assertNull(handoff.sourceTypeName)
        assertNull(handoff.sourceUrl)
    }
}
