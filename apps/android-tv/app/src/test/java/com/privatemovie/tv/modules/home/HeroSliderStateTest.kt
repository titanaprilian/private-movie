package com.privatemovie.tv.modules.home

import com.privatemovie.tv.modules.home.internal.HeroSliderState
import com.privatemovie.tv.modules.home.internal.TvHomeHero
import com.privatemovie.tv.modules.home.internal.TvSeries
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.launch
import kotlinx.coroutines.test.advanceTimeBy
import kotlinx.coroutines.test.runTest
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

@OptIn(ExperimentalCoroutinesApi::class)
class HeroSliderStateTest {

    private fun createHero(id: String, title: String): TvHomeHero {
        return TvHomeHero(
            series = TvSeries(
                id = id,
                title = title,
                description = "Desc",
                type = "series",
                posterUrl = null,
                backdropUrl = null,
                logoUrl = null,
                rating = null,
                isFeatured = true,
                genres = emptyList(),
                seasonsCount = 1,
                episodesCount = 10
            ),
            tags = emptyList()
        )
    }

    @Test
    fun autoAdvanceWrapsAroundNSlides() = runTest {
        val heroes = listOf(
            createHero("h1", "Hero 1"),
            createHero("h2", "Hero 2"),
            createHero("h3", "Hero 3")
        )
        val state = HeroSliderState(heroes = heroes, autoAdvanceIntervalMs = 6000L)
        state.activeIndex = 2
        state.onCtaFocusChanged(true)

        val job = launch { state.runAutoAdvanceLoop() }
        advanceTimeBy(6001L)

        assertEquals(0, state.activeIndex)
        job.cancel()
    }

    @Test
    fun singleHeroDoesNotAdvance() = runTest {
        val heroes = listOf(createHero("h1", "Hero 1"))
        val state = HeroSliderState(heroes = heroes, autoAdvanceIntervalMs = 6000L)
        state.onCtaFocusChanged(true)

        val job = launch { state.runAutoAdvanceLoop() }
        advanceTimeBy(18000L)

        assertEquals(0, state.activeIndex)
        job.cancel()
    }

    @Test
    fun manualRightNavigationCyclesCorrectly() {
        val heroes = (1..5).map { createHero("h$it", "Hero $it") }
        val state = HeroSliderState(heroes = heroes)
        state.activeIndex = 4

        state.advanceSlide()

        assertEquals(0, state.activeIndex)
    }

    @Test
    fun manualLeftNavigationCyclesCorrectly() {
        val heroes = (1..5).map { createHero("h$it", "Hero $it") }
        val state = HeroSliderState(heroes = heroes)
        state.activeIndex = 0

        state.previousSlide()

        assertEquals(4, state.activeIndex)
    }

    @Test
    fun dPadKeyEventLeftAndRightCyclesCorrectly() {
        val heroes = (1..3).map { createHero("h$it", "Hero $it") }
        val state = HeroSliderState(heroes = heroes)
        state.activeIndex = 0

        val handledLeft = state.handleKey(isKeyDown = true, keyCode = android.view.KeyEvent.KEYCODE_DPAD_LEFT)
        assertTrue(handledLeft)
        assertEquals(2, state.activeIndex)

        val handledRight = state.handleKey(isKeyDown = true, keyCode = android.view.KeyEvent.KEYCODE_DPAD_RIGHT)
        assertTrue(handledRight)
        assertEquals(0, state.activeIndex)

        val handledUp = state.handleKey(isKeyDown = true, keyCode = android.view.KeyEvent.KEYCODE_DPAD_UP)
        assertFalse(handledUp)
        assertEquals(0, state.activeIndex)
    }

    @Test
    fun dPadKeyIgnoredForSingleHero() {
        val heroes = listOf(createHero("h1", "Hero 1"))
        val state = HeroSliderState(heroes = heroes)

        val handledLeft = state.handleKey(isKeyDown = true, keyCode = android.view.KeyEvent.KEYCODE_DPAD_LEFT)
        assertFalse(handledLeft)
        assertEquals(0, state.activeIndex)
    }

    @Test
    fun autoAdvanceRunsOnlyWhenCtaFocused() = runTest {
        val heroes = listOf(
            createHero("h1", "Hero 1"),
            createHero("h2", "Hero 2"),
            createHero("h3", "Hero 3")
        )
        val state = HeroSliderState(heroes = heroes, autoAdvanceIntervalMs = 6000L)

        val job = launch { state.runAutoAdvanceLoop() }

        // When not focused, carousel should not advance
        advanceTimeBy(6000L)
        assertEquals(0, state.activeIndex)

        // When CTA receives focus, carousel advances after interval
        state.onCtaFocusChanged(true)
        assertTrue(state.isCtaFocused)

        advanceTimeBy(6000L)
        assertEquals(1, state.activeIndex)

        // When focus leaves CTA (e.g. user goes to catalog), carousel stops advancing
        state.onCtaFocusChanged(false)
        assertFalse(state.isCtaFocused)

        advanceTimeBy(12000L)
        assertEquals(1, state.activeIndex)

        job.cancel()
    }

    @Test
    fun manualNavigationResetsTimerToken() {
        val heroes = (1..3).map { createHero("h$it", "Hero $it") }
        val state = HeroSliderState(heroes = heroes)
        val initialToken = state.timerResetToken

        state.advanceSlide(resetTimer = true)
        assertEquals(initialToken + 1, state.timerResetToken)

        state.previousSlide(resetTimer = true)
        assertEquals(initialToken + 2, state.timerResetToken)

        state.selectSlide(1, resetTimer = true)
        assertEquals(initialToken + 3, state.timerResetToken)
    }

    @Test
    fun shouldShowChevronsOnlyWhenFocusedAndMultipleHeroes() {
        val singleHero = listOf(createHero("h1", "Hero 1"))
        val multipleHeroes = listOf(createHero("h1", "Hero 1"), createHero("h2", "Hero 2"))

        val stateSingle = HeroSliderState(heroes = singleHero)
        val stateMultiple = HeroSliderState(heroes = multipleHeroes)

        fun shouldShowChevrons(isFocused: Boolean, heroCount: Int): Boolean {
            return isFocused && heroCount > 1
        }

        assertFalse(shouldShowChevrons(isFocused = false, heroCount = stateSingle.heroCount))
        assertFalse(shouldShowChevrons(isFocused = true, heroCount = stateSingle.heroCount))
        assertFalse(shouldShowChevrons(isFocused = false, heroCount = stateMultiple.heroCount))
        assertTrue(shouldShowChevrons(isFocused = true, heroCount = stateMultiple.heroCount))
    }
}
