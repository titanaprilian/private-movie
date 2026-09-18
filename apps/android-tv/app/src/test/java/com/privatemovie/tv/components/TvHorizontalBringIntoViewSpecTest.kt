package com.privatemovie.tv.components

import org.junit.Assert.assertEquals
import org.junit.Test

class TvHorizontalBringIntoViewSpecTest {

    private val margin = 48f
    private val containerSize = 1920f
    private val spec = TvHorizontalBringIntoViewSpec(edgeMargin = margin)

    @Test
    fun `navigating left when offset is negative returns correct negative delta`() {
        // Card offset -100f, size 300f -> leadingEdge -100f
        // Expected scroll delta: -100f - 48f = -148f
        val delta = spec.calculateScrollDistance(offset = -100f, size = 300f, containerSize = containerSize)
        assertEquals(-148f, delta, 0.001f)
    }

    @Test
    fun `navigating left when offset is within left margin returns negative delta`() {
        // Card offset 20f (less than margin 48f), size 300f -> leadingEdge 20f
        // Expected scroll delta: 20f - 48f = -28f
        val delta = spec.calculateScrollDistance(offset = 20f, size = 300f, containerSize = containerSize)
        assertEquals(-28f, delta, 0.001f)
    }

    @Test
    fun `navigating right when card extends past container size minus margin returns positive delta`() {
        // Container 1920f, margin 48f -> safe boundary 1872f
        // Card offset 1700f, size 300f -> trailingEdge 2000f
        // Expected scroll delta: 2000f - 1920f + 48f = 128f
        val delta = spec.calculateScrollDistance(offset = 1700f, size = 300f, containerSize = containerSize)
        assertEquals(128f, delta, 0.001f)
    }

    @Test
    fun `element fully within safe margins returns zero scroll delta`() {
        // Card offset 100f, size 300f -> leadingEdge 100f >= 48f, trailingEdge 400f <= 1872f
        val delta = spec.calculateScrollDistance(offset = 100f, size = 300f, containerSize = containerSize)
        assertEquals(0f, delta, 0.001f)
    }

    @Test
    fun `boundary edge case exactly at left margin returns zero delta`() {
        // Card offset 48f, size 300f -> leadingEdge 48f, trailingEdge 348f
        val delta = spec.calculateScrollDistance(offset = 48f, size = 300f, containerSize = containerSize)
        assertEquals(0f, delta, 0.001f)
    }

    @Test
    fun `boundary edge case exactly at right margin boundary returns zero delta`() {
        // Card offset 1572f, size 300f -> trailingEdge 1872f (1920 - 48)
        val delta = spec.calculateScrollDistance(offset = 1572f, size = 300f, containerSize = containerSize)
        assertEquals(0f, delta, 0.001f)
    }
}
