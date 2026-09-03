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
    /** Direct stream targets use the native Android playback stack. */
    NATIVE,

    /** Embed/web targets load inside the TV-safe WebView player shell. */
    WEBVIEW,
}

/** Remote-control keys covered by the MVP contract at the app boundary. */
enum class RemoteControlKey {
    /** D-pad center / OK / Enter: primary playback interaction. */
    CENTER_OK,

    /** Back: exit playback predictably to the watch/detail flow. */
    BACK,

    /** D-pad left: seek-oriented behavior where supported. */
    LEFT,

    /** D-pad right: seek-oriented behavior where supported. */
    RIGHT,

    /** Dedicated play/pause media key when available. */
    PLAY_PAUSE,

    /** D-pad up: vertical navigation or revealing overlay when hidden. */
    UP,

    /** D-pad down: vertical navigation or revealing overlay when hidden. */
    DOWN,
}

/**
 * Declarative control actions the player shell can take in response to a
 * remote-control intent. The Compose layer applies these (toggle playback,
 * seek, exit, fullscreen attempt, show controls overlay) against the active [PlaybackRenderer].
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
}

const val DEFAULT_SEEK_SECONDS = 10
const val DEFAULT_CONTROLS_TIMEOUT_MS = 3000L

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
        is PlayerControlAction.ExitPlayer,
        is PlayerControlAction.RequestFullscreen -> currentVisible
    }

/**
 * Chooses the renderer for a normalized [VideoSource] playback target.
 * Direct targets use native playback; embed targets use the WebView shell.
 */
fun resolveRenderer(sourceType: VideoSource.Type): PlaybackRenderer =
    when (sourceType) {
        VideoSource.Type.DIRECT -> PlaybackRenderer.NATIVE
        VideoSource.Type.EMBED -> PlaybackRenderer.WEBVIEW
    }

/**
 * Chooses the renderer from a raw contract type name. Unknown or missing
 * values fall back to [PlaybackRenderer.WEBVIEW] because the catalog is
 * embed-heavy and the WebView shell is the safe default.
 */
fun resolveRendererForTypeName(typeName: String?): PlaybackRenderer =
    when (typeName?.lowercase()) {
        "direct" -> PlaybackRenderer.NATIVE
        else -> PlaybackRenderer.WEBVIEW
    }

/**
 * Whether the renderer attempts seek for left/right intents. MVP answers true
 * for both: native seeking is platform-supported and embed seeking is
 * attempted best-effort through provider-compatible controls.
 */
fun supportsSeek(renderer: PlaybackRenderer): Boolean =
    when (renderer) {
        PlaybackRenderer.NATIVE -> true
        PlaybackRenderer.WEBVIEW -> true
    }

/** The player shell auto-attempts fullscreen on entry (TV-only dedicated flow). */
fun shouldAutoFullscreenOnEntry(): Boolean = true

/**
 * Declarative actions dispatched automatically when entering the player
 * screen for the given [renderer]. Currently a single fullscreen attempt;
 * embed renderers additionally map it through provider-compatible controls
 * at the Compose/WebView boundary.
 */
fun initialActionsOnEntry(renderer: PlaybackRenderer): List<PlayerControlAction> =
    when (renderer) {
        PlaybackRenderer.NATIVE -> listOf(PlayerControlAction.RequestFullscreen)
        PlaybackRenderer.WEBVIEW -> listOf(PlayerControlAction.RequestFullscreen)
    }

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
 * When controls are hidden, any user interaction (D-pad or media keys)
 * signals [PlayerControlAction.ShowControls] so the overlay can be revealed
 * and focused without accidentally triggering underlying actions immediately,
 * except for [RemoteControlKey.BACK] which predictably exits playback immediately.
 */
fun handleRemoteKey(
    key: RemoteControlKey,
    renderer: PlaybackRenderer,
    controlsVisible: Boolean = true
): PlayerControlAction {
    if (!controlsVisible) {
        return when (key) {
            RemoteControlKey.BACK -> PlayerControlAction.ExitPlayer
            RemoteControlKey.CENTER_OK,
            RemoteControlKey.LEFT,
            RemoteControlKey.RIGHT,
            RemoteControlKey.PLAY_PAUSE,
            RemoteControlKey.UP,
            RemoteControlKey.DOWN -> PlayerControlAction.ShowControls
        }
    }

    return when (key) {
        RemoteControlKey.CENTER_OK -> PlayerControlAction.TogglePlayPause
        RemoteControlKey.BACK -> PlayerControlAction.ExitPlayer
        RemoteControlKey.LEFT -> PlayerControlAction.SeekBackward()
        RemoteControlKey.RIGHT -> PlayerControlAction.SeekForward()
        RemoteControlKey.PLAY_PAUSE -> PlayerControlAction.TogglePlayPause
        RemoteControlKey.UP,
        RemoteControlKey.DOWN -> PlayerControlAction.ShowControls
    }
}
