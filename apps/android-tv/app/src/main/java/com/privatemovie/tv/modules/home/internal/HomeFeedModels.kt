package com.privatemovie.tv.modules.home.internal

import com.privatemovie.tv.dto.models.Genre
import com.privatemovie.tv.dto.models.HomeFeed
import com.privatemovie.tv.dto.models.HomeFeedHero
import com.privatemovie.tv.dto.models.RecentlyAddedEpisodeDto
import com.privatemovie.tv.dto.models.SeriesMetadata

data class TvGenre(
    val id: String,
    val name: String,
    val slug: String
)

data class TvSeries(
    val id: String,
    val title: String,
    val description: String?,
    val type: String,
    val posterUrl: String?,
    val backdropUrl: String?,
    val logoUrl: String? = null,
    val rating: String?,
    val isFeatured: Boolean,
    val genres: List<TvGenre>,
    val seasonsCount: Int,
    val episodesCount: Int
)

data class TvHomeHero(
    val series: TvSeries,
    val tags: List<String>
)

data class TvHomeRow(
    val title: String,
    val items: List<TvSeries>
)

/** Series summary shown next to a recently added episode. */
data class TvRecentlyAddedSeries(
    val id: String,
    val title: String,
    val posterUrl: String?,
    val backdropUrl: String?
)

/** Season summary shown next to a recently added episode. */
data class TvRecentlyAddedSeason(
    val id: String,
    val title: String,
    val seasonNumber: Int?
)

/** Playback source of a recently added episode. */
data class TvRecentlyAddedVideoSource(
    val id: String,
    val episodeId: String,
    val type: String,
    val url: String,
    val label: String,
    val quality: String?
)

/** Domain model of an episode recently added to the catalog. */
data class TvRecentlyAddedEpisode(
    val id: String,
    val title: String,
    val order: Int,
    val thumbnailUrl: String?,
    val duration: Int?,
    val rating: String?,
    val series: TvRecentlyAddedSeries,
    val season: TvRecentlyAddedSeason,
    val videoSources: List<TvRecentlyAddedVideoSource>
)

data class TvHomeFeed(
    val hero: TvHomeHero?,
    val heroes: List<TvHomeHero> = emptyList(),
    val rows: List<TvHomeRow>,
    val recentlyAddedEpisodes: List<TvRecentlyAddedEpisode> = emptyList()
)

/** UI state for the TV home browsing experience. */
sealed interface HomeUiState {
    data object Loading : HomeUiState
    data class Success(val feed: TvHomeFeed) : HomeUiState
    data class Error(val message: String) : HomeUiState
}

fun HomeFeed.toTvHomeFeed(): TvHomeFeed {
    val tvHero = hero?.toTvHomeHero()
    val tvHeroes = heroes?.map { it.toTvHomeHero() } ?: emptyList()
    val tvRows = rows.map { rowDto ->
        TvHomeRow(
            title = rowDto.title,
            items = rowDto.items.map { itemDto -> itemDto.toTvSeries() }
        )
    }
    val tvRecentlyAddedEpisodes = recentlyAddedEpisodes.map { it.toTvRecentlyAddedEpisode() }
    return TvHomeFeed(
        hero = tvHero,
        heroes = tvHeroes,
        rows = tvRows,
        recentlyAddedEpisodes = tvRecentlyAddedEpisodes
    )
}

fun RecentlyAddedEpisodeDto.toTvRecentlyAddedEpisode(): TvRecentlyAddedEpisode {
    return TvRecentlyAddedEpisode(
        id = id,
        title = title,
        order = order,
        thumbnailUrl = thumbnailUrl,
        duration = duration,
        rating = rating,
        series = TvRecentlyAddedSeries(
            id = series.id,
            title = series.title,
            posterUrl = series.posterUrl,
            backdropUrl = series.backdropUrl
        ),
        season = TvRecentlyAddedSeason(
            id = season.id,
            title = season.title,
            seasonNumber = season.seasonNumber
        ),
        videoSources = videoSources.map { sourceDto ->
            TvRecentlyAddedVideoSource(
                id = sourceDto.id,
                episodeId = sourceDto.episodeId,
                type = sourceDto.type,
                url = sourceDto.url,
                label = sourceDto.label,
                quality = sourceDto.quality
            )
        }
    )
}

fun HomeFeedHero.toTvHomeHero(): TvHomeHero {
    return TvHomeHero(
        series = TvSeries(
            id = id,
            title = title,
            description = description,
            type = type,
            posterUrl = posterUrl,
            backdropUrl = backdropUrl,
            logoUrl = logoUrl,
            rating = rating,
            isFeatured = isFeatured,
            genres = genres.map { it.toTvGenre() },
            seasonsCount = seasonsCount,
            episodesCount = episodesCount
        ),
        tags = tags
    )
}

fun SeriesMetadata.toTvSeries(): TvSeries {
    return TvSeries(
        id = id,
        title = title,
        description = description,
        type = type,
        posterUrl = posterUrl,
        backdropUrl = backdropUrl,
        logoUrl = logoUrl,
        rating = rating,
        isFeatured = isFeatured,
        genres = genres.map { it.toTvGenre() },
        seasonsCount = seasonsCount,
        episodesCount = episodesCount
    )
}

fun Genre.toTvGenre(): TvGenre {
    return TvGenre(
        id = id,
        name = name,
        slug = slug
    )
}
