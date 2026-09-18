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

    @Test
    fun `downward focus transition from Hero CTA targets first catalog item`() = runTest {
        val heroFocus = FocusRequester()
        val firstCatalogItemFocus = FocusRequester()
        val coordinator = FocusTransitionCoordinator(this)
        var targetFocused = false

        val feed = TvHomeFeed(
            hero = null,
            heroes = listOf(
                TvHomeHero(
                    series = TvSeries(
                        id = "s-1",
                        title = "Featured Series",
                        description = "Featured desc",
                        type = "tv",
                        posterUrl = null,
                        backdropUrl = null,
                        rating = "8.5",
                        isFeatured = true,
                        genres = emptyList(),
                        seasonsCount = 1,
                        episodesCount = 12
                    ),
                    tags = emptyList()
                )
            ),
            rows = listOf(
                TvHomeRow(
                    title = "Popular",
                    items = listOf(
                        TvSeries(
                            id = "s-2",
                            title = "Popular Series",
                            description = "Popular desc",
                            type = "tv",
                            posterUrl = null,
                            backdropUrl = null,
                            rating = "8.0",
                            isFeatured = false,
                            genres = emptyList(),
                            seasonsCount = 1,
                            episodesCount = 10
                        )
                    )
                )
            )
        )

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
}
