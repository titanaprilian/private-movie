package com.privatemovie.tv.modules.player.internal

import com.privatemovie.tv.dto.models.VideoSource

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

/**
 * Declarative control actions the player shell can take in response to a
 * remote-control intent. The Compose layer applies these (toggle playback,
 * seek, exit, fullscreen attempt, show/hide controls overlay) against the active [PlaybackRenderer].
 */
sealed interface PlayerControlAction {
    /** Primary activation and media-key behavior: toggle play/pause. */
    data object TogglePlayPause : PlayerControlAction

    /** Back navigation: exit playback to the watch/detail flow. */
    data object ExitPlayer : PlayerControlAction

    /** Seek-oriented left behavior (native guaranteed, embed best-effort). */
    data class SeekBackward(val seconds: Int = DEFAULT_SEEK_SECONDS) : PlayerControlAction

    /** Seek-oriented right behavior (native guaranteed, embed best-effort). */
    data class SeekForward(val seconds: Int = DEFAULT_SEEK_SECONDS) : PlayerControlAction

    /** Fullscreen attempt for the player surface / provider-compatible embeds. */
    data object RequestFullscreen : PlayerControlAction

    /** Signals the UI to show the controls overlay and reset inactivity timeout. */
    data object ShowControls : PlayerControlAction

    /** Signals the UI to hide/dismiss the controls overlay. */
    data object HideControls : PlayerControlAction
}

const val DEFAULT_SEEK_SECONDS = 10
const val DEFAULT_CONTROLS_TIMEOUT_MS = 3500L

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
 * Decision returned when the active media item finishes playback.
 */
enum class PlaybackCompletionDecision {
    /** Advance to and play the next episode. */
    AdvanceToNext,

    /** Exit the player back to the episode detail screen. */
    ExitPlayer,
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
 *    - Back key exits playback (ExitPlayer).
 *    - Any D-pad/OK interaction reveals the controls overlay (ShowControls) and focuses center Play/Pause.
 */
fun handleRemoteKey(
    key: RemoteControlKey,
    renderer: PlaybackRenderer,
    controlsVisible: Boolean = true
): PlayerControlAction {
    when (key) {
        RemoteControlKey.PLAY_PAUSE -> return PlayerControlAction.TogglePlayPause
        RemoteControlKey.FAST_FORWARD -> return PlayerControlAction.SeekForward()
        RemoteControlKey.REWIND -> return PlayerControlAction.SeekBackward()
        else -> Unit
    }

    if (!controlsVisible) {
        return when (key) {
            RemoteControlKey.BACK -> PlayerControlAction.ExitPlayer
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
