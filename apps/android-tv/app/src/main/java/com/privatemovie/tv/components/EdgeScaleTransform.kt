package com.privatemovie.tv.components

import androidx.compose.ui.graphics.TransformOrigin

/**
 * Edge-aware transform origin helper for TV carousel items.
 *
 * Calculates the [TransformOrigin] pivot for scaling cards on D-pad focus:
 * - First item (index 0 when total > 1): `TransformOrigin(0f, 0.5f)` (scales rightward, preventing left edge clipping)
 * - Last item (index total - 1 when total > 1): `TransformOrigin(1f, 0.5f)` (scales leftward, preventing right edge clipping)
 * - Single item (total <= 1) or intermediate items: `TransformOrigin(0.5f, 0.5f)` (scales from center)
 */
object EdgeScaleTransform {
    fun calculate(index: Int, itemCount: Int): TransformOrigin {
        if (itemCount <= 1 || index < 0 || index >= itemCount) {
            return TransformOrigin(0.5f, 0.5f)
        }
        return when (index) {
            0 -> TransformOrigin(0f, 0.5f)
            itemCount - 1 -> TransformOrigin(1f, 0.5f)
            else -> TransformOrigin(0.5f, 0.5f)
        }
    }

    operator fun invoke(index: Int, itemCount: Int): TransformOrigin = calculate(index, itemCount)
}
