package com.privatemovie.tv.modules.player.internal

import com.privatemovie.tv.dto.models.VideoSource
import com.privatemovie.tv.modules.player.PlaybackCompletionDecision
import com.privatemovie.tv.modules.player.PlayerControlAction
import com.privatemovie.tv.modules.player.DEFAULT_SEEK_SECONDS

/**
 * Internal player-shell logic for the dedicated Android TV player screen.
 *
 * Pure Kotlin with no Android framework dependencies so unit tests can verify
 * control-intent behavior without depending on third-party embed DOM details.
 * The Compose [PlayerScreen] public seam maps Android key events and transport
 * buttons into these intents and renders the resolved [PlaybackRenderer].
 */

/** Client-consumable playback renderer for a normalized playback target. */
enum class PlaybackRenderer {
    /** Direct stream targets and S3 storage targets use the native Android playback stack. */
    NATIVE,
}

/** Remote-control keys covered by the MVP contract at the app boundary. */
enum class RemoteControlKey {
    /** D-pad center / OK / Enter: primary playback interaction. */
    CENTER_OK,

    /** Back: dismiss controls overlay when visible, exit playback when hidden. */
    BACK,

    /** D-pad left: focus navigation across transport buttons. */
    LEFT,

    /** D-pad right: focus navigation across transport buttons. */
    RIGHT,

    /** Dedicated play/pause media key when available. */
    PLAY_PAUSE,

    /** Dedicated fast-forward media key when available. */
    FAST_FORWARD,

    /** Dedicated rewind media key when available. */
    REWIND,

    /** D-pad up: vertical navigation or revealing overlay when hidden. */
    UP,

    /** D-pad down: vertical navigation or revealing overlay when hidden. */
    DOWN,
}

const val DEFAULT_CONTROLS_TIMEOUT_MS = 3500L
const val DEFAULT_EXIT_CONFIRM_TIMEOUT_MS = 2500L

/**
 * Calculates a clamped target playback position in milliseconds.
 *
 * Clamps backward seeks to minimum 0L, and forward seeks to [durationMs] (if positive).
 */
fun calculateClampedSeekPosition(
    currentPositionMs: Long,
    deltaSeconds: Int,
    durationMs: Long
): Long {
    val deltaMs = deltaSeconds * 1000L
    val targetMs = currentPositionMs + deltaMs
    val minMs = 0L
    return if (durationMs > 0L) {
        targetMs.coerceIn(minMs, durationMs)
    } else {
        targetMs.coerceAtLeast(minMs)
    }
}

/**
 * Formats a timestamp duration in milliseconds to `mm:ss` or `hh:mm:ss`.
 *
 * If [referenceDurationMs] (e.g. video duration) is 1 hour or greater, or if [positionMs]
 * is 1 hour or greater, formats as `hh:mm:ss`. Otherwise formats as `mm:ss`.
 */
fun formatPlaybackTime(
    positionMs: Long,
    referenceDurationMs: Long = 0L
): String {
    val safePos = positionMs.coerceAtLeast(0L)
    val totalSeconds = safePos / 1000L
    val hours = totalSeconds / 3600L
    val minutes = (totalSeconds % 3600L) / 60L
    val seconds = totalSeconds % 60L

    val refTotalSeconds = referenceDurationMs.coerceAtLeast(0L) / 1000L
    val showHours = hours > 0L || refTotalSeconds >= 3600L

    return if (showHours) {
        String.format(java.util.Locale.US, "%02d:%02d:%02d", hours, minutes, seconds)
    } else {
        String.format(java.util.Locale.US, "%02d:%02d", minutes, seconds)
    }
}

/**
 * Pure decision function determining player response upon reaching end-of-stream.
 */
fun onPlaybackEnded(hasNext: Boolean): PlaybackCompletionDecision =
    if (hasNext) PlaybackCompletionDecision.AdvanceToNext else PlaybackCompletionDecision.ExitPlayer

/**
 * State holder for player controls overlay visibility and auto-hide scheduling.
 */
