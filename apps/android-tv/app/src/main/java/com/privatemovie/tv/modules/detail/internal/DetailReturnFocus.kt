package com.privatemovie.tv.modules.detail.internal

/**
 * Focus target resolved when returning from the player to the detail screen.
 *
 * @param seasonIndex index into [TvSeriesDetails.seasons] to select. For standalone-only
 * series there are no seasons, so this is 0 and [episodeIndex] indexes [TvSeriesDetails.standaloneEpisodes].
 * @param episodeIndex index of the episode card to focus within the selected list.
 * @param episodeId id of the episode to focus.
 * @param isStandalone true when the target lives in standalone episodes.
 */
data class DetailReturnFocusTarget(
    val seasonIndex: Int,
    val episodeIndex: Int,
    val episodeId: String,
    val isStandalone: Boolean
)

/**
 * Resolves which episode card should receive focus when returning from the player.
 *
 * Searches seasons first (in order), then standalone episodes. Returns null when
 * [returnEpisodeId] is null/blank or no episode matches, in which case callers
 * should keep the default hero-banner focus.
 */
fun resolveDetailReturnFocus(
    details: TvSeriesDetails,
    returnEpisodeId: String?
): DetailReturnFocusTarget? {
    if (returnEpisodeId.isNullOrBlank()) return null
    details.seasons.forEachIndexed { seasonIndex, season ->
        val episodeIndex = season.episodes.indexOfFirst { it.id == returnEpisodeId }
        if (episodeIndex >= 0) {
            return DetailReturnFocusTarget(
                seasonIndex = seasonIndex,
                episodeIndex = episodeIndex,
                episodeId = returnEpisodeId,
                isStandalone = false
            )
        }
    }
    val standaloneIndex = details.standaloneEpisodes.indexOfFirst { it.id == returnEpisodeId }
    if (standaloneIndex >= 0) {
        return DetailReturnFocusTarget(
            seasonIndex = 0,
            episodeIndex = standaloneIndex,
            episodeId = returnEpisodeId,
            isStandalone = true
        )
    }
    return null
}

/**
 * Whether the detail screen should focus the returned episode card on entry
 * instead of resetting focus to the hero "Watch" banner button.
 */
fun shouldFocusReturnEpisode(target: DetailReturnFocusTarget?): Boolean = target != null
