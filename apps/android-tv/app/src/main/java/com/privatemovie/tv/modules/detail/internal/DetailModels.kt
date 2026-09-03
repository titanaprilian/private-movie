package com.privatemovie.tv.modules.detail.internal

import com.privatemovie.tv.dto.models.EpisodeWithSources
import com.privatemovie.tv.dto.models.Genre
import com.privatemovie.tv.dto.models.SeasonWithEpisodes
import com.privatemovie.tv.dto.models.SeriesDetails
import com.privatemovie.tv.dto.models.VideoSource

data class TvVideoSource(
    val id: String,
    val label: String,
    val type: String,
    val url: String,
    val quality: String?
)

data class TvEpisode(
    val id: String,
    val title: String,
    val order: Int,
    val description: String?,
    val thumbnailUrl: String?,
    val videoSources: List<TvVideoSource>
)

data class TvSeason(
    val id: String,
    val title: String,
    val seasonNumber: Int?,
    val description: String?,
    val episodes: List<TvEpisode>
)

data class TvSeriesDetails(
    val id: String,
    val title: String,
    val type: String,
    val isFeatured: Boolean,
    val genres: List<Genre>,
    val description: String?,
    val posterUrl: String?,
    val backdropUrl: String?,
    val rating: String?,
    val seasons: List<TvSeason>,
    val standaloneEpisodes: List<TvEpisode>
)

sealed class DetailUiState {
    object Loading : DetailUiState()
    data class Error(val message: String) : DetailUiState()
    data class Success(val details: TvSeriesDetails) : DetailUiState()
}

fun VideoSource.toTvVideoSource(): TvVideoSource {
    return TvVideoSource(
        id = id,
        label = label,
        type = type.value,
        url = url,
        quality = quality
    )
}

fun EpisodeWithSources.toTvEpisode(): TvEpisode {
    return TvEpisode(
        id = id,
        title = title,
        order = order,
        description = description,
        thumbnailUrl = thumbnailUrl,
        videoSources = videoSources.map { it.toTvVideoSource() }
    )
}

fun SeasonWithEpisodes.toTvSeason(): TvSeason {
    return TvSeason(
        id = id,
        title = title,
        seasonNumber = seasonNumber,
        description = description,
        episodes = episodes.map { it.toTvEpisode() }
    )
}

fun SeriesDetails.toTvSeriesDetails(): TvSeriesDetails {
    return TvSeriesDetails(
        id = id,
        title = title,
        type = type,
        isFeatured = isFeatured,
        genres = genres,
        description = description,
        posterUrl = posterUrl,
        backdropUrl = backdropUrl,
        rating = rating,
        seasons = seasons.map { it.toTvSeason() },
        standaloneEpisodes = episodes.map { it.toTvEpisode() }
    )
}
