package com.privatemovie.tv.modules.detail

import com.privatemovie.tv.modules.detail.internal.CarouselFocusPlan
import com.privatemovie.tv.modules.detail.internal.executeCarouselFocus
import com.privatemovie.tv.modules.detail.internal.planDownwardFocus
import com.privatemovie.tv.modules.detail.internal.shouldConsumeDownKey
import kotlinx.coroutines.test.runTest
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertTrue
import org.junit.Test

class EpisodeFocusTransitionTest {

    @Test
    fun `planDownwardFocus returns null when there are no episodes`() {
        assertNull(planDownwardFocus(episodeCount = 0, rememberedIndex = 0))
    }

    @Test
    fun `planDownwardFocus clamps remembered index into range`() {
        assertEquals(2, planDownwardFocus(3, 2)?.targetIndex)
        // Stale index from a season with more episodes clamps to the last card.
        assertEquals(1, planDownwardFocus(2, 99)?.targetIndex)
        // Negative index clamps to Card 0.
        assertEquals(0, planDownwardFocus(3, -4)?.targetIndex)
    }

    @Test
    fun `planDownwardFocus defaults fallback to Card 0`() {
        val plan = planDownwardFocus(5, 3)
        assertNotNull(plan)
        assertEquals(3, plan!!.targetIndex)
        assertEquals(0, plan.fallbackIndex)
    }

    @Test
    fun `shouldConsumeDownKey is false without episodes or while in flight`() {
        assertFalse(shouldConsumeDownKey(episodeCount = 0, transitionInFlight = false))
        assertFalse(shouldConsumeDownKey(episodeCount = 3, transitionInFlight = true))
        assertFalse(shouldConsumeDownKey(episodeCount = 0, transitionInFlight = true))
    }

    @Test
    fun `shouldConsumeDownKey is true when transition can start`() {
        assertTrue(shouldConsumeDownKey(episodeCount = 1, transitionInFlight = false))
        assertTrue(shouldConsumeDownKey(episodeCount = 8, transitionInFlight = false))
    }

    @Test
    fun `executeCarouselFocus focuses target when request succeeds`() = runTest {
        val requested = mutableListOf<Int>()
        val focused = executeCarouselFocus(CarouselFocusPlan(targetIndex = 2)) { index ->
            requested.add(index)
            true
        }
        assertEquals(2, focused)
        assertEquals(listOf(2), requested)
    }

    @Test
    fun `executeCarouselFocus falls back to Card 0 when target fails`() = runTest {
        val requested = mutableListOf<Int>()
        val focused = executeCarouselFocus(CarouselFocusPlan(targetIndex = 4)) { index ->
            requested.add(index)
            index == 0 // only Card 0 can acquire focus
        }
        assertEquals(0, focused)
        assertEquals(listOf(4, 0), requested)
    }

    @Test
    fun `executeCarouselFocus returns null when target and fallback both fail`() = runTest {
        val focused = executeCarouselFocus(CarouselFocusPlan(targetIndex = 3)) { false }
        assertNull(focused)
    }

    @Test
    fun `executeCarouselFocus attempts Card 0 only once when target is Card 0`() = runTest {
        var attempts = 0
        val focused = executeCarouselFocus(CarouselFocusPlan(targetIndex = 0)) {
            attempts++
            false
        }
        assertNull(focused)
        assertEquals(1, attempts)
    }
}
