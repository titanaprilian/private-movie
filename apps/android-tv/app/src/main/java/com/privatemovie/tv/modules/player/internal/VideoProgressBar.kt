package com.privatemovie.tv.modules.player.internal

import android.view.KeyEvent as AndroidKeyEvent
import androidx.compose.animation.core.animateDpAsState
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.focusable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.interaction.collectIsFocusedAsState
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.input.key.KeyEventType
import androidx.compose.ui.input.key.key
import androidx.compose.ui.input.key.nativeKeyCode
import androidx.compose.ui.input.key.onPreviewKeyEvent
import androidx.compose.ui.input.key.type
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

/**
 * YouTube TV style interactive video progress bar.
 *
 * Displays elapsed playback time, a focusable track with buffered and played
 * progress, and total duration. When focused via D-pad, the track expands,
 * highlights with a scrubber thumb, and accepts Left/Right keys to seek ±10s
 * and Center/OK to toggle play/pause.
 */
@Composable
fun VideoProgressBar(
    positionMs: Long,
    durationMs: Long,
    bufferedPositionMs: Long,
    onSeek: (Int) -> Unit,
    onTogglePlayPause: () -> Unit,
    modifier: Modifier = Modifier,
    interactionSource: MutableInteractionSource = remember { MutableInteractionSource() }
) {
    val isFocused by interactionSource.collectIsFocusedAsState()

    val safeDuration = durationMs.coerceAtLeast(0L)
    val safePosition = positionMs.coerceIn(0L, if (safeDuration > 0L) safeDuration else Long.MAX_VALUE)
    val safeBuffered = bufferedPositionMs.coerceIn(0L, if (safeDuration > 0L) safeDuration else Long.MAX_VALUE)

    val progressFraction = if (safeDuration > 0L) {
        (safePosition.toFloat() / safeDuration.toFloat()).coerceIn(0f, 1f)
    } else 0f

    val bufferedFraction = if (safeDuration > 0L) {
        (safeBuffered.toFloat() / safeDuration.toFloat()).coerceIn(0f, 1f)
    } else 0f

    val trackHeight by animateDpAsState(
        targetValue = if (isFocused) 10.dp else 4.dp,
        label = "trackHeight"
    )

    val thumbScale by animateFloatAsState(
        targetValue = if (isFocused) 1f else 0f,
        label = "thumbScale"
    )

    val positionText = remember(safePosition, safeDuration) {
        formatPlaybackTime(safePosition, referenceDurationMs = safeDuration)
    }
    val durationText = remember(safeDuration) {
        formatPlaybackTime(safeDuration, referenceDurationMs = safeDuration)
    }

    Row(
        modifier = modifier
            .fillMaxWidth()
            .focusable(interactionSource = interactionSource)
            .onPreviewKeyEvent { event ->
                if (event.type != KeyEventType.KeyUp) return@onPreviewKeyEvent false
                when (event.key.nativeKeyCode) {
                    AndroidKeyEvent.KEYCODE_DPAD_LEFT -> {
                        onSeek(-DEFAULT_SEEK_SECONDS)
                        true
                    }
                    AndroidKeyEvent.KEYCODE_DPAD_RIGHT -> {
                        onSeek(DEFAULT_SEEK_SECONDS)
                        true
                    }
                    AndroidKeyEvent.KEYCODE_DPAD_CENTER,
                    AndroidKeyEvent.KEYCODE_ENTER,
                    AndroidKeyEvent.KEYCODE_NUMPAD_ENTER -> {
                        onTogglePlayPause()
                        true
                    }
                    else -> false
                }
            }
            .padding(vertical = 8.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        // Current position timestamp
        Text(
            text = positionText,
            style = MaterialTheme.typography.labelMedium.copy(
                fontWeight = if (isFocused) FontWeight.Bold else FontWeight.Medium,
                fontSize = 14.sp
            ),
            color = if (isFocused) Color.White else Color.White.copy(alpha = 0.8f)
        )

        // Progress bar track container
        Box(
            modifier = Modifier
                .weight(1f)
                .height(24.dp),
            contentAlignment = Alignment.CenterStart
        ) {
            // Background track
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .height(trackHeight)
                    .clip(RoundedCornerShape(percent = 50))
                    .background(Color.White.copy(alpha = 0.24f))
            )

            // Buffered track
            if (bufferedFraction > 0f) {
                Box(
                    modifier = Modifier
                        .fillMaxWidth(bufferedFraction)
                        .height(trackHeight)
                        .clip(RoundedCornerShape(percent = 50))
                        .background(Color.White.copy(alpha = 0.45f))
                )
            }

            // Played progress track
            Box(
                modifier = Modifier
                    .fillMaxWidth(progressFraction)
                    .height(trackHeight)
                    .clip(RoundedCornerShape(percent = 50))
                    .background(MaterialTheme.colorScheme.primary)
            )

            // Scrubber Thumb (visible when focused)
            if (thumbScale > 0f) {
                Box(
                    modifier = Modifier
                        .fillMaxWidth(progressFraction)
                        .height(24.dp),
                    contentAlignment = Alignment.CenterEnd
                ) {
                    Box(
                        modifier = Modifier
                            .size(18.dp * thumbScale)
                            .clip(CircleShape)
                            .background(Color.White)
                            .border(2.dp, MaterialTheme.colorScheme.primary, CircleShape)
                    )
                }
            }
        }

        // Total duration timestamp
        Text(
            text = durationText,
            style = MaterialTheme.typography.labelMedium.copy(
                fontWeight = if (isFocused) FontWeight.Bold else FontWeight.Medium,
                fontSize = 14.sp
            ),
            color = if (isFocused) Color.White else Color.White.copy(alpha = 0.8f)
        )
    }
}
