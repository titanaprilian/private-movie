package com.privatemovie.tv.modules.player

import java.io.Serializable as JavaSerializable
import kotlinx.serialization.Serializable as KxSerializable

/**
 * Clean, normalized playback source reference for player handoff and execution.
 *
 * Implements [JavaSerializable] so it can be stored in Android
 * `SavedStateHandle` across navigation destinations.
 */
@KxSerializable
data class PlaybackSourceRef(
    val type: String,
    val url: String
) : JavaSerializable

/**
 * Normalized metadata payload passed to the player screen for headline & subtitle formatting.
 */
@KxSerializable
data class PlaybackMetadataHandoff(
    val seriesTitle: String? = null,
    val seasonTitle: String? = null,
    val seasonNumber: Int? = null,
    val episodeOrder: Int? = null,
    val episodeTitle: String? = null
) : JavaSerializable

/**
 * Playable episode item representing a single entry in a series playlist.
 */
@KxSerializable
data class PlaylistEpisodeItem(
    val episodeId: String,
    val seriesTitle: String? = null,
    val seasonTitle: String? = null,
    val seasonNumber: Int? = null,
    val episodeOrder: Int? = null,
    val episodeTitle: String? = null,
    val sourceTypeName: String? = null,
    val sourceUrl: String? = null
) : JavaSerializable

/**
 * Comprehensive navigation payload for entering the Player screen with type safety.
 */
@KxSerializable
data class PlayerNavArgs(
    val episodeId: String,
    val source: PlaybackSourceRef? = null,
    val metadata: PlaybackMetadataHandoff? = null,
    val playlist: List<PlaylistEpisodeItem> = emptyList()
) : JavaSerializable

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
 * Key used to pass [PlayerNavArgs] inside savedStateHandle across Compose navigation destinations.
 */
const val PLAYER_NAV_ARGS_KEY = "player_nav_args"

/**
 * Key used to store/read [PlayerNavArgs] payload as a JSON string when persisting across savedStateHandle.
 */
const val PLAYER_NAV_ARGS_JSON_KEY = "player_nav_args_json"

/**
 * Key used to return the latest played episode id from the Player back to the
 * Detail screen via the detail destination's SavedStateHandle.
 */
const val PLAYER_RETURN_EPISODE_ID_KEY = "player_return_episode_id"

const val DEFAULT_SEEK_SECONDS = 10
const val DEFAULT_CONTROLS_TIMEOUT_MS = 3500L
const val DEFAULT_EXIT_CONFIRM_TIMEOUT_MS = 2500L

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

    /** First Back press while controls are hidden: show exit confirmation prompt. */
    data object ShowExitConfirmation : PlayerControlAction

    /** Dismiss the exit confirmation prompt without exiting (timeout elapsed). */
    data object DismissExitConfirmation : PlayerControlAction
}
