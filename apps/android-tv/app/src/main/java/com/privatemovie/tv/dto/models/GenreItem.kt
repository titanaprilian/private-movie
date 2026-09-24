package com.privatemovie.tv.dto.models

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

/**
 * Genre catalog entry served by `GET /genres` (`{ data: GenreItem[] }`).
 *
 * Canonical shape mirrors `GenreItem` in `packages/contracts/src/genres.ts`.
 * `isBigGenre` / `displayOrder` default leniently so older payloads that omit
 * them still deserialize.
 */
@Serializable
data class GenreItem(

    @SerialName(value = "id")
    val id: kotlin.String,

    @SerialName(value = "name")
    val name: kotlin.String,

    @SerialName(value = "slug")
    val slug: kotlin.String,

    @SerialName(value = "isBigGenre")
    val isBigGenre: kotlin.Boolean = false,

    @SerialName(value = "displayOrder")
    val displayOrder: kotlin.Int = 0,

    @SerialName(value = "createdAt")
    val createdAt: kotlin.String? = null,

    @SerialName(value = "updatedAt")
    val updatedAt: kotlin.String? = null

)

/**
 * Success envelope for `GET /genres`.
 */
@Serializable
data class GenresListResponse(

    @SerialName(value = "data")
    val `data`: kotlin.collections.List<GenreItem>

)
