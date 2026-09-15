package com.privatemovie.tv.modules.player

import com.privatemovie.tv.modules.player.internal.calculateClampedSeekPosition
import com.privatemovie.tv.modules.player.internal.formatPlaybackTime
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class VideoProgressBarTest {

    @Test
    fun `progress fraction calculations are properly bounded`() {
        val durationMs = 100_000L

        fun computeFraction(pos: Long, dur: Long): Float {
            val safeDuration = dur.coerceAtLeast(0L)
            val safePosition = pos.coerceIn(0L, if (safeDuration > 0L) safeDuration else Long.MAX_VALUE)
            return if (safeDuration > 0L) {
                (safePosition.toFloat() / safeDuration.toFloat()).coerceIn(0f, 1f)
            } else 0f
        }

        assertEquals(0f, computeFraction(0L, durationMs), 0.001f)
        assertEquals(0.5f, computeFraction(50_000L, durationMs), 0.001f)
        assertEquals(1.0f, computeFraction(100_000L, durationMs), 0.001f)
        assertEquals(1.0f, computeFraction(150_000L, durationMs), 0.001f)
        assertEquals(0f, computeFraction(-5_000L, durationMs), 0.001f)
        assertEquals(0f, computeFraction(50_000L, 0L), 0.001f)
    }

    @Test
    fun `time formatting for progress bar timestamps matches expected display`() {
        val currentMs = 125_000L // 2 min 5 sec
        val totalMs = 3_665_000L // 1 hr 1 min 5 sec

        assertEquals("00:02:05", formatPlaybackTime(currentMs, referenceDurationMs = totalMs))
        assertEquals("01:01:05", formatPlaybackTime(totalMs, referenceDurationMs = totalMs))
    }

    @Test
    fun `seeking interactions correctly clamp at start and end boundaries`() {
        val duration = 60_000L

        // Seek backward 10s from 4s -> clamps to 0
        assertEquals(0L, calculateClampedSeekPosition(4_000L, -10, duration))

        // Seek forward 10s from 55s -> clamps to 60000
        assertEquals(60_000L, calculateClampedSeekPosition(55_000L, 10, duration))

        // Normal backward seek
        assertEquals(20_000L, calculateClampedSeekPosition(30_000L, -10, duration))

        // Normal forward seek
        assertEquals(40_000L, calculateClampedSeekPosition(30_000L, 10, duration))
    }
}
