package com.privatemovie.tv.modules.home.internal

import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.AnimationVector1D
import androidx.compose.animation.core.FastOutSlowInEasing
import androidx.compose.animation.core.tween
import androidx.compose.foundation.layout.size
import androidx.compose.material3.Icon
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.unit.dp
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.launch

/** Peak scale of a chevron while its press pulse is playing. */
internal const val HERO_CHEVRON_PULSE_SCALE = 1.35f

/** Duration (ms) of the chevron pulse returning to its resting state. */
internal const val HERO_CHEVRON_PULSE_DURATION_MS = 150

/** Resting alpha of a chevron icon. */
internal const val HERO_CHEVRON_REST_ALPHA = 0.85f

/**
 * Press-feedback controller for a Hero slider chevron.
 *
 * The pulse is a snappy scale-up followed by a short (~150ms) eased return to rest.
 * It is driven by [Animatable] so the change is applied through `Modifier.graphicsLayer`
 * and never triggers a layout re-measure (no label jitter).
 */
internal class ChevronPulse(
    private val scope: CoroutineScope,
    private val scale: Animatable<Float, AnimationVector1D>
) {
    val value: Float
        get() = scale.value

    /** Plays the pulse, restarting it when pressed again while still animating. */
    fun trigger() {
        scope.launch {
            scale.stop()
            scale.snapTo(HERO_CHEVRON_PULSE_SCALE)
            scale.animateTo(
                targetValue = 1f,
                animationSpec = tween(
                    durationMillis = HERO_CHEVRON_PULSE_DURATION_MS,
                    easing = FastOutSlowInEasing
                )
            )
        }
    }

    /** Returns the chevron to its resting state without playing a pulse. */
    fun reset() {
        scope.launch {
            scale.stop()
            scale.snapTo(1f)
        }
    }

    /** Alpha matching the current pulse scale: rest is dimmed, pulse is fully bright. */
    val alpha: Float
        get() {
            val pulseProgress = ((value - 1f) / (HERO_CHEVRON_PULSE_SCALE - 1f)).coerceIn(0f, 1f)
            return HERO_CHEVRON_REST_ALPHA + pulseProgress * (1f - HERO_CHEVRON_REST_ALPHA)
        }
}

@Composable
internal fun rememberChevronPulse(): ChevronPulse {
    val scope = rememberCoroutineScope()
    val scale = remember { Animatable(1f) }
    return remember(scope, scale) { ChevronPulse(scope, scale) }
}

@Composable
internal fun PulseChevronIcon(
    imageVector: ImageVector,
    contentDescription: String,
    pulse: ChevronPulse,
    modifier: Modifier = Modifier
) {
    Icon(
        imageVector = imageVector,
        contentDescription = contentDescription,
        tint = Color.White,
        modifier = modifier
            .size(16.dp)
            .graphicsLayer {
                scaleX = pulse.value
                scaleY = pulse.value
                alpha = pulse.alpha
            }
    )
}
