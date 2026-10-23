package com.privatemovie.tv.navigation

import com.privatemovie.tv.components.drawer.DrawerDestination
import com.privatemovie.tv.modules.home.internal.TvRecentlyAddedEpisode
import com.privatemovie.tv.modules.home.internal.TvRecentlyAddedSeason
import com.privatemovie.tv.modules.home.internal.TvRecentlyAddedSeries
import com.privatemovie.tv.modules.home.internal.TvRecentlyAddedVideoSource
import com.privatemovie.tv.modules.home.internal.buildRecentEpisodePlayerNavArgs
import com.privatemovie.tv.components.drawer.NavigationDrawerState
import com.privatemovie.tv.data.repository.MediaRepository
import com.privatemovie.tv.dto.models.HomeFeed
import com.privatemovie.tv.dto.models.SeriesDetails
import com.privatemovie.tv.modules.home.HomeViewModel
import com.privatemovie.tv.modules.home.internal.HomeDrawerReturnTarget
import com.privatemovie.tv.modules.player.PLAYER_NAV_ARGS_KEY
import com.privatemovie.tv.modules.player.PlaybackMetadataHandoff
import com.privatemovie.tv.modules.player.PlaybackSourceRef
import com.privatemovie.tv.modules.player.PlayerNavArgs
import com.privatemovie.tv.modules.player.PlaylistEpisodeItem
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.launch
import kotlinx.coroutines.test.UnconfinedTestDispatcher
import kotlinx.coroutines.test.runTest
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

    // ── recently added episodes direct playback ───────────────────────────────

    private fun makeRecentEpisode(withSource: Boolean = true): TvRecentlyAddedEpisode {
        return TvRecentlyAddedEpisode(
            id = "episode-886",
            title = "Enter the Demon",
            order = 12,
            thumbnailUrl = null,
            duration = 2535,
            rating = null,
            series = TvRecentlyAddedSeries(
                id = "series-42",
                title = "Demon Slayer",
                posterUrl = null,
                backdropUrl = null
            ),
            season = TvRecentlyAddedSeason(
                id = "season-1",
                title = "Season 1",
                seasonNumber = 1
            ),
            videoSources = if (withSource) {
                listOf(
                    TvRecentlyAddedVideoSource(
                        id = "source-1",
                        episodeId = "episode-886",
                        type = "embed",
                        url = "/embed/abc123",
                        label = "Embed",
                        quality = "1080p"
                    )
                )
            } else {
                emptyList()
            }
        )
    }

    @Test
    fun `selecting a recently added episode builds player nav args with source and metadata`() {
        val navArgs = buildRecentEpisodePlayerNavArgs(makeRecentEpisode())

        assertEquals("episode-886", navArgs.episodeId)
        assertEquals("embed", navArgs.source?.type)
        assertEquals("/embed/abc123", navArgs.source?.url)
        assertEquals("Demon Slayer", navArgs.metadata?.seriesTitle)
        assertEquals("Season 1", navArgs.metadata?.seasonTitle)
        assertEquals(1, navArgs.metadata?.seasonNumber)
        assertEquals(12, navArgs.metadata?.episodeOrder)
        assertEquals("Enter the Demon", navArgs.metadata?.episodeTitle)
    }

    @Test
    fun `recently added episode navigation targets the player route directly`() {
        val navArgs = buildRecentEpisodePlayerNavArgs(makeRecentEpisode())

        assertEquals("player/episode-886", TvScreen.Player.createRoute(navArgs.episodeId))
    }

    @Test
    fun `recently added episode without sources builds player nav args without a source`() {
        val navArgs = buildRecentEpisodePlayerNavArgs(makeRecentEpisode(withSource = false))

        assertEquals("episode-886", navArgs.episodeId)
        assertNull(navArgs.source)
        assertEquals("Demon Slayer", navArgs.metadata?.seriesTitle)
    }

    // ---- Drawer collapse + content focus handoff ----

    @Test
    fun `browsing routes map to their content focus target`() {
        assertEquals(BrowsingContentTarget.HOME_HERO, browsingContentTargetForRoute(TvScreen.Home.route))
        assertEquals(BrowsingContentTarget.SEARCH_FIELD, browsingContentTargetForRoute(TvScreen.Search.route))
        assertEquals(BrowsingContentTarget.GENRE_HEADER, browsingContentTargetForRoute(TvScreen.Genre.route))
        assertEquals(
            BrowsingContentTarget.GENRE_HEADER,
            browsingContentTargetForRoute(TvScreen.Genre.createRoute("animation"))
        )
    }

    @Test
    fun `routes without drawer content have no focus target`() {
        assertNull(browsingContentTargetForRoute(TvScreen.Detail.createRoute("series-42")))
        assertNull(browsingContentTargetForRoute(TvScreen.Player.createRoute("episode-108")))
        assertNull(browsingContentTargetForRoute(null))
        assertNull(browsingContentTargetForRoute("unknown"))
    }

    @Test
    fun `drawer destinations map to the focus target of the screen they open`() {
        assertEquals(
            BrowsingContentTarget.SEARCH_FIELD,
            browsingContentTargetForDestination(DrawerDestination.Search)
        )
        assertEquals(
            BrowsingContentTarget.HOME_HERO,
            browsingContentTargetForDestination(DrawerDestination.Home)
        )
        assertEquals(
            BrowsingContentTarget.GENRE_HEADER,
            browsingContentTargetForDestination(DrawerDestination.Genre(slug = "k-drama", name = "Korean Drama"))
        )
    }

    @Test
    fun `selecting a drawer destination collapses the drawer and navigates`() {
        val drawerState = NavigationDrawerState()
        var navigated: DrawerDestination? = null
        val coordinator = DrawerNavigationCoordinator(
            drawerState = drawerState,
            onNavigate = { navigated = it },
            onFocusContent = {},
        )
        drawerState.onDrawerItemFocused()

        coordinator.selectDestination(DrawerDestination.Search)

        assertFalse(drawerState.expanded)
        assertEquals(72, drawerState.drawerWidthDp)
        assertEquals(DrawerDestination.Search, navigated)
    }

    @Test
    fun `selecting a drawer destination never leaves the drawer expanded`() {
        val drawerState = NavigationDrawerState()
        val coordinator = DrawerNavigationCoordinator(
            drawerState = drawerState,
            onNavigate = {},
            onFocusContent = {},
        )

        drawerState.onDrawerItemFocused()
        coordinator.selectDestination(DrawerDestination.Genre(slug = "animation", name = "Animation"))
        assertFalse(drawerState.expanded)

        drawerState.onDrawerItemFocused()
        coordinator.selectDestination(DrawerDestination.Home)
        assertFalse(drawerState.expanded)
        assertEquals(72, drawerState.drawerWidthDp)
    }

    @Test
    fun `collapsing the drawer hands focus back to the page content`() {
        val drawerState = NavigationDrawerState()
        var focusReturned = false
        val coordinator = DrawerNavigationCoordinator(
            drawerState = drawerState,
            onNavigate = {},
            onFocusContent = { focusReturned = true },
        )
        drawerState.onDrawerItemFocused()

        coordinator.collapseAndFocusContent()

        assertFalse(drawerState.expanded)
        assertTrue(focusReturned)
    }

    // ── drawer BackHandler & route focus coordination ────────────────────────

    @Test
    fun `pressing remote back when drawer is expanded collapses drawer and returns focus without triggering destination back navigation`() {
        val drawerState = NavigationDrawerState()
        var focusReturned = false
        var destinationBackTriggered = false
        val coordinator = DrawerNavigationCoordinator(
            drawerState = drawerState,
            onNavigate = {},
            onFocusContent = { focusReturned = true },
        )
        drawerState.onDrawerItemFocused() // expand drawer

        val consumed = coordinator.handleBack(onFallbackBack = { destinationBackTriggered = true })

        assertTrue(consumed)
        assertFalse(drawerState.expanded)
        assertTrue(focusReturned)
        assertFalse(destinationBackTriggered)
    }

    @Test
    fun `pressing remote back when drawer is collapsed does not intercept and triggers destination back navigation`() {
        val drawerState = NavigationDrawerState()
        var focusReturned = false
        var destinationBackTriggered = false
        val coordinator = DrawerNavigationCoordinator(
            drawerState = drawerState,
            onNavigate = {},
            onFocusContent = { focusReturned = true },
        )
        assertFalse(drawerState.expanded)

        val consumed = coordinator.handleBack(onFallbackBack = { destinationBackTriggered = true })

        assertFalse(consumed)
        assertFalse(drawerState.expanded)
        assertFalse(focusReturned)
        assertTrue(destinationBackTriggered)
    }

    @Test
    fun `collapsing the drawer while on HomeScreen activates origin return focus flow`() {
        val drawerState = NavigationDrawerState()
        var homeOriginFocusRestored = false
        var fallbackFocusContentCalled = false
        val coordinator = DrawerNavigationCoordinator(
            drawerState = drawerState,
            onNavigate = {},
            onFocusContent = { fallbackFocusContentCalled = true },
            onRestoreHomeFocus = {
                homeOriginFocusRestored = true
                true
            },
            currentRoute = { TvScreen.Home.route },
        )
        drawerState.onDrawerItemFocused()

        coordinator.collapseAndFocusContent()

        assertFalse(drawerState.expanded)
        assertTrue(homeOriginFocusRestored)
        assertFalse(fallbackFocusContentCalled)
    }

    @Test
    fun `collapsing the drawer while on HomeScreen without origin return target falls back to page content focus`() {
        val drawerState = NavigationDrawerState()
        var homeOriginFocusChecked = false
        var fallbackFocusContentCalled = false
        val coordinator = DrawerNavigationCoordinator(
            drawerState = drawerState,
            onNavigate = {},
            onFocusContent = { fallbackFocusContentCalled = true },
            onRestoreHomeFocus = {
                homeOriginFocusChecked = true
                false // no pending target to restore
            },
            currentRoute = { TvScreen.Home.route },
        )
        drawerState.onDrawerItemFocused()

        coordinator.collapseAndFocusContent()

        assertFalse(drawerState.expanded)
        assertTrue(homeOriginFocusChecked)
        assertTrue(fallbackFocusContentCalled)
    }

    @Test
    fun `collapsing the drawer on search screen hands focus back to search content without invoking home return focus`() {
        val drawerState = NavigationDrawerState()
        var homeOriginFocusChecked = false
        var searchFocusReturned = false
        val coordinator = DrawerNavigationCoordinator(
            drawerState = drawerState,
            onNavigate = {},
            onFocusContent = { searchFocusReturned = true },
            onRestoreHomeFocus = {
                homeOriginFocusChecked = true
                true
            },
            currentRoute = { TvScreen.Search.route },
        )
        drawerState.onDrawerItemFocused()

        coordinator.collapseAndFocusContent()

        assertFalse(drawerState.expanded)
        assertFalse(homeOriginFocusChecked)
        assertTrue(searchFocusReturned)
    }

    @Test
    fun `collapsing the drawer on genre screen hands focus back to genre content without invoking home return focus`() {
        val drawerState = NavigationDrawerState()
        var homeOriginFocusChecked = false
        var genreFocusReturned = false
        val coordinator = DrawerNavigationCoordinator(
            drawerState = drawerState,
            onNavigate = {},
            onFocusContent = { genreFocusReturned = true },
            onRestoreHomeFocus = {
                homeOriginFocusChecked = true
                true
            },
            currentRoute = { "genre/animation" },
        )
        drawerState.onDrawerItemFocused()

        coordinator.collapseAndFocusContent()

        assertFalse(drawerState.expanded)
        assertFalse(homeOriginFocusChecked)
        assertTrue(genreFocusReturned)
    }

    @OptIn(ExperimentalCoroutinesApi::class)
    @Test
    fun `collapsing the drawer while on HomeScreen with recorded origin activates HomeViewModel return focus flow`() = runTest {
        val repo = object : MediaRepository {
            override suspend fun getHomeFeed() = Result.success(
                HomeFeed(rows = emptyList(), hero = null, heroes = emptyList())
            )
            override suspend fun getSeriesById(id: String) = Result.failure<SeriesDetails>(NotImplementedError())
        }
        val homeViewModel = HomeViewModel(mediaRepository = repo, coroutineScope = this)
        homeViewModel.recordDrawerOrigin(HomeDrawerReturnTarget.Row(1))

        val drawerState = NavigationDrawerState()
        var triggerEmitted = false
        val job = launch(UnconfinedTestDispatcher(testScheduler)) {
            homeViewModel.drawerReturnTrigger.collect {
                triggerEmitted = true
            }
        }

        val coordinator = DrawerNavigationCoordinator(
            drawerState = drawerState,
            onNavigate = {},
            onFocusContent = {},
            onRestoreHomeFocus = {
                if (homeViewModel.drawerReturnTarget.value != null) {
                    homeViewModel.restoreDrawerReturnFocus()
                } else {
                    false
                }
            },
            currentRoute = { TvScreen.Home.route },
        )
        drawerState.onDrawerItemFocused()

        coordinator.collapseAndFocusContent()

        assertFalse(drawerState.expanded)
        assertTrue(triggerEmitted)
        assertEquals(HomeDrawerReturnTarget.Row(1), homeViewModel.drawerReturnTarget.value)
        job.cancel()
    }

    @OptIn(ExperimentalCoroutinesApi::class)
    @Test
    fun `pressing remote back while on HomeScreen with recorded origin activates HomeViewModel return focus flow`() = runTest {
        val repo = object : MediaRepository {
            override suspend fun getHomeFeed() = Result.success(
                HomeFeed(rows = emptyList(), hero = null, heroes = emptyList())
            )
            override suspend fun getSeriesById(id: String) = Result.failure<SeriesDetails>(NotImplementedError())
        }
        val homeViewModel = HomeViewModel(mediaRepository = repo, coroutineScope = this)
        homeViewModel.recordDrawerOrigin(HomeDrawerReturnTarget.RecentlyAddedEpisodes)

        val drawerState = NavigationDrawerState()
        var triggerEmitted = false
        var destinationBackTriggered = false
        val job = launch(UnconfinedTestDispatcher(testScheduler)) {
            homeViewModel.drawerReturnTrigger.collect {
                triggerEmitted = true
            }
        }

        val coordinator = DrawerNavigationCoordinator(
            drawerState = drawerState,
            onNavigate = {},
            onFocusContent = {},
            onRestoreHomeFocus = {
                if (homeViewModel.drawerReturnTarget.value != null) {
                    homeViewModel.restoreDrawerReturnFocus()
                } else {
                    false
                }
            },
            currentRoute = { TvScreen.Home.route },
        )
        drawerState.onDrawerItemFocused()

        val handled = coordinator.handleBack(onFallbackBack = { destinationBackTriggered = true })

        assertTrue(handled)
        assertFalse(drawerState.expanded)
        assertTrue(triggerEmitted)
        assertFalse(destinationBackTriggered)
        job.cancel()
    }
}