class PlayerControlsState(
    initialVisible: Boolean = true,
    val timeoutMs: Long = DEFAULT_CONTROLS_TIMEOUT_MS
) {
    var isVisible: Boolean = initialVisible
        private set

    var activityNonce: Long = 0L
        private set

    /**
     * Determines whether the inactivity auto-hide countdown should tick.
     * When playback is paused or overlay is hidden, auto-hide should be paused.
     */
    fun shouldAutoHide(isPlaying: Boolean): Boolean = isVisible && isPlaying

    fun show() {
        isVisible = true
        activityNonce++
    }

    fun hide() {
        isVisible = false
    }

    fun resetTimeout() {
        activityNonce++
    }

    fun onAction(action: PlayerControlAction) {
        when (action) {
            is PlayerControlAction.ShowControls -> show()
            is PlayerControlAction.HideControls -> hide()
            is PlayerControlAction.TogglePlayPause,
            is PlayerControlAction.SeekBackward,
            is PlayerControlAction.SeekForward -> {
                isVisible = true
                resetTimeout()
            }
            is PlayerControlAction.ExitPlayer,
            is PlayerControlAction.ShowExitConfirmation,
            is PlayerControlAction.DismissExitConfirmation,
            is PlayerControlAction.RequestFullscreen -> Unit
        }
    }
}

/**
 * Pure transition logic determining next controls overlay visibility given
 * current visibility state and an action.
 */
fun nextControlsVisibility(
    currentVisible: Boolean,
    action: PlayerControlAction
): Boolean =
    when (action) {
        is PlayerControlAction.ShowControls,
        is PlayerControlAction.TogglePlayPause,
        is PlayerControlAction.SeekBackward,
        is PlayerControlAction.SeekForward -> true
        is PlayerControlAction.HideControls -> false
        is PlayerControlAction.ExitPlayer,
        is PlayerControlAction.ShowExitConfirmation,
        is PlayerControlAction.DismissExitConfirmation,
        is PlayerControlAction.RequestFullscreen -> currentVisible
    }

/**
 * Chooses the renderer for a normalized [VideoSource] playback target.
 * Direct and S3 targets use native playback.
 */
fun resolveRenderer(sourceType: VideoSource.Type): PlaybackRenderer = PlaybackRenderer.NATIVE

/**
 * Chooses the renderer from a raw contract type name. All supported targets
 * use native playback via ExoPlayer.
 */
fun resolveRendererForTypeName(typeName: String?): PlaybackRenderer = PlaybackRenderer.NATIVE

/**
 * Whether the renderer attempts seek for left/right intents. Native seeking is platform-supported.
 */
fun supportsSeek(renderer: PlaybackRenderer): Boolean = true

/** The player shell auto-attempts fullscreen on entry (TV-only dedicated flow). */
fun shouldAutoFullscreenOnEntry(): Boolean = true

/**
 * Exit guard suppressing the "Playback unavailable" flash on player teardown.
 *
 * Once exit is initiated, failure UI must no longer render (route args and
 * player callbacks may go stale during the pop transition). [tryExit]
 * returns true only for the first exit request so [onExitPlayer] fires once.
 */
class PlayerExitGuard {
    var isExiting: Boolean = false
        private set

    fun tryExit(): Boolean {
        if (isExiting) return false
        isExiting = true
        return true
    }

    /** Whether failure UI ("Playback unavailable") may render. */
    fun shouldShowFailure(): Boolean = !isExiting
}

/**
 * Teardown guard for the native player surface.
 *
 * Listeners are detached before `player.release()`; any error callback still
 * racing through release is suppressed via [shouldDispatchError] so teardown
 * noise never reaches the shell's error UI.
 */
class PlayerTeardownGuard {
    var isDisposing: Boolean = false
        private set

    fun markDisposing() {
        isDisposing = true
    }

    /** Whether an error callback should be dispatched to the shell. */
    fun shouldDispatchError(): Boolean = !isDisposing
}

