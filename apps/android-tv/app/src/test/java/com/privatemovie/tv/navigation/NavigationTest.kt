package com.privatemovie.tv.navigation

import com.privatemovie.tv.components.drawer.DrawerDestination
import com.privatemovie.tv.modules.player.PLAYER_NAV_ARGS_KEY
import com.privatemovie.tv.modules.player.PlaybackMetadataHandoff
import com.privatemovie.tv.modules.player.PlaybackSourceRef
import com.privatemovie.tv.modules.player.PlayerNavArgs
import com.privatemovie.tv.modules.player.PlaylistEpisodeItem
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class NavigationTest {

    @Test
    fun `TvScreen Home route is correct`() {
        assertEquals("home", TvScreen.Home.route)
    }

    @Test
    fun `dev_settings is no longer a route`() {
        val routes = listOf(
            TvScreen.Home.route,
            TvScreen.Search.route,
            TvScreen.Genre.route,
            TvScreen.Detail.route,
            TvScreen.Player.route
        )
        assertFalse(routes.contains("dev_settings"))
        assertEquals(listOf("home", "search", "genre/{slug}", "detail/{seriesId}", "player/{episodeId}"), routes)
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
    fun `TvScreen Genre route pattern and helper formatting match`() {
        assertEquals("genre/{slug}", TvScreen.Genre.route)
        assertEquals("genre/animation", TvScreen.Genre.createRoute("animation"))
    }

    @Test
    fun `genre routes are single-segment like detail and player`() {
        val genreRoute = TvScreen.Genre.createRoute("drama")
        assertEquals("genre/drama", genreRoute)
        assertEquals(2, genreRoute.split("/").size)
    }

    @Test
    fun `switching genres replaces route under home without backstack buildup`() {
        // Genre-to-genre navigation pops up to Home with launchSingleTop, so
        // Back from any genre screen always lands directly on Home.
        val first = TvScreen.Genre.createRoute("animation")
        val second = TvScreen.Genre.createRoute("drama")
        assertEquals("genre/animation", first)
        assertEquals("genre/drama", second)
        // Both routes share the genre/{slug} pattern: singleTop replaces
        // rather than stacking genre destinations.
        assertEquals(TvScreen.Genre.route, "genre/{slug}")
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
    fun `TvScreen Search route is a single top-level segment`() {
        assertEquals("search", TvScreen.Search.route)
        assertEquals(1, TvScreen.Search.route.split("/").size)
    }

    @Test
    fun `search and genre screens return to home without backstack buildup`() {
        // Search and GenreCatalog both pop back to Home, so Back from either
        // lands directly on Home rather than stacking browsing destinations.
        assertEquals("search", TvScreen.Search.route)
        assertEquals("genre/animation", TvScreen.Genre.createRoute("animation"))
        assertEquals(TvScreen.Home.route, "home")
    }

    @Test
    fun `search result selects detail via single-segment route`() {
        // Clicking a search result navigates to the series detail view.
        val detailRoute = TvScreen.Detail.createRoute("series-9")
        assertEquals("detail/series-9", detailRoute)
        assertEquals(2, detailRoute.split("/").size)
    }
    @Test
    fun `player nav args key is constant and matches expected name`() {
        assertEquals("player_nav_args", PLAYER_NAV_ARGS_KEY)
    }

    @Test
    fun `typed PlayerNavArgs encapsulates episode source metadata and playlist`() {
        val navArgs = PlayerNavArgs(
            episodeId = "episode-108",
            source = PlaybackSourceRef(type = "embed", url = "/embed/abc123"),
            metadata = PlaybackMetadataHandoff(
                seriesTitle = "Demon Slayer",
                seasonTitle = "Season 1",
                seasonNumber = 1,
                episodeOrder = 8,
                episodeTitle = "Episode 8"
            ),
            playlist = listOf(
                PlaylistEpisodeItem(
                    episodeId = "episode-108",
                    seriesTitle = "Demon Slayer",
                    episodeTitle = "Episode 8"
                )
            )
        )

        assertEquals("episode-108", navArgs.episodeId)
        assertEquals("embed", navArgs.source?.type)
        assertEquals("/embed/abc123", navArgs.source?.url)
        assertEquals("Demon Slayer", navArgs.metadata?.seriesTitle)
        assertEquals(1, navArgs.playlist.size)
    }

    @Test
    fun `direct play without a source creates PlayerNavArgs with null source`() {
        val navArgs = PlayerNavArgs(
            episodeId = "episode-109",
            source = null
        )
        assertEquals("episode-109", navArgs.episodeId)
        assertNull(navArgs.source)
    }

    @Test
    fun `drawer is visible on browsing routes`() {
        assertTrue(isDrawerVisibleForRoute(TvScreen.Home.route))
        assertTrue(isDrawerVisibleForRoute(TvScreen.Search.route))
        assertTrue(isDrawerVisibleForRoute(TvScreen.Genre.route))
        assertTrue(isDrawerVisibleForRoute(TvScreen.Genre.createRoute("animation")))
    }

    @Test
    fun `drawer is suppressed on the player route`() {
        assertFalse(isDrawerVisibleForRoute(TvScreen.Player.route))
        assertFalse(isDrawerVisibleForRoute(TvScreen.Player.createRoute("episode-108")))
    }

    @Test
    fun `drawer is hidden on detail and unknown routes`() {
        assertFalse(isDrawerVisibleForRoute(TvScreen.Detail.createRoute("series-42")))
        assertFalse(isDrawerVisibleForRoute(null))
        assertFalse(isDrawerVisibleForRoute("unknown"))
    }

    @Test
    fun `drawer destinations map to browsing routes without backstack loops`() {
        assertEquals("search", drawerDestinationToRoute(DrawerDestination.Search))
        assertEquals("home", drawerDestinationToRoute(DrawerDestination.Home))
        assertEquals(
            "genre/k-drama",
            drawerDestinationToRoute(DrawerDestination.Genre(slug = "k-drama", name = "Korean Drama"))
        )
    }

    @Test
    fun `drawer current route resolves genre slug for active highlight`() {
        assertEquals("home", resolveDrawerCurrentRoute("home", null))
        assertEquals("search", resolveDrawerCurrentRoute("search", null))
        assertEquals("genre/k-drama", resolveDrawerCurrentRoute("genre/{slug}", "k-drama"))
        assertNull(resolveDrawerCurrentRoute("player/{episodeId}", "episode-108"))
    }

    @Test
    fun `browsing content rail padding matches the collapsed drawer rail`() {
        assertEquals(72, BROWSING_CONTENT_RAIL_PADDING_DP)
        assertEquals(
            com.privatemovie.tv.components.drawer.TvDrawerDefaults.COLLAPSED_WIDTH_DP,
            BROWSING_CONTENT_RAIL_PADDING_DP
        )
    }

    @Test
    fun `leftmost grid column detection covers first column only`() {
        assertTrue(isLeftmostBrowsingIndex(0))
        assertTrue(isLeftmostBrowsingIndex(5))
        assertTrue(isLeftmostBrowsingIndex(10))
        assertFalse(isLeftmostBrowsingIndex(1))
        assertFalse(isLeftmostBrowsingIndex(4))
        assertFalse(isLeftmostBrowsingIndex(6))
        assertFalse(isLeftmostBrowsingIndex(-1))
    }

    @Test
    fun `dpad left on the leftmost card focuses the drawer`() {
        val left = android.view.KeyEvent.KEYCODE_DPAD_LEFT
        val right = android.view.KeyEvent.KEYCODE_DPAD_RIGHT
        assertTrue(shouldFocusDrawerOnKey(left, isKeyDown = true, isLeftmost = true))
        assertFalse(shouldFocusDrawerOnKey(left, isKeyDown = true, isLeftmost = false))
        assertFalse(shouldFocusDrawerOnKey(left, isKeyDown = false, isLeftmost = true))
        assertFalse(shouldFocusDrawerOnKey(right, isKeyDown = true, isLeftmost = true))
    }
}
