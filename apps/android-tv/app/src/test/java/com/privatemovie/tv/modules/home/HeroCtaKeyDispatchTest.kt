package com.privatemovie.tv.modules.home

import com.privatemovie.tv.modules.home.internal.HeroCtaKeyAction
import com.privatemovie.tv.modules.home.internal.HeroSliderState
import com.privatemovie.tv.modules.home.internal.TvHomeHero
import com.privatemovie.tv.modules.home.internal.TvSeries
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class HeroCtaKeyDispatchTest {

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

    private fun stateWithHeroes(count: Int): HeroSliderState {
        val heroes = (1..count).map { createHero("h$it", "Hero $it") }
        return HeroSliderState(heroes = heroes)
    }

    @Test
    fun leftPressWithMultipleHeroesCyclesToPreviousSlideWhenActiveIndexGreaterThanZero() {
        val state = stateWithHeroes(3)
        state.activeIndex = 1
        var drawerOpened = false

        val consumed = state.handleCtaKey(
            isKeyDown = true,
            keyCode = android.view.KeyEvent.KEYCODE_DPAD_LEFT,
            onLeftFromCta = { drawerOpened = true }
        )

        assertTrue(consumed)
        assertEquals(0, state.activeIndex)
        assertFalse(drawerOpened)
    }

    @Test
    fun leftPressWithMultipleHeroesResolvesToPreviousSlideActionWhenActiveIndexGreaterThanZero() {
        val state = stateWithHeroes(3)
        state.activeIndex = 1

        assertEquals(
            HeroCtaKeyAction.PREVIOUS_SLIDE,
            state.resolveCtaKeyAction(true, android.view.KeyEvent.KEYCODE_DPAD_LEFT)
        )
    }

    @Test
    fun leftPressWithMultipleHeroesAtActiveIndexZeroResolvesToOpenDrawer() {
        val state = stateWithHeroes(3)
        state.activeIndex = 0
        var drawerOpened = false

        val action = state.resolveCtaKeyAction(true, android.view.KeyEvent.KEYCODE_DPAD_LEFT)
        assertEquals(HeroCtaKeyAction.OPEN_DRAWER, action)

        val consumed = state.handleCtaKey(
            isKeyDown = true,
            keyCode = android.view.KeyEvent.KEYCODE_DPAD_LEFT,
            onLeftFromCta = { drawerOpened = true }
        )
        assertTrue(consumed)
        assertTrue(drawerOpened)
        assertEquals(0, state.activeIndex)
    }

    @Test
    fun leftPressWithSingleHeroDelegatesToDrawer() {
        val state = stateWithHeroes(1)
        var drawerOpened = false

        val consumed = state.handleCtaKey(
            isKeyDown = true,
            keyCode = android.view.KeyEvent.KEYCODE_DPAD_LEFT,
            onLeftFromCta = { drawerOpened = true }
        )

        assertTrue(consumed)
        assertTrue(drawerOpened)
        assertEquals(0, state.activeIndex)
    }

    @Test
    fun leftPressWithSingleHeroResolvesToOpenDrawerAction() {
        val state = stateWithHeroes(1)

        assertEquals(
            HeroCtaKeyAction.OPEN_DRAWER,
            state.resolveCtaKeyAction(true, android.view.KeyEvent.KEYCODE_DPAD_LEFT)
        )
    }

    @Test
    fun leftPressWithSingleHeroAndNoDrawerCallbackIsNotConsumed() {
        val state = stateWithHeroes(1)

        val consumed = state.handleCtaKey(
            isKeyDown = true,
            keyCode = android.view.KeyEvent.KEYCODE_DPAD_LEFT,
            onLeftFromCta = null
        )

        assertFalse(consumed)
    }

    @Test
    fun rightPressWithMultipleHeroesCyclesToNextSlide() {
        val state = stateWithHeroes(3)
        state.activeIndex = 0

        val consumed = state.handleCtaKey(
            isKeyDown = true,
            keyCode = android.view.KeyEvent.KEYCODE_DPAD_RIGHT
        )

        assertTrue(consumed)
        assertEquals(1, state.activeIndex)
        assertEquals(
            HeroCtaKeyAction.NEXT_SLIDE,
            state.resolveCtaKeyAction(true, android.view.KeyEvent.KEYCODE_DPAD_RIGHT)
        )
    }

    @Test
    fun rightPressWithSingleHeroIsNotConsumed() {
        val state = stateWithHeroes(1)

        val consumed = state.handleCtaKey(
            isKeyDown = true,
            keyCode = android.view.KeyEvent.KEYCODE_DPAD_RIGHT
        )

        assertFalse(consumed)
        assertEquals(0, state.activeIndex)
    }

    @Test
    fun downPressInvokesDownCallbackAndIsConsumed() {
        val state = stateWithHeroes(3)
        var movedDown = false

        val consumed = state.handleCtaKey(
            isKeyDown = true,
            keyCode = android.view.KeyEvent.KEYCODE_DPAD_DOWN,
            onDownFromCta = { movedDown = true }
        )

        assertTrue(consumed)
        assertTrue(movedDown)
    }

    @Test
    fun downPressWithoutCallbackIsNotConsumed() {
        val state = stateWithHeroes(3)

        val consumed = state.handleCtaKey(
            isKeyDown = true,
            keyCode = android.view.KeyEvent.KEYCODE_DPAD_DOWN
        )

        assertFalse(consumed)
    }

    @Test
    fun keyUpIsNeverConsumed() {
        val state = stateWithHeroes(3)

        assertEquals(
            HeroCtaKeyAction.NONE,
            state.resolveCtaKeyAction(false, android.view.KeyEvent.KEYCODE_DPAD_LEFT)
        )
        assertFalse(
            state.handleCtaKey(
                isKeyDown = false,
                keyCode = android.view.KeyEvent.KEYCODE_DPAD_LEFT,
                onLeftFromCta = { }
            )
        )
    }
}
