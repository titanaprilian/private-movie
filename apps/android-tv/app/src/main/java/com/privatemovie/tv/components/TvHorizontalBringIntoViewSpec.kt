package com.privatemovie.tv.components

import androidx.compose.foundation.ExperimentalFoundationApi
import androidx.compose.foundation.gestures.BringIntoViewSpec

/**
 * BringIntoView specification for TV horizontal carousels with edge margins.
 *
 * Ensures cards navigating off-screen smoothly scroll into view with safe edge margins
 * (headroom for scale transforms and focus borders).
 *
 * Scroll distance calculation rules:
 * - If leadingEdge < margin (off-screen left or within margin): returns negative scroll delta (leadingEdge - margin)
 * - Else if trailingEdge > containerSize - margin (off-screen right or within margin): returns positive scroll delta (trailingEdge - containerSize + margin)
 * - Else (fully inside safe edge margins): returns 0f (no scroll needed)
 */
@OptIn(ExperimentalFoundationApi::class)
class TvHorizontalBringIntoViewSpec(
    private val edgeMargin: Float = 48f
) : BringIntoViewSpec {

    override fun calculateScrollDistance(offset: Float, size: Float, containerSize: Float): Float {
        val leadingEdge = offset
        val trailingEdge = offset + size

        return if (leadingEdge < edgeMargin) {
            leadingEdge - edgeMargin
        } else if (trailingEdge > containerSize - edgeMargin) {
            trailingEdge - containerSize + edgeMargin
        } else {
            0f
        }
    }
}