/**
 * Focus target owning D-pad focus in the player shell.
 */
enum class PlayerFocusTarget {
    /** Central Play/Pause transport button (controls overlay visible). */
    PLAY_PAUSE_BUTTON,

    /** Player background container intercepting remote keys (controls hidden). */
    PLAYER_CONTAINER,
}

/**
 * Resolves which focus target should own D-pad focus for the given
 * controls-overlay visibility. Visible controls focus Play/Pause (including
 * while the stream is still loading); hidden controls focus the container
 * so remote keys are still intercepted.
 */
fun resolvePlayerFocusTarget(controlsVisible: Boolean): PlayerFocusTarget =
    if (controlsVisible) PlayerFocusTarget.PLAY_PAUSE_BUTTON else PlayerFocusTarget.PLAYER_CONTAINER

/**
 * State holder for player focus placement and restoration.
 *
 * On entry with visible controls, Play/Pause takes initial focus immediately.
 * When controls auto-hide, focus transfers to the player container; when
 * controls reappear on D-pad interaction, focus returns to Play/Pause.
 * [focusRequestNonce] bumps on every transition so Compose effects re-run
 * the resilient focus request even when the target is unchanged.
 */
class PlayerFocusState(
    initialTarget: PlayerFocusTarget = PlayerFocusTarget.PLAY_PAUSE_BUTTON
) {
    var currentTarget: PlayerFocusTarget = initialTarget
        private set

    var focusRequestNonce: Long = 0L
        private set

    fun onEntry(controlsVisible: Boolean): PlayerFocusTarget =
        transition(resolvePlayerFocusTarget(controlsVisible))

    fun onControlsVisibilityChanged(controlsVisible: Boolean): PlayerFocusTarget =
        transition(resolvePlayerFocusTarget(controlsVisible))

    private fun transition(target: PlayerFocusTarget): PlayerFocusTarget {
        currentTarget = target
        focusRequestNonce++
        return target
    }
}

/**
 * Declarative actions dispatched automatically when entering the player
 * screen for the given [renderer]. Currently a single fullscreen attempt.
 */
fun initialActionsOnEntry(renderer: PlaybackRenderer): List<PlayerControlAction> =
    listOf(PlayerControlAction.RequestFullscreen)

/**
 * Resolves a normalized playback target URL into a loadable absolute URL.
 *
 * Backend-normalized embed targets may be origin-relative (e.g. `/embed/{hash}`
 * for videobello embeds); those are joined onto [backendBaseUrl]. Absolute
 * URLs pass through untouched. Returns null when there is no target to play.
 */
fun resolvePlaybackUrl(rawUrl: String?, backendBaseUrl: String?): String? {
    if (rawUrl.isNullOrBlank()) return null
    val trimmed = rawUrl.trim()
    if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) return trimmed
    if (trimmed.startsWith("/") && !backendBaseUrl.isNullOrBlank()) {
        return backendBaseUrl.trim().trimEnd('/') + trimmed
    }
    return trimmed
}

/**
 * State holder for the double-Back exit confirmation flow.
 *
 * When transport controls are hidden, the first Back press arms a confirmation
 * window (showing the floating prompt) instead of exiting. A second Back press
 * while armed exits playback. If the timeout elapses, the prompt dismisses and
 * the state resets.
 */
