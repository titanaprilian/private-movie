package com.privatemovie.tv.data.repository

import com.privatemovie.tv.data.network.ApiResponse
import com.privatemovie.tv.data.network.MediaApiClient
import com.privatemovie.tv.dto.models.ErrorObject
import com.privatemovie.tv.dto.models.HomeFeed
import com.privatemovie.tv.dto.models.SeriesDetails

class MediaApiException(
    val statusCode: Int,
    val errorObject: ErrorObject?
) : Exception(errorObject?.message ?: "Media API request failed with status $statusCode")

interface MediaRepository {
    suspend fun getHomeFeed(): Result<HomeFeed>
    suspend fun getSeriesById(id: String): Result<SeriesDetails>
}

class DefaultMediaRepository(
    private val apiClient: MediaApiClient
) : MediaRepository {

    override suspend fun getHomeFeed(): Result<HomeFeed> {
        return when (val response = apiClient.getHomeFeed()) {
            is ApiResponse.Success -> Result.success(response.data.`data`)
            is ApiResponse.Error -> Result.failure(MediaApiException(response.statusCode, response.error))
            is ApiResponse.Failure -> Result.failure(response.throwable)
        }
    }

    override suspend fun getSeriesById(id: String): Result<SeriesDetails> {
        return when (val response = apiClient.getSeriesById(id)) {
            is ApiResponse.Success -> Result.success(response.data.`data`)
            is ApiResponse.Error -> Result.failure(MediaApiException(response.statusCode, response.error))
            is ApiResponse.Failure -> Result.failure(response.throwable)
        }
    }
}
