package com.privatemovie.tv.components.drawer

import androidx.compose.ui.focus.FocusRequester
import com.privatemovie.tv.components.requestFocusSafely
import com.privatemovie.tv.dto.models.GenreItem
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.test.runTest
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

@OptIn(ExperimentalCoroutinesApi::class)
class TvNavigationDrawerFocusTest {

    private fun genre(
        slug: String,
        name: String = slug,
        isBigGenre: Boolean = true,
        displayOrder: Int = 0,
    ) = GenreItem(
        id = "id-$slug",
        name = name,
        slug = slug,
        isBigGenre = isBigGenre,
        displayOrder = displayOrder,
    )

    private val sampleBigGenres = listOf(
        genre("animation", "Animation", displayOrder = 1),
        genre("k-drama", "Korean Drama", displayOrder = 2),
        genre("action", "Action", displayOrder = 3),
    )

    // ── Destination resolution for drawer entry ────────────────────────────────

    @Test
    fun `resolveDrawerEntryDestination returns Home destination when current route is home`() {
        val destination = resolveDrawerEntryDestination("home", sampleBigGenres)
        assertEquals(DrawerDestination.Home, destination)
    }

    @Test
    fun `resolveDrawerEntryDestination returns Search destination when current route is search`() {
        val destination = resolveDrawerEntryDestination("search", sampleBigGenres)
        assertEquals(DrawerDestination.Search, destination)
    }

    @Test
    fun `resolveDrawerEntryDestination returns corresponding Genre destination when current route is a big genre`() {
        val destination = resolveDrawerEntryDestination("genre/k-drama", sampleBigGenres)
        assertEquals(DrawerDestination.Genre(slug = "k-drama", name = "Korean Drama"), destination)
    }

    @Test
    fun `resolveDrawerEntryDestination falls back to Search destination when current route is null`() {
        val destination = resolveDrawerEntryDestination(null, sampleBigGenres)
        assertEquals(DrawerDestination.Search, destination)
    }

    @Test
    fun `resolveDrawerEntryDestination falls back to Search destination when current route is detail or player`() {
        assertEquals(DrawerDestination.Search, resolveDrawerEntryDestination("detail/series-42", sampleBigGenres))
        assertEquals(DrawerDestination.Search, resolveDrawerEntryDestination("player/ep-101", sampleBigGenres))
    }

    @Test
    fun `resolveDrawerEntryDestination falls back to Search destination when genre is not a big genre`() {
        val destination = resolveDrawerEntryDestination("genre/unknown-indie", sampleBigGenres)
        assertEquals(DrawerDestination.Search, destination)
    }

    @Test
    fun `resolveDrawerEntryDestination with destination list falls back to Search when active is not present`() {
        val available = listOf(DrawerDestination.Search, DrawerDestination.Home)
        val foreignGenre = DrawerDestination.Genre(slug = "sci-fi", name = "Sci-Fi")

        val destination = resolveDrawerEntryDestination(foreignGenre, available)
        assertEquals(DrawerDestination.Search, destination)
    }

    @Test
    fun `resolveDrawerEntryDestination with destination list retains active destination when present`() {
        val available = listOf(DrawerDestination.Search, DrawerDestination.Home)

        val destination = resolveDrawerEntryDestination(DrawerDestination.Home, available)
        assertEquals(DrawerDestination.Home, destination)
    }

    // ── Safe focus acquisition on drawer entry ─────────────────────────────────

    @Test
    fun `navigating into drawer with active route focus requester acquires focus cleanly and expands drawer`() = runTest {
        val drawerState = NavigationDrawerState()
        val currentRoute = "home"
        val entryDestination = resolveDrawerEntryDestination(currentRoute, sampleBigGenres)
        assertEquals(DrawerDestination.Home, entryDestination)

        val focusRequester = FocusRequester()
        var rawAttempts = 0

        val focusSucceeded = requestFocusSafely(
            focusRequester = focusRequester,
            maxRetries = 5,
            rawRequest = {
                rawAttempts++
                // Attaching directly to focusable row succeeds immediately without retries
                true
            }
        )

        // When row acquires focus, onFocused callback expands the drawer
        if (focusSucceeded) {
            drawerState.onDrawerItemFocused()
        }

        assertTrue(focusSucceeded)
        assertEquals(1, rawAttempts)
        assertTrue(drawerState.expanded)
        assertEquals(TvDrawerDefaults.EXPANDED_WIDTH_DP, drawerState.drawerWidthDp)
    }

    @Test
    fun `navigating into drawer with unmatching route targets Search destination and expands drawer`() = runTest {
        val drawerState = NavigationDrawerState()
        val currentRoute = "detail/series-99"
        val entryDestination = resolveDrawerEntryDestination(currentRoute, sampleBigGenres)
        assertEquals(DrawerDestination.Search, entryDestination)

        val focusRequester = FocusRequester()
        var rawAttempts = 0

        val focusSucceeded = requestFocusSafely(
            focusRequester = focusRequester,
            maxRetries = 5,
            rawRequest = {
                rawAttempts++
                true
            }
        )

        if (focusSucceeded) {
            drawerState.onDrawerItemFocused()
        }

        assertTrue(focusSucceeded)
        assertEquals(1, rawAttempts)
        assertTrue(drawerState.expanded)
        assertEquals(TvDrawerDefaults.EXPANDED_WIDTH_DP, drawerState.drawerWidthDp)
    }

    @Test
    fun `navigating into drawer handles frame delay before node attaches without exhausting retries`() = runTest {
        val drawerState = NavigationDrawerState()
        val focusRequester = FocusRequester()
        var rawAttempts = 0

        val focusSucceeded = requestFocusSafely(
            focusRequester = focusRequester,
            maxRetries = 5,
            rawRequest = {
                rawAttempts++
                // Node attaches on the second frame attempt
                if (rawAttempts < 2) {
                    throw IllegalStateException("FocusRequester is not initialized")
                }
                true
            }
        )

        if (focusSucceeded) {
            drawerState.onDrawerItemFocused()
        }

        assertTrue(focusSucceeded)
        assertEquals(2, rawAttempts)
        assertTrue(drawerState.expanded)
        assertEquals(TvDrawerDefaults.EXPANDED_WIDTH_DP, drawerState.drawerWidthDp)
    }
}
