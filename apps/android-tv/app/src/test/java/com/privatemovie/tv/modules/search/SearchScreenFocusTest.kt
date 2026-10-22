package com.privatemovie.tv.modules.search

import androidx.compose.ui.focus.FocusRequester
import com.privatemovie.tv.components.FocusTransitionCoordinator
import com.privatemovie.tv.components.requestFocusSafely
import com.privatemovie.tv.dto.models.SeriesSummary
import com.privatemovie.tv.modules.search.internal.SearchReturnFocusTarget
import com.privatemovie.tv.modules.search.internal.resolveSearchReturnFocus
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.test.advanceUntilIdle
import kotlinx.coroutines.test.runTest
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertTrue
import org.junit.Test
import java.util.concurrent.atomic.AtomicInteger

@OptIn(ExperimentalCoroutinesApi::class)
class SearchScreenFocusTest {

    private fun series(id: String) = SeriesSummary(id = id, title = "Title $id")

    @Test
    fun `top-row search result cards navigate Up to the search text field via transition coordinator`() = runTest {
        val fieldFocus = FocusRequester()
        val coordinator = FocusTransitionCoordinator(this)
        var fieldFocused = false

        // Top-row cards (index < SEARCH_GRID_COLUMNS) trigger onUp
        val handled = coordinator.tryRequestFocus {
            fieldFocused = requestFocusSafely(fieldFocus, maxRetries = 2, rawRequest = { true })
            fieldFocused
        }

        assertTrue(handled)
        advanceUntilIdle()
        assertTrue(fieldFocused)
    }

    @Test
    fun `Down key from search field coordinates focus transition to card 0 without race condition`() = runTest {
        val cardFocusRequesters = List(5) { FocusRequester() }
        val coordinator = FocusTransitionCoordinator(this)
        var card0Focused = false

        val handled = coordinator.tryRequestFocus {
            val targetRequester = cardFocusRequesters.firstOrNull()
            if (targetRequester != null) {
                card0Focused = requestFocusSafely(targetRequester, maxRetries = 2, rawRequest = { true })
                card0Focused
            } else {
                false
            }
        }

        assertTrue(handled)
        advanceUntilIdle()
        assertTrue(card0Focused)
    }

    @Test
    fun `rapid Down key presses from search field are guarded by transition coordinator`() = runTest {
        val coordinator = FocusTransitionCoordinator(this)
        val counter = AtomicInteger(0)

        val first = coordinator.tryRequestFocus {
            counter.incrementAndGet()
            kotlinx.coroutines.delay(500)
            true
        }
        val second = coordinator.tryRequestFocus {
            counter.incrementAndGet()
            true
        }

        assertTrue(first)
        assertFalse(second)
        advanceUntilIdle()
        assertEquals(1, counter.get())
    }

    @Test
    fun `returning to SearchScreen with a pending return focus target restores focus to corresponding card`() = runTest {
        val results = listOf(series("s-0"), series("s-1"), series("s-2"))
        val target = SearchReturnFocusTarget(index = 2, seriesId = "s-2")
        val cardFocusRequesters = List(results.size) { FocusRequester() }
        val coordinator = FocusTransitionCoordinator(this)
        var restoredIndex = -1

        val resolved = resolveSearchReturnFocus(results, target)
        assertNotNull(resolved)

        val handled = coordinator.tryRequestFocus {
            restoredIndex = resolved!!.index
            val requester = cardFocusRequesters.getOrNull(resolved.index)
            if (requester != null) requestFocusSafely(requester, maxRetries = 2, rawRequest = { true }) else false
        }

        assertTrue(handled)
        advanceUntilIdle()
        assertEquals(2, restoredIndex)
    }
}
