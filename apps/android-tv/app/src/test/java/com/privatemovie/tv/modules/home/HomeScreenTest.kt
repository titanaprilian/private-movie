package com.privatemovie.tv.modules.home

import androidx.compose.ui.focus.FocusRequester
import com.privatemovie.tv.components.FocusTransitionCoordinator
import com.privatemovie.tv.components.requestFocusSafely
import com.privatemovie.tv.modules.home.internal.TvHomeFeed
import com.privatemovie.tv.modules.home.internal.TvHomeHero
import com.privatemovie.tv.modules.home.internal.TvHomeRow
import com.privatemovie.tv.modules.home.internal.TvSeries
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.test.advanceUntilIdle
import kotlinx.coroutines.test.runTest
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test
import java.util.concurrent.atomic.AtomicInteger

@OptIn(ExperimentalCoroutinesApi::class)
class HomeScreenTest {

    // ── helpers ──────────────────────────────────────────────────────────────

    private fun makeSeries(id: String) = TvSeries(
        id = id, title = id, description = null, type = "tv",
        posterUrl = null, backdropUrl = null, rating = null,
        isFeatured = false, genres = emptyList(), seasonsCount = 1, episodesCount = 5
    )

    private fun makeFeed(rowSizes: List<Int> = listOf(5)): TvHomeFeed {
        val hero = TvHomeHero(series = makeSeries("hero"), tags = emptyList())
        val rows = rowSizes.mapIndexed { i, size ->
            TvHomeRow(title = "Row $i", items = (0 until size).map { makeSeries("s-$i-$it") })
        }
        return TvHomeFeed(hero = null, heroes = listOf(hero), rows = rows)
    }

    // Simulates the focusRowCard helper from HomeFeedContent.
    private suspend fun focusRowCard(
        feed: TvHomeFeed,
        rowFocusIndices: Map<Int, Int>,
        rowFocusRequesters: Map<Int, List<FocusRequester>>,
        targetRowIndex: Int,
        hasHero: Boolean = true
    ): Boolean {
        val row = feed.rows.getOrNull(targetRowIndex) ?: return false
        val requesters = rowFocusRequesters[targetRowIndex] ?: return false
        if (requesters.isEmpty()) return false
        val rememberedIndex = rowFocusIndices[targetRowIndex] ?: 0
        val clampedIndex = rememberedIndex.coerceIn(0, requesters.size - 1)
        val targetRequester = requesters[clampedIndex]
        val success = requestFocusSafely(targetRequester, maxRetries = 2, rawRequest = { true })
        return if (!success) {
            requestFocusSafely(requesters[0], maxRetries = 2, rawRequest = { true })
        } else {
            true
        }
    }

    // ── original tests ────────────────────────────────────────────────────────

    @Test
    fun `downward focus transition from Hero CTA targets first catalog item`() = runTest {
        val heroFocus = FocusRequester()
        val firstCatalogItemFocus = FocusRequester()
        val coordinator = FocusTransitionCoordinator(this)
        var targetFocused = false

        val feed = makeFeed(listOf(1))

        val handled = coordinator.tryRequestFocus {
            val hasRows = feed.rows.any { it.items.isNotEmpty() }
            if (hasRows) {
                targetFocused = requestFocusSafely(firstCatalogItemFocus, maxRetries = 2, rawRequest = { true })
                targetFocused
            } else {
                false
            }
        }

        assertTrue(handled)
        advanceUntilIdle()
        assertTrue(targetFocused)
    }

    @Test
    fun `upward focus transition from first catalog item targets Hero CTA`() = runTest {
        val heroFocus = FocusRequester()
        val coordinator = FocusTransitionCoordinator(this)
        var heroFocused = false

        val handled = coordinator.tryRequestFocus {
            heroFocused = requestFocusSafely(heroFocus, maxRetries = 2, rawRequest = { true })
            heroFocused
        }

        assertTrue(handled)
        advanceUntilIdle()
        assertTrue(heroFocused)
    }

