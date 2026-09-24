package com.privatemovie.tv.dto.models

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

/**
 * Lenient series summary for paginated `GET /api/series` results.
 *
 * List items are full series rows (`SeriesWithSeasons`: row columns plus
 * `seasons` and `genres` arrays). Unlike [SeriesMetadata], every field except
 * [id] and [title] is optional/defaulted so payload shape drift (missing
 * counters, extra season payloads) never breaks deserialization —
 * [Json.ignoreUnknownKeys] drops the rest.
 */
@Serializable
data class SeriesSummary(

    @SerialName(value = "id")
    val id: kotlin.String,

    @SerialName(value = "title")
    val title: kotlin.String,

    @SerialName(value = "type")
    val type: kotlin.String? = null,

    @SerialName(value = "description")
    val description: kotlin.String? = null,

    @SerialName(value = "posterUrl")
    val posterUrl: kotlin.String? = null,

    @SerialName(value = "backdropUrl")
    val backdropUrl: kotlin.String? = null,

    @SerialName(value = "logoUrl")
    val logoUrl: kotlin.String? = null,

    @SerialName(value = "rating")
    val rating: kotlin.String? = null,

    @SerialName(value = "isFeatured")
    val isFeatured: kotlin.Boolean = false,

    @SerialName(value = "genres")
    val genres: kotlin.collections.List<Genre> = emptyList()

)

/**
 * Pagination cursor for `GET /api/series`
 * (`{ data: { series, meta: { total, page, limit } } }`).
 */
@Serializable
data class SeriesPageMeta(

    @SerialName(value = "total")
    val total: kotlin.Int,

    @SerialName(value = "page")
    val page: kotlin.Int,

    @SerialName(value = "limit")
    val limit: kotlin.Int

)

/**
 * Paginated series payload for `GET /api/series`.
 */
@Serializable
data class SeriesPagedData(

    @SerialName(value = "series")
    val series: kotlin.collections.List<SeriesSummary>,

    @SerialName(value = "meta")
    val meta: SeriesPageMeta

)

/**
 * Success envelope for `GET /api/series` (genre catalog pages and search).
 */
@Serializable
data class SeriesPageResponse(

    @SerialName(value = "data")
    val `data`: SeriesPagedData

)

/**
 * Repository-level alias for a fetched genre catalog page.
 */
typealias SeriesPageResult = SeriesPagedData
