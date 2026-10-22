package com.privatemovie.tv.modules.player.internal

/**
 * Pure accelerated-seek logic for the Android TV player.
 *
 * Holding a seek key accelerates the seek step across four tiers. While the key is
 * held, the player runs a *virtual* scrub: the target position is accumulated in
 * memory instead of issuing one hardware seek per repeat, and the final position is
 * committed once the key is released.
 *
 * No Android or ExoPlayer dependencies, so the logic is fully unit-testable with
 * plain JUnit.
 */

/** Direction of a virtual scrub step. */
enum class SeekDirection {
    /** Seek towards the end of the media. */
    FORWARD,

    /** Seek towards the beginning of the media. */
    BACKWARD,
}

/** Base tier step (repeats 0-5). */
const val ACCELERATED_SEEK_BASE_STEP_MS = 10_000L

/** Tier one step (repeats 6-15). */
const val ACCELERATED_SEEK_TIER_ONE_STEP_MS = 30_000L

/** Tier two step (repeats 16-30). */
const val ACCELERATED_SEEK_TIER_TWO_STEP_MS = 60_000L

/** Maximum tier step (repeats above 30). */
const val ACCELERATED_SEEK_MAX_STEP_MS = 120_000L

/**
 * Calculates the seek step (in milliseconds) for the given hold-repeat count.
 *
 * Tiers:
 * - repeats 0-5: 10 seconds
 * - repeats 6-15: 30 seconds
 * - repeats 16-30: 60 seconds
 * - repeats above 30: 120 seconds
 */
fun calculateAcceleratedSeekStep(repeatCount: Int): Long = when {
    repeatCount <= 5 -> ACCELERATED_SEEK_BASE_STEP_MS
    repeatCount <= 15 -> ACCELERATED_SEEK_TIER_ONE_STEP_MS
    repeatCount <= 30 -> ACCELERATED_SEEK_TIER_TWO_STEP_MS
    else -> ACCELERATED_SEEK_MAX_STEP_MS
}

/**
 * State holder for a virtual accelerated scrub.
 *
 * Consumers pause playback while the scrub is active and apply the committed
 * position (and optionally resume playback) when the key is released.
 */
class AcceleratedSeekController(durationMs: Long = 0L) {

    /** Total media duration in milliseconds; non-positive means "unknown". */
    var durationMs: Long = durationMs
        set(value) {
            field = value
            if (isScrubbing) {
                scrubbingPositionMs = clampToBounds(scrubbingPositionMs)
            }
        }

    /** True while a virtual scrub is in progress. */
    var isScrubbing: Boolean = false
        private set

    /** Current virtual scrub position in milliseconds. */
    var scrubbingPositionMs: Long = 0L
        private set

    /** Direction of the most recent scrub step, or null when no step happened yet. */
    var direction: SeekDirection? = null
        private set

    /** Repeat count of the most recent scrub step. */
    var repeatCount: Int = 0
        private set

    /**
     * Whether playback was active when the scrub started.
     *
     * Consumers pause during the scrub and resume on commit only when this is true.
     */
    var wasPlaying: Boolean = false
        private set

    private var initialPositionMs: Long = 0L

    /**
     * Starts a virtual scrub at [initialPositionMs].
     *
     * [isCurrentlyPlaying] is captured so consumers can pause during the scrub and
     * resume playback after a successful commit.
     */
    fun startScrub(initialPositionMs: Long, isCurrentlyPlaying: Boolean) {
        this.initialPositionMs = initialPositionMs
        this.wasPlaying = isCurrentlyPlaying
        this.scrubbingPositionMs = clampToBounds(initialPositionMs)
        this.direction = null
        this.repeatCount = 0
        this.isScrubbing = true
    }

    /**
     * Accumulates one accelerated seek step and returns the new scrub position.
     *
     * Returns 0L when no scrub is active. The position is clamped to `0L` and to
     * [durationMs] when the duration is known.
     */
    fun onRepeat(direction: SeekDirection, repeatCount: Int): Long {
        if (!isScrubbing) return 0L
        this.direction = direction
        this.repeatCount = repeatCount
        val stepMs = calculateAcceleratedSeekStep(repeatCount)
        val deltaMs = if (direction == SeekDirection.FORWARD) stepMs else -stepMs
        scrubbingPositionMs = clampToBounds(scrubbingPositionMs + deltaMs)
        return scrubbingPositionMs
    }

    /**
     * Ends the scrub and returns the position the consumer should seek to.
     */
    fun commit(): Long {
        val position = scrubbingPositionMs
        isScrubbing = false
        direction = null
        repeatCount = 0
        return position
    }

    /**
     * Ends the scrub and discards the accumulated position.
     */
    fun cancel() {
        isScrubbing = false
        scrubbingPositionMs = initialPositionMs
        direction = null
        repeatCount = 0
    }

    private fun clampToBounds(positionMs: Long): Long {
        val safe = positionMs.coerceAtLeast(0L)
        return if (durationMs > 0L) safe.coerceAtMost(durationMs) else safe
    }
}