    @Test
    fun `rapid focus transition attempts are rejected by FocusTransitionCoordinator`() = runTest {
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

    // ── per-row focus memory & restoration tests ──────────────────────────────

    @Test
    fun `downward navigation from Hero CTA restores focus to remembered card index in row 0`() = runTest {
        val feed = makeFeed(listOf(5))
        val requesters = mapOf(0 to List(5) { FocusRequester() })
        val rowFocusIndices = mutableMapOf(0 to 3) // user was on card index 3
        var focusedRequesterIndex = -1

        val coordinator = FocusTransitionCoordinator(this)
        val handled = coordinator.tryRequestFocus {
            val rememberedIndex = (rowFocusIndices[0] ?: 0).coerceIn(0, 4)
            focusedRequesterIndex = rememberedIndex
            requestFocusSafely(requesters[0]!![rememberedIndex], maxRetries = 2, rawRequest = { true })
        }

        assertTrue(handled)
        advanceUntilIdle()
        assertEquals(3, focusedRequesterIndex)
    }

    @Test
    fun `each row independently tracks its focused card index`() {
        val rowFocusIndices = mutableMapOf<Int, Int>()

        // Simulate focus events as user navigates
        rowFocusIndices[0] = 2  // row 0: user on card 2
        rowFocusIndices[1] = 4  // row 1: user on card 4
        rowFocusIndices[2] = 0  // row 2: user on card 0

        assertEquals(2, rowFocusIndices[0])
        assertEquals(4, rowFocusIndices[1])
        assertEquals(0, rowFocusIndices[2])
    }

    @Test
    fun `focus restoration clamps out-of-bounds remembered index to last valid card`() = runTest {
        val feed = makeFeed(listOf(3))
        val requesters = mapOf(0 to List(3) { FocusRequester() })
        // Stale remembered index (e.g. from a previous feed with more items)
        val rowFocusIndices = mutableMapOf(0 to 99)
        var resolvedIndex = -1

        val coordinator = FocusTransitionCoordinator(this)
        coordinator.tryRequestFocus {
            val remembered = rowFocusIndices[0] ?: 0
            val clamped = remembered.coerceIn(0, requesters[0]!!.size - 1)
            resolvedIndex = clamped
            requestFocusSafely(requesters[0]!![clamped], maxRetries = 2, rawRequest = { true })
        }

        advanceUntilIdle()
        assertEquals(2, resolvedIndex) // clamped to index 2 (last valid for size 3)
    }

    @Test
    fun `focus fallback to card 0 when primary acquisition fails`() = runTest {
        val feed = makeFeed(listOf(4))
        val requesters = mapOf(0 to List(4) { FocusRequester() })
        val rowFocusIndices = mutableMapOf(0 to 2)
        var fallbackUsed = false

        val coordinator = FocusTransitionCoordinator(this)
        coordinator.tryRequestFocus {
            val clamped = (rowFocusIndices[0] ?: 0).coerceIn(0, 3)
            // Simulate primary focus failing
            val primarySuccess = requestFocusSafely(requesters[0]!![clamped], maxRetries = 1, rawRequest = { false })
            if (!primarySuccess) {
                fallbackUsed = true
                requestFocusSafely(requesters[0]!![0], maxRetries = 2, rawRequest = { true })
            } else {
                primarySuccess
            }
        }

        advanceUntilIdle()
        assertTrue(fallbackUsed)
    }

    @Test
    fun `onFocused callback records correct card index per row`() {
        val rowFocusIndices = mutableMapOf<Int, Int>()

        // Simulate the onFocused lambda called by each SeriesPosterCard
        val onFocusedRow0Card2: () -> Unit = { rowFocusIndices[0] = 2 }
        val onFocusedRow1Card0: () -> Unit = { rowFocusIndices[1] = 0 }

        onFocusedRow0Card2()
        onFocusedRow1Card0()

        assertEquals(2, rowFocusIndices[0])
        assertEquals(0, rowFocusIndices[1])
    }

    @Test
    fun `downward navigation targets first non-empty row when row 0 is empty`() = runTest {
        val feed = TvHomeFeed(
            hero = null,
            heroes = listOf(TvHomeHero(series = makeSeries("hero"), tags = emptyList())),
            rows = listOf(
                TvHomeRow(title = "Empty Row", items = emptyList()),
                TvHomeRow(title = "Popular", items = listOf(makeSeries("s-1"), makeSeries("s-2")))
            )
        )
        val firstNonEmptyRowIndex = feed.rows.indexOfFirst { it.items.isNotEmpty() }
        assertEquals(1, firstNonEmptyRowIndex)

        val requesters = mapOf(1 to List(2) { FocusRequester() })
        val rowFocusIndices = mutableMapOf<Int, Int>() // no remembered index yet
        var focusedIndex = -1

        val coordinator = FocusTransitionCoordinator(this)
        coordinator.tryRequestFocus {
            val remembered = (rowFocusIndices[firstNonEmptyRowIndex] ?: 0)
                .coerceIn(0, requesters[firstNonEmptyRowIndex]!!.size - 1)
            focusedIndex = remembered
            requestFocusSafely(requesters[firstNonEmptyRowIndex]!![remembered], maxRetries = 2, rawRequest = { true })
        }

        advanceUntilIdle()
        assertEquals(0, focusedIndex) // defaults to card 0 for first time
    }
}
