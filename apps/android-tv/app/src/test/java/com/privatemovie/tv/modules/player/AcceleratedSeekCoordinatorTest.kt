package com.privatemovie.tv.modules.player

import com.privatemovie.tv.modules.player.internal.AcceleratedSeekCoordinator
import com.privatemovie.tv.modules.player.internal.NATIVE_KEYCODE_DPAD_LEFT
import com.privatemovie.tv.modules.player.internal.NATIVE_KEYCODE_DPAD_RIGHT
import com.privatemovie.tv.modules.player.internal.SeekDirection
import com.privatemovie.tv.modules.player.internal.SeekEvent
import com.privatemovie.tv.modules.player.internal.mapSeekDirection
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class AcceleratedSeekCoordinatorTest {

    private fun commitEvents(events: List<SeekEvent>): SeekEvent.CommitSeek =
        events.filterIsInstance<SeekEvent.CommitSeek>().first()

    private fun positionEvents(events: List<SeekEvent>): List<SeekEvent.ScrubPositionChanged> =
        events.filterIsInstance<SeekEvent.ScrubPositionChanged>()

    // --- key mapping ---

    @Test
    fun `dpad left and right map to scrub directions`() {
        assertEquals(SeekDirection.BACKWARD, mapSeekDirection(NATIVE_KEYCODE_DPAD_LEFT))
        assertEquals(SeekDirection.FORWARD, mapSeekDirection(NATIVE_KEYCODE_DPAD_RIGHT))
    }

    @Test
    fun `non seek keys do not map to a scrub direction`() {
        assertEquals(null, mapSeekDirection(66))
        assertEquals(null, mapSeekDirection(4))
    }

    // --- key down ---

    @Test
    fun `initial press starts the scrub without moving the position`() {
        val coordinator = AcceleratedSeekCoordinator()
        coordinator.controller.durationMs = 600_000L

        val events = coordinator.onKeyDown(
            direction = SeekDirection.FORWARD,
            repeatCount = 0,
            currentPositionMs = 100_000L,
            isPlaying = true
        )

        assertTrue(coordinator.isScrubbing)
        assertEquals(100_000L, coordinator.scrubbingPositionMs)
        assertEquals(1, positionEvents(events).size)
        assertEquals(100_000L, positionEvents(events).first().positionMs)
    }

    @Test
    fun `initial press does not pause playback before the first repeat`() {
        val coordinator = AcceleratedSeekCoordinator()

        val events = coordinator.onKeyDown(
            direction = SeekDirection.FORWARD,
            repeatCount = 0,
            currentPositionMs = 0L,
            isPlaying = true
        )

        assertTrue(events.none { it is SeekEvent.PausePlayback })
    }

    @Test
    fun `first repeat pauses playback and advances the virtual position`() {
        val coordinator = AcceleratedSeekCoordinator()
        coordinator.controller.durationMs = 600_000L

        coordinator.onKeyDown(SeekDirection.FORWARD, 0, 100_000L, isPlaying = true)
        val events = coordinator.onKeyDown(SeekDirection.FORWARD, 1, 100_000L, isPlaying = true)

        assertTrue(events.any { it is SeekEvent.PausePlayback })
        assertEquals(110_000L, positionEvents(events).last().positionMs)
    }

    @Test
    fun `paused playback is not paused again on repeats`() {
        val coordinator = AcceleratedSeekCoordinator()

        coordinator.onKeyDown(SeekDirection.FORWARD, 0, 0L, isPlaying = false)
        val events = coordinator.onKeyDown(SeekDirection.FORWARD, 1, 0L, isPlaying = false)

        assertTrue(events.none { it is SeekEvent.PausePlayback })
    }

    @Test
    fun `repeats accelerate across the tiers without committing a seek`() {
        val coordinator = AcceleratedSeekCoordinator()
        coordinator.controller.durationMs = 900_000L

        coordinator.onKeyDown(SeekDirection.FORWARD, 0, 100_000L, isPlaying = true)
        val tierOne = coordinator.onKeyDown(SeekDirection.FORWARD, 6, 100_000L, isPlaying = true)
        val tierTwo = coordinator.onKeyDown(SeekDirection.FORWARD, 16, 100_000L, isPlaying = true)
        val tierMax = coordinator.onKeyDown(SeekDirection.FORWARD, 31, 100_000L, isPlaying = true)

        assertEquals(130_000L, positionEvents(tierOne).last().positionMs)
        assertEquals(190_000L, positionEvents(tierTwo).last().positionMs)
        assertEquals(310_000L, positionEvents(tierMax).last().positionMs)
        assertTrue(listOf(tierOne, tierTwo, tierMax).none { it is SeekEvent.CommitSeek })
        assertTrue(coordinator.isScrubbing)
    }

    @Test
    fun `backward repeats subtract the tiered step`() {
        val coordinator = AcceleratedSeekCoordinator()
        coordinator.controller.durationMs = 600_000L

        coordinator.onKeyDown(SeekDirection.BACKWARD, 0, 100_000L, isPlaying = true)
        val events = coordinator.onKeyDown(SeekDirection.BACKWARD, 6, 100_000L, isPlaying = true)

        assertEquals(70_000L, positionEvents(events).last().positionMs)
    }

    // --- key up (commit) ---

    @Test
    fun `releasing the key commits the accumulated position`() {
        val coordinator = AcceleratedSeekCoordinator()
        coordinator.controller.durationMs = 600_000L

        coordinator.onKeyDown(SeekDirection.FORWARD, 0, 100_000L, isPlaying = true)
        coordinator.onKeyDown(SeekDirection.FORWARD, 6, 100_000L, isPlaying = true)
        val events = coordinator.onKeyUp(SeekDirection.FORWARD)

        val commit = commitEvents(events)
        assertEquals(130_000L, commit.positionMs)
        assertTrue(commit.resumePlayback)
        assertFalse(coordinator.isScrubbing)
    }

    @Test
    fun `single tap commits a ten second jump`() {
        val coordinator = AcceleratedSeekCoordinator()
        coordinator.controller.durationMs = 600_000L

        coordinator.onKeyDown(SeekDirection.FORWARD, 0, 100_000L, isPlaying = true)
        val events = coordinator.onKeyUp(SeekDirection.FORWARD)

        val commit = commitEvents(events)
        assertEquals(110_000L, commit.positionMs)
        assertTrue(commit.resumePlayback)
    }

    @Test
    fun `single backward tap commits a ten second jump`() {
        val coordinator = AcceleratedSeekCoordinator()
        coordinator.controller.durationMs = 600_000L

        coordinator.onKeyDown(SeekDirection.BACKWARD, 0, 100_000L, isPlaying = true)
        val events = coordinator.onKeyUp(SeekDirection.BACKWARD)

        assertEquals(90_000L, commitEvents(events).positionMs)
    }

    @Test
    fun `single tap clamps at the start of the media`() {
        val coordinator = AcceleratedSeekCoordinator()
        coordinator.controller.durationMs = 600_000L

        coordinator.onKeyDown(SeekDirection.BACKWARD, 0, 4_000L, isPlaying = true)
        val events = coordinator.onKeyUp(SeekDirection.BACKWARD)

        assertEquals(0L, commitEvents(events).positionMs)
    }

    @Test
    fun `single tap clamps at the end of the media`() {
        val coordinator = AcceleratedSeekCoordinator()
        coordinator.controller.durationMs = 60_000L

        coordinator.onKeyDown(SeekDirection.FORWARD, 0, 55_000L, isPlaying = true)
        val events = coordinator.onKeyUp(SeekDirection.FORWARD)

        assertEquals(60_000L, commitEvents(events).positionMs)
    }

    @Test
    fun `commit does not resume playback that was paused before the scrub`() {
        val coordinator = AcceleratedSeekCoordinator()

        coordinator.onKeyDown(SeekDirection.FORWARD, 0, 0L, isPlaying = false)
        val events = coordinator.onKeyUp(SeekDirection.FORWARD)

        assertFalse(commitEvents(events).resumePlayback)
    }

    @Test
    fun `releasing without an active scrub does nothing`() {
        val coordinator = AcceleratedSeekCoordinator()

        assertTrue(coordinator.onKeyUp(SeekDirection.FORWARD).isEmpty())
    }

    // --- debounced commit ---

    @Test
    fun `debounce commits the accumulated position after inactivity`() {
        val coordinator = AcceleratedSeekCoordinator(debounceMs = 400L)
        coordinator.controller.durationMs = 600_000L

        coordinator.onKeyDown(SeekDirection.FORWARD, 0, 100_000L, isPlaying = true)
        coordinator.onKeyDown(SeekDirection.FORWARD, 6, 100_000L, isPlaying = true)
        val events = coordinator.onDebounceElapsed()

        val commit = commitEvents(events)
        assertEquals(130_000L, commit.positionMs)
        assertTrue(commit.resumePlayback)
        assertFalse(coordinator.isScrubbing)
    }

    @Test
    fun `debounce without accumulated steps does not commit`() {
        val coordinator = AcceleratedSeekCoordinator(debounceMs = 400L)

        coordinator.onKeyDown(SeekDirection.FORWARD, 0, 100_000L, isPlaying = true)
        val events = coordinator.onDebounceElapsed()

        assertTrue(events.isEmpty())
        assertTrue(coordinator.isScrubbing)
    }

    @Test
    fun `debounce after a commit does nothing`() {
        val coordinator = AcceleratedSeekCoordinator(debounceMs = 400L)

        coordinator.onKeyDown(SeekDirection.FORWARD, 0, 100_000L, isPlaying = true)
        coordinator.onKeyUp(SeekDirection.FORWARD)

        assertTrue(coordinator.onDebounceElapsed().isEmpty())
    }

    @Test
    fun `a new press after a debounced commit restarts the scrub`() {
        val coordinator = AcceleratedSeekCoordinator(debounceMs = 400L)
        coordinator.controller.durationMs = 600_000L

        coordinator.onKeyDown(SeekDirection.FORWARD, 0, 100_000L, isPlaying = true)
        coordinator.onKeyDown(SeekDirection.FORWARD, 6, 100_000L, isPlaying = true)
        coordinator.onDebounceElapsed()

        coordinator.onKeyDown(SeekDirection.FORWARD, 0, 130_000L, isPlaying = true)
        val events = coordinator.onKeyDown(SeekDirection.FORWARD, 1, 130_000L, isPlaying = true)

        assertEquals(140_000L, positionEvents(events).last().positionMs)
    }
}
