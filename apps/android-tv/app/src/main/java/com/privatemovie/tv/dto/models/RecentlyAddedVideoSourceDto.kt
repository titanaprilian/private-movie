package com.privatemovie.tv.dto.models

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

/**
 * Playback source attached to a [RecentlyAddedEpisodeDto].
 *
 * `type` stays a plain string (as in `@repo/contracts`) because the home feed
 * may expose source kinds beyond the `embed`/`direct`/`s3` set.
 */
@Serializable
data class RecentlyAddedVideoSourceDto(
    @SerialName(value = "id")
    val id: String,

    @SerialName(value = "episodeId")
    val episodeId: String,

    @SerialName(value = "type")
    val type: String,

    @SerialName(value = "url")
    val url: String,

    @SerialName(value = "label")
    val label: String,

    @SerialName(value = "createdAt")
    val createdAt: String,

    @SerialName(value = "updatedAt")
    val updatedAt: String,

    @SerialName(value = "quality")
    val quality: String? = null
)
