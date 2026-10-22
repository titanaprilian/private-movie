package com.privatemovie.tv.modules.player

import com.privatemovie.tv.modules.player.internal.AcceleratedSeekController
import com.privatemovie.tv.modules.player.internal.SeekDirection
import com.privatemovie.tv.modules.player.internal.calculateAcceleratedSeekStep
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class AcceleratedSeekTest {

    // --- calculateAcceleratedSeekStep tiers ---

    @Test
    fun `base tier returns 10 seconds for repeats 0 through 5`() {
        for (repeat in 0..5) {
            assertEquals(10_000L, calculateAcceleratedSeekStep(repeat))
        }
    }

    @Test
    fun `tier one returns 30 seconds for repeats 6 through 15`() {
        for (repeat in 6..15) {
            assertEquals(30_000L, calculateAcceleratedSeekStep(repeat))
        }
    }

    @Test
    fun `tier two returns 60 seconds for repeats 16 through 30`() {
        for (repeat in 16..30) {
            assertEquals(60_000L, calculateAcceleratedSeekStep(repeat))
        }
    }

    @Test
    fun `max tier returns 120 seconds above 30 repeats`() {
        assertEquals(120_000L, calculateAcceleratedSeekStep(31))
        assertEquals(120_000L, calculateAcceleratedSeekStep(100))
    }

    @Test
    fun `negative repeat counts fall back to the base tier`() {
        assertEquals(10_000L, calculateAcceleratedSeekStep(-1))
    }

    // --- AcceleratedSeekController lifecycle ---

    @Test
    fun `start scrub records initial position and playing state`() {
        val controller = AcceleratedSeekController()
        controller.startScrub(initialPositionMs = 30_000L, isCurrentlyPlaying = true)

        assertTrue(controller.isScrubbing)
        assertEquals(30_000L, controller.scrubbingPositionMs)
        assertTrue(controller.wasPlaying)
        assertEquals(0, controller.repeatCount)
        assertNull(controller.direction)
    }

    @Test
    fun `start scrub records paused playback state`() {
        val controller = AcceleratedSeekController()
        controller.startScrub(initialPositionMs = 5_000L, isCurrentlyPlaying = false)

        assertFalse(controller.wasPlaying)
        assertEquals(5_000L, controller.scrubbingPositionMs)
    }

    @Test
    fun `forward repeats accumulate the tiered step`() {
        val controller = AcceleratedSeekController(durationMs = 600_000L)
        controller.startScrub(initialPositionMs = 100_000L, isCurrentlyPlaying = true)

        assertEquals(110_000L, controller.onRepeat(SeekDirection.FORWARD, repeatCount = 0))
        assertEquals(140_000L, controller.onRepeat(SeekDirection.FORWARD, repeatCount = 6))
        assertEquals(200_000L, controller.onRepeat(SeekDirection.FORWARD, repeatCount = 16))
        assertEquals(320_000L, controller.onRepeat(SeekDirection.FORWARD, repeatCount = 31))
        assertEquals(320_000L, controller.scrubbingPositionMs)
        assertEquals(SeekDirection.FORWARD, controller.direction)
        assertEquals(31, controller.repeatCount)
    }

    @Test
    fun `backward repeats subtract the tiered step`() {
        val controller = AcceleratedSeekController(durationMs = 600_000L)
        controller.startScrub(initialPositionMs = 100_000L, isCurrentlyPlaying = true)

        assertEquals(90_000L, controller.onRepeat(SeekDirection.BACKWARD, repeatCount = 0))
        assertEquals(60_000L, controller.onRepeat(SeekDirection.BACKWARD, repeatCount = 6))
    }

    @Test
    fun `scrub position clamps to zero at the lower bound`() {
        val controller = AcceleratedSeekController(durationMs = 600_000L)
        controller.startScrub(initialPositionMs = 5_000L, isCurrentlyPlaying = true)

        assertEquals(0L, controller.onRepeat(SeekDirection.BACKWARD, repeatCount = 0))
        assertEquals(0L, controller.scrubbingPositionMs)
    }

    @Test
    fun `scrub position clamps to duration at the upper bound`() {
        val controller = AcceleratedSeekController(durationMs = 120_000L)
        controller.startScrub(initialPositionMs = 100_000L, isCurrentlyPlaying = true)

        assertEquals(120_000L, controller.onRepeat(SeekDirection.FORWARD, repeatCount = 16))
        assertEquals(120_000L, controller.scrubbingPositionMs)
    }

    @Test
    fun `unknown duration clamps only at the lower bound`() {
        val controller = AcceleratedSeekController(durationMs = 0L)
        controller.startScrub(initialPositionMs = 1_000L, isCurrentlyPlaying = true)

        assertEquals(0L, controller.onRepeat(SeekDirection.BACKWARD, repeatCount = 0))
        assertEquals(10_000L, controller.onRepeat(SeekDirection.FORWARD, repeatCount = 0))
    }

    @Test
    fun `commit returns the scrubbed position and ends the scrub`() {
        val controller = AcceleratedSeekController(durationMs = 600_000L)
        controller.startScrub(initialPositionMs = 100_000L, isCurrentlyPlaying = true)
        controller.onRepeat(SeekDirection.FORWARD, repeatCount = 6)

        assertEquals(130_000L, controller.commit())
        assertFalse(controller.isScrubbing)
        assertEquals(0, controller.repeatCount)
    }

    @Test
    fun `commit keeps the original playing state for consumers to resume`() {
        val controller = AcceleratedSeekController(durationMs = 600_000L)
        controller.startScrub(initialPositionMs = 100_000L, isCurrentlyPlaying = true)
        controller.commit()

        assertTrue(controller.wasPlaying)
    }

    @Test
    fun `cancel restores the initial position and ends the scrub`() {
        val controller = AcceleratedSeekController(durationMs = 600_000L)
        controller.startScrub(initialPositionMs = 100_000L, isCurrentlyPlaying = true)
        controller.onRepeat(SeekDirection.FORWARD, repeatCount = 6)

        controller.cancel()

        assertFalse(controller.isScrubbing)
        assertEquals(100_000L, controller.scrubbingPositionMs)
        assertEquals(0, controller.repeatCount)
        assertNull(controller.direction)
    }

    @Test
    fun `repeats before a scrub starts are ignored`() {
        val controller = AcceleratedSeekController(durationMs = 600_000L)

        assertEquals(0L, controller.onRepeat(SeekDirection.FORWARD, repeatCount = 0))
        assertFalse(controller.isScrubbing)
        assertEquals(0L, controller.scrubbingPositionMs)
    }
}
