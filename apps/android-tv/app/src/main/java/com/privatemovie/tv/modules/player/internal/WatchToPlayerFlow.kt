package com.privatemovie.tv.modules.player.internal

/**
 * End-to-end watch-to-player flow decisions for the Android TV MVP path
 * (Home -> Watch/Detail -> Player) against the real backend contract.
 *
 * Pure Kotlin with no Android framework dependencies so the integrated flow
 * — source-picker handoff for normalized playback targets plus clear failure
 * handling for unavailable or unsupported sources — stays unit-testable at
 * the app boundary without third-party embed details.
 */

/** Saved-state keys shared by the detail -> player handoff in navigation. */
const val PLAYER_SOURCE_TYPE_KEY = "playbackSourceType"
const val PLAYER_SOURCE_URL_KEY = "playbackUrl"

/** Clear failure message shown when no playable target reaches the player. */
const val NO_PLAYABLE_SOURCE_MESSAGE = "No playable source for this episode"

/**
 * Minimal normalized playback source reference for flow decisions.
 * Callers map their own models (e.g. detail `TvVideoSource`) into this
 * to avoid cross-module internal imports.
 */
data class PlaybackSourceRef(
    val type: String,
    val url: String
)

/** What the watch/detail flow should do for an episode's source list. */
sealed interface EpisodePlaybackDecision {
    /** No video sources: detail shows unavailable, player shows failure. */
    data object Unavailable : EpisodePlaybackDecision

    /** Exactly one source: play directly without a picker. */
    data object PlaySingle : EpisodePlaybackDecision

    /** Multiple sources: show the explicit source picker before playback. */
    data object NeedsSourcePicker : EpisodePlaybackDecision
}

/**
 * Decides how an episode with [sourceCount] normalized sources enters playback.
 * Zero sources is unavailable (clear failure handling), one plays directly,
 * and multiple require the explicit source picker.
 */
fun decideEpisodePlayback(sourceCount: Int): EpisodePlaybackDecision =
    when {
        sourceCount <= 0 -> EpisodePlaybackDecision.Unavailable
        sourceCount == 1 -> EpisodePlaybackDecision.PlaySingle
        else -> EpisodePlaybackDecision.NeedsSourcePicker
    }

/** Handoff args carried from the source picker (or direct play) to the player. */
data class PlayerHandoff(
    val episodeId: String,
    val sourceTypeName: String?,
    val sourceUrl: String?
)

/** Builds the player handoff for an episode and its chosen normalized source. */
fun buildPlayerHandoff(
    episodeId: String,
    source: PlaybackSourceRef?
): PlayerHandoff = PlayerHandoff(
    episodeId = episodeId,
    sourceTypeName = source?.type,
    sourceUrl = source?.url
)

/** Player-side resolution of a handoff into a renderer + loadable URL. */
data class ResolvedPlayerHandoff(
    val renderer: PlaybackRenderer,
    val resolvedUrl: String?,
    val failureMessage: String?
) {
    val isPlayable: Boolean get() = resolvedUrl != null
}

/**
 * Resolves a [PlayerHandoff] into the renderer for its normalized playback
 * target. Backend-normalized relative embed targets (e.g. `/embed/{hash}`)
 * are joined onto [backendBaseUrl]; missing or blank targets resolve to a
 * clear failure instead of a renderer so the player shows
 * "Playback unavailable" with an exit path.
 */
fun resolvePlayerHandoff(
    handoff: PlayerHandoff,
    backendBaseUrl: String?
): ResolvedPlayerHandoff {
    val renderer = resolveRendererForTypeName(handoff.sourceTypeName)
    val resolvedUrl = resolvePlaybackUrl(handoff.sourceUrl, backendBaseUrl)
    return if (resolvedUrl == null) {
        ResolvedPlayerHandoff(
            renderer = renderer,
            resolvedUrl = null,
            failureMessage = NO_PLAYABLE_SOURCE_MESSAGE
        )
    } else {
        ResolvedPlayerHandoff(
            renderer = renderer,
            resolvedUrl = resolvedUrl,
            failureMessage = null
        )
    }
}
