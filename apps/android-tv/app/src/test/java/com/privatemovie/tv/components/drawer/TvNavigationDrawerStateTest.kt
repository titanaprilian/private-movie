package com.privatemovie.tv.components.drawer

import android.view.KeyEvent.KEYCODE_BACK
import android.view.KeyEvent.KEYCODE_DPAD_LEFT
import android.view.KeyEvent.KEYCODE_DPAD_RIGHT
import com.privatemovie.tv.dto.models.GenreItem
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class TvNavigationDrawerStateTest {

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

    // ---- State machine: collapse / expand ----

    @Test
    fun `drawer starts collapsed at 72dp`() {
        val state = NavigationDrawerState()
        assertFalse(state.expanded)
        assertEquals(TvDrawerDefaults.COLLAPSED_WIDTH_DP, state.drawerWidthDp)
        assertEquals(72, state.drawerWidthDp)
    }

    @Test
    fun `focus on a drawer item expands the drawer to 280dp`() {
        val state = NavigationDrawerState()
        state.onDrawerItemFocused()
        assertTrue(state.expanded)
        assertEquals(TvDrawerDefaults.EXPANDED_WIDTH_DP, state.drawerWidthDp)
        assertEquals(280, state.drawerWidthDp)
    }

    @Test
    fun `collapse returns the drawer to the 72dp rail`() {
        val state = NavigationDrawerState()
        state.onDrawerItemFocused()
        state.collapse()
        assertFalse(state.expanded)
        assertEquals(72, state.drawerWidthDp)
    }

    // ---- Key handling: D-pad Right / Back ----

    @Test
    fun `dpad right while expanded collapses and requests content focus`() {
        var focusReturned = false
        val state = NavigationDrawerState(onCollapseFocusContent = { focusReturned = true })
        state.onDrawerItemFocused()

        val action = state.handleKeyDown(KEYCODE_DPAD_RIGHT, isKeyDown = true)

        assertEquals(DrawerKeyAction.COLLAPSE_AND_FOCUS_CONTENT, action)
        assertFalse(state.expanded)
        assertTrue(focusReturned)
    }

    @Test
    fun `remote back while expanded collapses and requests content focus`() {
        var focusReturned = false
        val state = NavigationDrawerState(onCollapseFocusContent = { focusReturned = true })
        state.onDrawerItemFocused()

        val action = state.handleKeyDown(KEYCODE_BACK, isKeyDown = true)

        assertEquals(DrawerKeyAction.COLLAPSE_AND_FOCUS_CONTENT, action)
        assertFalse(state.expanded)
        assertTrue(focusReturned)
    }

    @Test
    fun `keys are ignored while collapsed`() {
        val state = NavigationDrawerState()
        assertNull(state.handleKeyDown(KEYCODE_DPAD_RIGHT, isKeyDown = true))
        assertNull(state.handleKeyDown(KEYCODE_BACK, isKeyDown = true))
        assertFalse(state.expanded)
    }

    @Test
    fun `key-up events and repeats are ignored`() {
        val state = NavigationDrawerState()
        state.onDrawerItemFocused()
        assertNull(state.handleKeyDown(KEYCODE_BACK, isKeyDown = false))
        assertNull(state.handleKeyDown(KEYCODE_BACK, isKeyDown = true, isRepeat = true))
        assertTrue(state.expanded)
    }

    @Test
    fun `unrelated keys are not consumed`() {
        val state = NavigationDrawerState()
        state.onDrawerItemFocused()
        assertNull(state.handleKeyDown(KEYCODE_DPAD_LEFT, isKeyDown = true))
        assertTrue(state.expanded)
    }

    // ---- Selection ----

    @Test
    fun `selecting a destination collapses the drawer and forwards the destination`() {
        var selected: DrawerDestination? = null
        val state = NavigationDrawerState(onSelectDestination = { selected = it })
        state.onDrawerItemFocused()

        state.selectDestination(DrawerDestination.Genre(slug = "k-drama", name = "Korean Drama"))

        assertFalse(state.expanded)
        assertEquals(DrawerDestination.Genre(slug = "k-drama", name = "Korean Drama"), selected)
    }

    // ---- Genre filtering and ordering ----

    @Test
    fun `only big genres are shown sorted by display order`() {
        val genres = listOf(
            genre("k-drama", "Korean Drama", displayOrder = 2),
            genre("small", "Small Genre", isBigGenre = false, displayOrder = 0),
            genre("animation", "Animation", displayOrder = 1),
            genre("c-drama", "Chinese Drama", displayOrder = 3),
        )

        val result = bigGenresSorted(genres)

        assertEquals(listOf("animation", "k-drama", "c-drama"), result.map { it.slug })
    }

    @Test
    fun `drawer lists search home then big genres in order`() {
        val destinations = drawerDestinations(
            listOf(genre("animation", "Animation"), genre("k-drama", "Korean Drama")),
        )

        assertEquals(
            listOf(
                DrawerDestination.Search,
                DrawerDestination.Home,
                DrawerDestination.Genre(slug = "animation", name = "Animation"),
                DrawerDestination.Genre(slug = "k-drama", name = "Korean Drama"),
            ),
            destinations,
        )
    }

    // ---- Active destination resolution ----

    @Test
    fun `active pill follows the current route`() {
        val genres = listOf(genre("animation", "Animation"), genre("k-drama", "Korean Drama"))

        assertEquals(DrawerDestination.Search, resolveActiveDestination("search", genres))
        assertEquals(DrawerDestination.Home, resolveActiveDestination("home", genres))
        assertEquals(
            DrawerDestination.Genre(slug = "k-drama", name = "Korean Drama"),
            resolveActiveDestination("genre/k-drama", genres),
        )
    }

    @Test
    fun `active pill is empty for detail player and unknown routes`() {
        val genres = listOf(genre("animation", "Animation"))

        assertNull(resolveActiveDestination("detail/series-1", genres))
        assertNull(resolveActiveDestination("player/episode-1", genres))
        assertNull(resolveActiveDestination("genre/unknown-slug", genres))
        assertNull(resolveActiveDestination(null, genres))
    }
}
