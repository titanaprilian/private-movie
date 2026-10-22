package com.privatemovie.tv.dto.models

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

/** Series summary attached to a [RecentlyAddedEpisodeDto]. */
@Serializable
data class RecentlyAddedSeriesDto(
    @SerialName(value = "id")
    val id: String,

    @SerialName(value = "title")
    val title: String,

    @SerialName(value = "posterUrl")
    val posterUrl: String? = null,

    @SerialName(value = "backdropUrl")
    val backdropUrl: String? = null
)