class DoubleBackExitState(
    val timeoutMs: Long = DEFAULT_EXIT_CONFIRM_TIMEOUT_MS
) {
    var isConfirmationActive: Boolean = false
        private set

    var confirmationNonce: Long = 0L
        private set

    /** Whether the floating exit prompt should be visible. */
    val showPrompt: Boolean get() = isConfirmationActive

    /**
     * Handles a Back press given [controlsVisible].
     * Returns HideControls when controls are visible (prompt never armed),
     * ShowExitConfirmation on first press while hidden, ExitPlayer on second
     * press within the window.
     */
    fun onBackPressed(controlsVisible: Boolean): PlayerControlAction {
        if (controlsVisible) {
            return PlayerControlAction.HideControls
        }
        return if (isConfirmationActive) {
            PlayerControlAction.ExitPlayer
        } else {
            isConfirmationActive = true
            confirmationNonce++
            PlayerControlAction.ShowExitConfirmation
        }
    }

    /** Dismisses the prompt after the timeout elapses and resets the window. */
    fun onTimeoutElapsed() {
        isConfirmationActive = false
    }

    /** Explicit dismissal (same as timeout). */
    fun dismiss() {
        isConfirmationActive = false
    }

    fun onAction(action: PlayerControlAction) {
        when (action) {
            is PlayerControlAction.ShowExitConfirmation -> {
                isConfirmationActive = true
                confirmationNonce++
            }
            is PlayerControlAction.DismissExitConfirmation -> dismiss()
            is PlayerControlAction.ExitPlayer,
            is PlayerControlAction.HideControls -> dismiss()
            else -> Unit
        }
    }
}

/**
 * Maps an MVP remote-control [key] to its declarative [PlayerControlAction]
 * for the active [renderer] and [controlsVisible] state.
 *
 * Rules:
 * 1. Dedicated physical hardware media keys (PLAY_PAUSE, FAST_FORWARD, REWIND) execute immediate
 *    playback actions regardless of overlay visibility.
 * 2. When controls overlay is visible:
 *    - Back key dismisses the overlay (HideControls) so playback continues unobstructed.
 *    - D-pad navigation keys (LEFT, RIGHT, UP, DOWN) and CENTER_OK refresh inactivity timeout (ShowControls).
 *      D-pad Left/Right does NOT trigger immediate seeks; focus traversal moves across transport buttons.
 * 3. When controls overlay is hidden:
 *    - First Back press arms exit confirmation (ShowExitConfirmation); a second Back press
 *      while [exitConfirmationActive] exits playback (ExitPlayer).
 *    - Any D-pad/OK interaction reveals the controls overlay (ShowControls) and focuses center Play/Pause.
 */
fun handleRemoteKey(
    key: RemoteControlKey,
    renderer: PlaybackRenderer,
    controlsVisible: Boolean = true,
    exitConfirmationActive: Boolean = false
): PlayerControlAction {
    when (key) {
        RemoteControlKey.PLAY_PAUSE -> return PlayerControlAction.TogglePlayPause
        RemoteControlKey.FAST_FORWARD -> return PlayerControlAction.SeekForward()
        RemoteControlKey.REWIND -> return PlayerControlAction.SeekBackward()
        else -> Unit
    }

    if (!controlsVisible) {
        return when (key) {
            RemoteControlKey.BACK -> if (exitConfirmationActive) PlayerControlAction.ExitPlayer else PlayerControlAction.ShowExitConfirmation
            RemoteControlKey.PLAY_PAUSE -> PlayerControlAction.TogglePlayPause
            RemoteControlKey.FAST_FORWARD -> PlayerControlAction.SeekForward()
            RemoteControlKey.REWIND -> PlayerControlAction.SeekBackward()
            RemoteControlKey.CENTER_OK,
            RemoteControlKey.LEFT,
            RemoteControlKey.RIGHT,
            RemoteControlKey.UP,
            RemoteControlKey.DOWN -> PlayerControlAction.ShowControls
        }
    }

    return when (key) {
        RemoteControlKey.BACK -> PlayerControlAction.HideControls
        RemoteControlKey.PLAY_PAUSE -> PlayerControlAction.TogglePlayPause
        RemoteControlKey.FAST_FORWARD -> PlayerControlAction.SeekForward()
        RemoteControlKey.REWIND -> PlayerControlAction.SeekBackward()
        RemoteControlKey.CENTER_OK,
        RemoteControlKey.LEFT,
        RemoteControlKey.RIGHT,
        RemoteControlKey.UP,
        RemoteControlKey.DOWN -> PlayerControlAction.ShowControls
    }
}
