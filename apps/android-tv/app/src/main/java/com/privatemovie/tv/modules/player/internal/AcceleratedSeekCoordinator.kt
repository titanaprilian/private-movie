package com.privatemovie.tv.modules.player.internal

/**
 * Coordinator for the accelerated hold-to-seek interaction on the Android TV player.
 *
 * The coordinator is intentionally free of Android and ExoPlayer dependencies so the
 * whole interaction (key mapping, virtual scrub accumulation, debounced commit) can be
 * unit-tested with plain JUnit.
 *
 * Interaction model:
 * - A `KeyDown` starts a *virtual* scrub: the target position is accumulated in memory
 *   and playback keeps running (no hardware seek is issued).
 * - Repeat `KeyDown` events (key repeat) accumulate tiered seek steps.
 * - The first accumulated step pauses playback (when it was playing) so the user can
 *   navigate the timeline without the video racing ahead.
 * - A `KeyUp` commits the accumulated position. When no step was accumulated (a plain
 *   tap), a standard 10 second jump is committed instead.
 * - A debounce window commits the accumulated position when the user stops pressing
 *   before releasing the key, so the seek is never lost.
 */

/** Debounce window (ms) after which an idle scrub is committed automatically. */
const val DEFAULT_SEEK_COMMIT_DEBOUNCE_MS = 400L

/** Standard single-tap seek step (ms). */
const val SINGLE_TAP_SEEK_STEP_MS = 10_000L

/** Mirrors `android.view.KeyEvent.KEYCODE_DPAD_LEFT` (kept local to stay framework-free). */
const val NATIVE_KEYCODE_DPAD_LEFT = 21

/** Mirrors `android.view.KeyEvent.KEYCODE_DPAD_RIGHT` (kept local to stay framework-free). */
const val NATIVE_KEYCODE_DPAD_RIGHT = 22

/**
 * Maps a native key code to the scrub direction it drives.
 *
 * Returns `null` for every key that is not a seek key.
 */
fun mapSeekDirection(nativeKeyCode: Int): SeekDirection? = when (nativeKeyCode) {
    NATIVE_KEYCODE_DPAD_LEFT -> SeekDirection.BACKWARD
    NATIVE_KEYCODE_DPAD_RIGHT -> SeekDirection.FORWARD
    else -> null
}

/**
 * Side effects the player shell has to apply for a coordinator interaction.
 */
sealed interface SeekEvent {
    /** Playback must be paused while the virtual scrub is active. */
    data object PausePlayback : SeekEvent

    /** The virtual scrub position changed and must be rendered. */
    data class ScrubPositionChanged(val positionMs: Long) : SeekEvent

    /**
     * The scrub ended and the position must be committed to the player.
     *
     * [resumePlayback] is true when playback was running when the scrub started.
     */
    data class CommitSeek(val positionMs: Long, val resumePlayback: Boolean) : SeekEvent
}

/**
 * Stateful, framework-free coordinator for accelerated hold-to-seek.
 *
 * Usage: feed key events through [onKeyDown] / [onKeyUp], and drive the debounce with
 * [onDebounceElapsed]. Every method returns the list of [SeekEvent]s the shell must apply.
 */
class AcceleratedSeekCoordinator(
    val debounceMs: Long = DEFAULT_SEEK_COMMIT_DEBOUNCE_MS,
    val singleTapStepMs: Long = SINGLE_TAP_SEEK_STEP_MS
) {

    /** Underlying virtual scrub state. */
    val controller: AcceleratedSeekController = AcceleratedSeekController()

    /** True while a virtual scrub is active. */
    val isScrubbing: Boolean get() = controller.isScrubbing

    /** Current virtual scrub position (milliseconds). */
    val scrubbingPositionMs: Long get() = controller.scrubbingPositionMs

    private var hasAccumulatedStep: Boolean = false

    /**
     * Handles a seek key press (or key repeat).
     *
     * [repeatCount] is the platform repeat counter: `0` for the initial press, growing
     * while the key is held down.
     */
    fun onKeyDown(
        direction: SeekDirection,
        repeatCount: Int,
        currentPositionMs: Long,
        isPlaying: Boolean
    ): List<SeekEvent> {
        val events = mutableListOf<SeekEvent>()

        if (!controller.isScrubbing) {
            controller.startScrub(currentPositionMs, isPlaying)
            hasAccumulatedStep = false
            events += SeekEvent.ScrubPositionChanged(controller.scrubbingPositionMs)
            if (repeatCount <= 0) {
                // Initial press only: the position is unchanged until the first repeat.
                return events
            }
        }

        if (!hasAccumulatedStep && controller.wasPlaying) {
            events += SeekEvent.PausePlayback
        }

        val positionMs = controller.onRepeat(direction, repeatCount)
        hasAccumulatedStep = true
        events += SeekEvent.ScrubPositionChanged(positionMs)
        return events
    }

    /**
     * Handles the release of a seek key and commits the scrub.
     *
     * When no step was accumulated (a plain tap), a standard [singleTapStepMs] jump is
     * committed instead of the unchanged virtual position.
     */
    fun onKeyUp(direction: SeekDirection?): List<SeekEvent> {
        if (!controller.isScrubbing) return emptyList()

        val resumePlayback = controller.wasPlaying
        val targetMs = if (hasAccumulatedStep) {
            controller.scrubbingPositionMs
        } else {
            val deltaMs = if (direction == SeekDirection.FORWARD) singleTapStepMs else -singleTapStepMs
            clampPosition(controller.scrubbingPositionMs + deltaMs)
        }

        controller.commit()
        hasAccumulatedStep = false

        return listOf(SeekEvent.CommitSeek(targetMs, resumePlayback))
    }

    /**
     * Handles the debounce timeout: commits the scrub when the user stopped pressing
     * the key. A scrub without any accumulated step is kept open (nothing to commit).
     */
    fun onDebounceElapsed(): List<SeekEvent> {
        if (!controller.isScrubbing) return emptyList()
        if (!hasAccumulatedStep) return emptyList()

        val resumePlayback = controller.wasPlaying
        val targetMs = controller.scrubbingPositionMs
        controller.commit()
        hasAccumulatedStep = false

        return listOf(SeekEvent.CommitSeek(targetMs, resumePlayback))
    }

    private fun clampPosition(positionMs: Long): Long {
        val safe = positionMs.coerceAtLeast(0L)
        val duration = controller.durationMs
        return if (duration > 0L) safe.coerceAtMost(duration) else safe
    }
}
