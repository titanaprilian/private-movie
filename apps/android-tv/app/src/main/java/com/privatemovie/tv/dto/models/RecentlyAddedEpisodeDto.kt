package com.privatemovie.tv.dto.models

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

/**
 * Episode payload returned in `homeFeed.recentlyAddedEpisodes`.
 *
 * Mirrors `MediaRecentlyAddedEpisode` from `@repo/contracts`.
 */
@Serializable
data class RecentlyAddedEpisodeDto(
    @SerialName(value = "id")
    val id: String,

    @SerialName(value = "title")
    val title: String,

    @SerialName(value = "order")
    val order: Int,

    @SerialName(value = "createdAt")
    val createdAt: String,

    @SerialName(value = "series")
    val series: RecentlyAddedSeriesDto,

    @SerialName(value = "season")
    val season: RecentlyAddedSeasonDto,

    @SerialName(value = "videoSources")
    val videoSources: List<RecentlyAddedVideoSourceDto> = emptyList(),

    @SerialName(value = "thumbnailUrl")
    val thumbnailUrl: String? = null,

    @SerialName(value = "duration")
    val duration: Int? = null,

    @SerialName(value = "rating")
    val rating: String? = null
)
