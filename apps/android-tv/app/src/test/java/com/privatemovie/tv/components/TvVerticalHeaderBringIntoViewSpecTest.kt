package com.privatemovie.tv.components

import androidx.compose.foundation.lazy.LazyListState
import org.junit.Assert.assertEquals
import org.junit.Test

class TvVerticalHeaderBringIntoViewSpecTest {

    private val containerSize = 1080f

    @Test
    fun `returns zero when header is visible and focused element fits within container`() {
        val lazyListState = LazyListState(firstVisibleItemIndex = 0, firstVisibleItemScrollOffset = 0)
        val spec = TvVerticalHeaderBringIntoViewSpec(lazyListState)

        // CTA inside header: offset 200, size 80 fits within 1080 -> should suppress scroll
        val delta = spec.calculateScrollDistance(offset = 200f, size = 80f, containerSize = containerSize)
        assertEquals(0f, delta, 0.001f)
    }

    @Test
    fun `returns zero when header visible and element exactly fits bounds`() {
        val lazyListState = LazyListState(firstVisibleItemIndex = 0, firstVisibleItemScrollOffset = 0)
        val spec = TvVerticalHeaderBringIntoViewSpec(lazyListState)

        val delta = spec.calculateScrollDistance(offset = 0f, size = containerSize, containerSize = containerSize)
        assertEquals(0f, delta, 0.001f)
    }

    @Test
    fun `returns standard negative delta when header scrolled past and element is off-screen top`() {
        val lazyListState = LazyListState(firstVisibleItemIndex = 1, firstVisibleItemScrollOffset = 0)
        val spec = TvVerticalHeaderBringIntoViewSpec(lazyListState)

        // offset -50 -> should return -50 standard vertical bring-into-view
        val delta = spec.calculateScrollDistance(offset = -50f, size = 100f, containerSize = containerSize)
        assertEquals(-50f, delta, 0.001f)
    }

    @Test
    fun `returns standard positive delta when header scrolled past and element extends beyond container`() {
        val lazyListState = LazyListState(firstVisibleItemIndex = 2, firstVisibleItemScrollOffset = 0)
        val spec = TvVerticalHeaderBringIntoViewSpec(lazyListState)

        // offset 1000, size 200 -> trailing 1200 > 1080 -> delta 120
        val delta = spec.calculateScrollDistance(offset = 1000f, size = 200f, containerSize = containerSize)
        assertEquals(120f, delta, 0.001f)
    }

    @Test
    fun `returns zero when header scrolled past but element already fully visible`() {
        val lazyListState = LazyListState(firstVisibleItemIndex = 3, firstVisibleItemScrollOffset = 0)
        val spec = TvVerticalHeaderBringIntoViewSpec(lazyListState)

        val delta = spec.calculateScrollDistance(offset = 100f, size = 100f, containerSize = containerSize)
        assertEquals(0f, delta, 0.001f)
    }

    @Test
    fun `header visible but element overflows container returns positive delta`() {
        val lazyListState = LazyListState(firstVisibleItemIndex = 0, firstVisibleItemScrollOffset = 0)
        val spec = TvVerticalHeaderBringIntoViewSpec(lazyListState)

        // element does not fit fully: trailing exceeds container -> header visible but not fitting => standard delta
        val delta = spec.calculateScrollDistance(offset = 900f, size = 300f, containerSize = containerSize)
        assertEquals(120f, delta, 0.001f)
    }

    @Test
    fun `header visible but element starts before container returns negative delta`() {
        val lazyListState = LazyListState(firstVisibleItemIndex = 0, firstVisibleItemScrollOffset = 0)
        val spec = TvVerticalHeaderBringIntoViewSpec(lazyListState)

        val delta = spec.calculateScrollDistance(offset = -20f, size = 100f, containerSize = containerSize)
        assertEquals(-20f, delta, 0.001f)
    }
}
