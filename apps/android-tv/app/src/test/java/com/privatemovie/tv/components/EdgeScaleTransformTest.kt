package com.privatemovie.tv.components

import androidx.compose.ui.graphics.TransformOrigin
import org.junit.Assert.assertEquals
import org.junit.Test

class EdgeScaleTransformTest {

    @Test
    fun `single item returns center transform origin`() {
        val origin = EdgeScaleTransform(index = 0, itemCount = 1)
        assertEquals(0.5f, origin.pivotFractionX, 0.0001f)
        assertEquals(0.5f, origin.pivotFractionY, 0.0001f)
    }

    @Test
    fun `first item returns left edge transform origin`() {
        val origin = EdgeScaleTransform(index = 0, itemCount = 5)
        assertEquals(0f, origin.pivotFractionX, 0.0001f)
        assertEquals(0.5f, origin.pivotFractionY, 0.0001f)
    }

    @Test
    fun `middle item returns center transform origin`() {
        val origin = EdgeScaleTransform(index = 2, itemCount = 5)
        assertEquals(0.5f, origin.pivotFractionX, 0.0001f)
        assertEquals(0.5f, origin.pivotFractionY, 0.0001f)
    }

    @Test
    fun `last item returns right edge transform origin`() {
        val origin = EdgeScaleTransform(index = 4, itemCount = 5)
        assertEquals(1f, origin.pivotFractionX, 0.0001f)
        assertEquals(0.5f, origin.pivotFractionY, 0.0001f)
    }

    @Test
    fun `calculate function produces identical results`() {
        assertEquals(
            TransformOrigin(0f, 0.5f),
            EdgeScaleTransform.calculate(index = 0, itemCount = 3)
        )
        assertEquals(
            TransformOrigin(1f, 0.5f),
            EdgeScaleTransform.calculate(index = 2, itemCount = 3)
        )
        assertEquals(
            TransformOrigin(0.5f, 0.5f),
            EdgeScaleTransform.calculate(index = 1, itemCount = 3)
        )
    }

    @Test
    fun `invalid indices and item counts fallback to center transform origin`() {
        assertEquals(TransformOrigin(0.5f, 0.5f), EdgeScaleTransform(index = -1, itemCount = 5))
        assertEquals(TransformOrigin(0.5f, 0.5f), EdgeScaleTransform(index = 5, itemCount = 5))
        assertEquals(TransformOrigin(0.5f, 0.5f), EdgeScaleTransform(index = 0, itemCount = 0))
    }
}
