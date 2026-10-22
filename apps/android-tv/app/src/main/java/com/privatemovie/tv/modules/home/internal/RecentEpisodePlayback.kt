package com.privatemovie.tv.modules.home.internal

import com.privatemovie.tv.modules.player.PlaybackMetadataHandoff
import com.privatemovie.tv.modules.player.PlaybackSourceRef
import com.privatemovie.tv.modules.player.PlayerNavArgs

/**
 * Builds the typed player navigation payload for a recently added episode.
 *
 * The first available video source is used as the playback source (the episode
 * card launches playback directly), and the episode/series metadata is handed
 * over so the player can render its headline and subtitle.
 */
fun buildRecentEpisodePlayerNavArgs(episode: TvRecentlyAddedEpisode): PlayerNavArgs {
    val source = episode.videoSources.firstOrNull()?.let {
        PlaybackSourceRef(type = it.type, url = it.url)
    }
    val metadata = PlaybackMetadataHandoff(
        seriesTitle = episode.series.title,
        seasonTitle = episode.season.title,
        seasonNumber = episode.season.seasonNumber,
        episodeOrder = episode.order,
        episodeTitle = episode.title
    )
    return PlayerNavArgs(
        episodeId = episode.id,
        source = source,
        metadata = metadata
    )
}
