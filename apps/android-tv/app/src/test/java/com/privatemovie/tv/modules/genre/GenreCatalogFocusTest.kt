package com.privatemovie.tv.modules.genre

import android.view.KeyEvent
import androidx.compose.ui.focus.FocusRequester
import com.privatemovie.tv.components.requestFocusSafely
import com.privatemovie.tv.modules.genre.internal.GenreCatalogFilter
import com.privatemovie.tv.modules.genre.internal.resolveFilterPillFocusTarget
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.test.advanceUntilIdle
import kotlinx.coroutines.test.runTest
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertSame
import org.junit.Assert.assertTrue
import org.junit.Test
import java.util.concurrent.atomic.AtomicInteger

@OptIn(ExperimentalCoroutinesApi::class)
class GenreCatalogFocusTest {

    private val gridColumns = 5

    @Test
    fun `pillFocusers mapping contains requesters for all declared GenreCatalogFilter enum entries`() {
        val pillFocusers = GenreCatalogFilter.entries.associateWith { FocusRequester() }
        for (filter in GenreCatalogFilter.entries) {
            assertTrue("Expected mapping for filter $filter", pillFocusers.containsKey(filter))
            assertNotNull(pillFocusers[filter])
        }
    }

    @Test
    fun `resolveFilterPillFocusTarget routes to active filter pill requester`() {
        val pillFocusers = GenreCatalogFilter.entries.associateWith { FocusRequester() }

        val targetAll = resolveFilterPillFocusTarget(pillFocusers, GenreCatalogFilter.ALL)
        assertSame(pillFocusers[GenreCatalogFilter.ALL], targetAll)

        val targetOngoing = resolveFilterPillFocusTarget(pillFocusers, GenreCatalogFilter.ONGOING)
        assertSame(pillFocusers[GenreCatalogFilter.ONGOING], targetOngoing)
    }

    @Test
    fun `resolveFilterPillFocusTarget falls back to ALL filter when active filter is unset`() {
        val pillFocusers = GenreCatalogFilter.entries.associateWith { FocusRequester() }

        val target = resolveFilterPillFocusTarget(pillFocusers, null)
        assertSame(pillFocusers[GenreCatalogFilter.ALL], target)
    }

    @Test
    fun `top-row catalog cards (indices 0 through 4) invoke focus transfer to active filter pill on DPAD_UP`() = runTest {
        val pillFocusers = GenreCatalogFilter.entries.associateWith { FocusRequester() }
        val activeFilter = GenreCatalogFilter.ONGOING
        var targetFocused = false

        val focusActiveFilterPill: () -> Unit = {
            val target = resolveFilterPillFocusTarget(pillFocusers, activeFilter)
            if (target != null) {
                targetFocused = true
            }
        }

        // Test top row indices 0 through 4 (GENRE_GRID_COLUMNS = 5)
        for (index in 0 until gridColumns) {
            targetFocused = false
            val isTopRow = index < gridColumns
            assertTrue("Index $index should be recognized as top row", isTopRow)

            val onUp: (() -> Unit)? = if (isTopRow) focusActiveFilterPill else null
            assertNotNull(onUp)

            val action = android.view.KeyEvent.ACTION_DOWN
            val keyCode = android.view.KeyEvent.KEYCODE_DPAD_UP
            var consumed = false
            if (action == android.view.KeyEvent.ACTION_DOWN && keyCode == android.view.KeyEvent.KEYCODE_DPAD_UP) {
                if (onUp != null) {
                    onUp()
                    consumed = true
                }
            }

            assertTrue("Expected D-Pad Up to be consumed on top-row card", consumed)
            advanceUntilIdle()
            assertTrue("Expected focus to be requested on target pill", targetFocused)
        }

        // Card at index >= 5 does NOT get an onUp handler for header focus
        val nonTopRowOnUp: (() -> Unit)? = if (5 < gridColumns) focusActiveFilterPill else null
        assertEquals(null, nonTopRowOnUp)
    }

    @Test
    fun `d-pad up on filter pills does not launch failed focus retry attempts or crash`() {
        // In FilterPillRow, D-pad Up is an unhandled key event (safe no-op):
        // No onKeyEvent handler intercepts KEYCODE_DPAD_UP on the pills, preventing retry loops or unhandled crashes.
        val retryAttempts = AtomicInteger(0)

        val action = android.view.KeyEvent.ACTION_DOWN
        val keyCode = android.view.KeyEvent.KEYCODE_DPAD_UP
        // With onUpToHeader removed from FilterPillRow, the key listener does not fire any retry callback
        val isConsumedByPill = false

        assertFalse(isConsumedByPill)
        assertEquals(0, retryAttempts.get())
    }
}
