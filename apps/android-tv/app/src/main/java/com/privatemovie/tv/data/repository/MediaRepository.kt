package com.privatemovie.tv.data.repository

import com.privatemovie.tv.data.network.ApiResponse
import com.privatemovie.tv.data.network.MediaApiClient
import com.privatemovie.tv.dto.models.ErrorObject
import com.privatemovie.tv.dto.models.GenreItem
import com.privatemovie.tv.dto.models.HomeFeed
import com.privatemovie.tv.dto.models.SeriesDetails
import com.privatemovie.tv.dto.models.SeriesPageResult
import com.privatemovie.tv.dto.models.SeriesSummary

class MediaApiException(
    val statusCode: Int,
    val errorObject: ErrorObject?
) : Exception(errorObject?.message ?: "Media API request failed with status $statusCode")

interface MediaRepository {
    suspend fun getHomeFeed(): Result<HomeFeed>
    suspend fun getSeriesById(id: String): Result<SeriesDetails>
    suspend fun getGenres(): Result<List<GenreItem>> =
        Result.failure(NotImplementedError("getGenres not stubbed"))
    suspend fun getSeriesByGenre(
        genre: String,
        filter: String?,
        page: Int,
        limit: Int
    ): Result<SeriesPageResult> =
        Result.failure(NotImplementedError("getSeriesByGenre not stubbed"))
    suspend fun searchSeries(query: String, limit: Int = 5): Result<List<SeriesSummary>> =
        Result.failure(NotImplementedError("searchSeries not stubbed"))
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

    override suspend fun getGenres(): Result<List<GenreItem>> {
        return when (val response = apiClient.getGenres()) {
            is ApiResponse.Success -> Result.success(response.data.`data`)
            is ApiResponse.Error -> Result.failure(MediaApiException(response.statusCode, response.error))
            is ApiResponse.Failure -> Result.failure(response.throwable)
        }
    }

    override suspend fun getSeriesByGenre(
        genre: String,
        filter: String?,
        page: Int,
        limit: Int
    ): Result<SeriesPageResult> {
        return when (val response = apiClient.getSeries(genre = genre, filter = filter, page = page, limit = limit)) {
            is ApiResponse.Success -> Result.success(response.data.`data`)
            is ApiResponse.Error -> Result.failure(MediaApiException(response.statusCode, response.error))
            is ApiResponse.Failure -> Result.failure(response.throwable)
        }
    }

    override suspend fun searchSeries(query: String, limit: Int): Result<List<SeriesSummary>> {
        return when (val response = apiClient.searchSeries(query = query, limit = limit)) {
            is ApiResponse.Success -> Result.success(response.data.`data`.series)
            is ApiResponse.Error -> Result.failure(MediaApiException(response.statusCode, response.error))
            is ApiResponse.Failure -> Result.failure(response.throwable)
        }
    }
}
