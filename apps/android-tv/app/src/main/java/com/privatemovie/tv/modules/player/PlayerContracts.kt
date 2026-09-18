package com.privatemovie.tv.modules.player

/**
 * Clean, normalized playback source reference for player handoff and execution.
 */
data class PlaybackSourceRef(
    val type: String,
    val url: String
)

/**
 * Normalized metadata payload passed to the player screen for headline & subtitle formatting.
 */
data class PlaybackMetadataHandoff(
    val seriesTitle: String? = null,
    val seasonTitle: String? = null,
    val seasonNumber: Int? = null,
    val episodeOrder: Int? = null,
    val episodeTitle: String? = null
)

/**
 * Playable episode item representing a single entry in a series playlist.
 */
data class PlaylistEpisodeItem(
    val episodeId: String,
    val seriesTitle: String? = null,
    val seasonTitle: String? = null,
    val seasonNumber: Int? = null,
    val episodeOrder: Int? = null,
    val episodeTitle: String? = null,
    val sourceTypeName: String? = null,
    val sourceUrl: String? = null
)

/**
 * Comprehensive navigation payload for entering the Player screen with type safety.
 */
data class PlayerNavArgs(
    val episodeId: String,
    val source: PlaybackSourceRef? = null,
    val metadata: PlaybackMetadataHandoff? = null,
    val playlist: List<PlaylistEpisodeItem> = emptyList()
)

/**
 * Decision returned when the active media item finishes playback.
 */
enum class PlaybackCompletionDecision {
    /** Advance to and play the next episode. */
    AdvanceToNext,

    /** Exit the player back to the episode detail screen. */
    ExitPlayer,
}

const val DEFAULT_SEEK_SECONDS = 10
const val DEFAULT_CONTROLS_TIMEOUT_MS = 3500L

/**
 * Declarative control actions the player shell can take in response to a
 * remote-control intent or transport UI interaction.
 */
sealed interface PlayerControlAction {
    /** Primary activation and media-key behavior: toggle play/pause. */
    data object TogglePlayPause : PlayerControlAction

    /** Back navigation: exit playback to the watch/detail flow. */
    data object ExitPlayer : PlayerControlAction

    /** Seek-oriented left behavior. */
    data class SeekBackward(val seconds: Int = DEFAULT_SEEK_SECONDS) : PlayerControlAction

    /** Seek-oriented right behavior. */
    data class SeekForward(val seconds: Int = DEFAULT_SEEK_SECONDS) : PlayerControlAction

    /** Fullscreen attempt for the player surface. */
    data object RequestFullscreen : PlayerControlAction

    /** Signals the UI to show the controls overlay and reset inactivity timeout. */
    data object ShowControls : PlayerControlAction

    /** Signals the UI to hide/dismiss the controls overlay. */
    data object HideControls : PlayerControlAction
}
