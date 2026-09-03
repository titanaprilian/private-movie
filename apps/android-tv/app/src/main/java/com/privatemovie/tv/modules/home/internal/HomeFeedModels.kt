package com.privatemovie.tv.modules.home.internal

import com.privatemovie.tv.dto.models.Genre
import com.privatemovie.tv.dto.models.HomeFeed
import com.privatemovie.tv.dto.models.HomeFeedHero
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

data class TvHomeFeed(
    val hero: TvHomeHero?,
    val rows: List<TvHomeRow>
)

/** UI state for the TV home browsing experience. */
sealed interface HomeUiState {
    data object Loading : HomeUiState
    data class Success(val feed: TvHomeFeed) : HomeUiState
    data class Error(val message: String) : HomeUiState
}

fun HomeFeed.toTvHomeFeed(): TvHomeFeed {
    val tvHero = hero?.toTvHomeHero()
    val tvRows = rows.map { rowDto ->
        TvHomeRow(
            title = rowDto.title,
            items = rowDto.items.map { itemDto -> itemDto.toTvSeries() }
        )
    }
    return TvHomeFeed(hero = tvHero, rows = tvRows)
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
