package com.privatemovie.tv.modules.player

import com.privatemovie.tv.modules.player.internal.PlaybackCompletionDecision
import com.privatemovie.tv.modules.player.internal.calculateClampedSeekPosition
import com.privatemovie.tv.modules.player.internal.formatPlaybackTime
import com.privatemovie.tv.modules.player.internal.onPlaybackEnded
import org.junit.Assert.assertEquals
import org.junit.Test

class PlayerTimeAndSeekingTest {

    @Test
    fun `formatPlaybackTime formats seconds and minutes correctly`() {
        assertEquals("00:00", formatPlaybackTime(0L))
        assertEquals("00:05", formatPlaybackTime(5_000L))
        assertEquals("00:59", formatPlaybackTime(59_000L))
        assertEquals("01:00", formatPlaybackTime(60_000L))
        assertEquals("04:15", formatPlaybackTime(255_000L))
        assertEquals("59:59", formatPlaybackTime(3599_000L))
    }

    @Test
    fun `formatPlaybackTime formats hours correctly when total duration or time exceeds one hour`() {
        assertEquals("01:00:00", formatPlaybackTime(3600_000L))
        assertEquals("01:15:30", formatPlaybackTime(4530_000L))
        assertEquals("10:05:01", formatPlaybackTime(36301_000L))
    }

    @Test
    fun `formatPlaybackTime handles negative or zero gracefully`() {
        assertEquals("00:00", formatPlaybackTime(-5000L))
    }

    @Test
    fun `formatPlaybackTime with referenceDurationMs enforces hour format if duration has hours`() {
        // If reference duration is 1 hour 10 mins, even 0ms should format as "00:00:00" or "0:00:00" / "00:00:00"
        val oneHourDuration = 3600_000L
        assertEquals("00:00:00", formatPlaybackTime(0L, referenceDurationMs = oneHourDuration))
        assertEquals("00:04:15", formatPlaybackTime(255_000L, referenceDurationMs = oneHourDuration))
        assertEquals("01:00:00", formatPlaybackTime(3600_000L, referenceDurationMs = oneHourDuration))
    }

    @Test
    fun `calculateClampedSeekPosition backward clamps to 0 when near beginning`() {
        val durationMs = 120_000L // 2 mins

        // Seeking backward 10s from 5s should clamp to 0
        assertEquals(0L, calculateClampedSeekPosition(currentPositionMs = 5_000L, deltaSeconds = -10, durationMs = durationMs))

        // Seeking backward 10s from 0s should clamp to 0
        assertEquals(0L, calculateClampedSeekPosition(currentPositionMs = 0L, deltaSeconds = -10, durationMs = durationMs))

        // Seeking backward 10s from 25s should yield 15s
        assertEquals(15_000L, calculateClampedSeekPosition(currentPositionMs = 25_000L, deltaSeconds = -10, durationMs = durationMs))
    }

    @Test
    fun `calculateClampedSeekPosition forward clamps to duration when near end`() {
        val durationMs = 100_000L

        // Seeking forward 10s from 95s should clamp to 100s
        assertEquals(100_000L, calculateClampedSeekPosition(currentPositionMs = 95_000L, deltaSeconds = 10, durationMs = durationMs))

        // Seeking forward 10s from 100s should clamp to 100s
        assertEquals(100_000L, calculateClampedSeekPosition(currentPositionMs = 100_000L, deltaSeconds = 10, durationMs = durationMs))

        // Seeking forward 10s from 50s should yield 60s
        assertEquals(60_000L, calculateClampedSeekPosition(currentPositionMs = 50_000L, deltaSeconds = 10, durationMs = durationMs))
    }

    @Test
    fun `calculateClampedSeekPosition handles unknown or non-positive duration`() {
        // If duration is unknown (e.g. 0L or negative), clamp to min 0L
        assertEquals(0L, calculateClampedSeekPosition(currentPositionMs = 5_000L, deltaSeconds = -10, durationMs = 0L))
        assertEquals(15_000L, calculateClampedSeekPosition(currentPositionMs = 5_000L, deltaSeconds = 10, durationMs = 0L))
    }

    @Test
    fun `onPlaybackEnded returns AdvanceToNext when hasNext is true`() {
        assertEquals(PlaybackCompletionDecision.AdvanceToNext, onPlaybackEnded(hasNext = true))
    }

    @Test
    fun `onPlaybackEnded returns ExitPlayer when hasNext is false`() {
        assertEquals(PlaybackCompletionDecision.ExitPlayer, onPlaybackEnded(hasNext = false))
    }
}
