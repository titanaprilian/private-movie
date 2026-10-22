package com.privatemovie.tv.dto.models

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

/** Season summary attached to a [RecentlyAddedEpisodeDto]. */
@Serializable
data class RecentlyAddedSeasonDto(
    @SerialName(value = "id")
    val id: String,

    @SerialName(value = "title")
    val title: String,

    @SerialName(value = "seasonNumber")
    val seasonNumber: Int? = null
)
