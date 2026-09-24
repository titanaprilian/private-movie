package com.privatemovie.tv.data.network

import com.privatemovie.tv.dto.models.ErrorEnvelope
import com.privatemovie.tv.dto.models.ErrorObject
import com.privatemovie.tv.dto.models.GenresListResponse
import com.privatemovie.tv.dto.models.HomeFeedSuccessResponse
import com.privatemovie.tv.dto.models.SeriesDetailsSuccessResponse
import com.privatemovie.tv.dto.models.SeriesPageResponse
import kotlinx.serialization.json.Json
import java.net.URLEncoder

sealed class ApiResponse<out T> {
    data class Success<out T>(val data: T) : ApiResponse<T>()
    data class Error(val statusCode: Int, val error: ErrorObject?) : ApiResponse<Nothing>()
    data class Failure(val throwable: Throwable) : ApiResponse<Nothing>()
}

class MediaApiClient(
    private val baseUrlProvider: () -> String,
    private val transport: HttpTransport = DefaultHttpTransport(),
    private val json: Json = Json { ignoreUnknownKeys = true; isLenient = true }
) {
    private fun sanitizeBaseUrl(url: String): String {
        return url.trimEnd('/')
    }

    suspend fun getHomeFeed(sourceTypes: String = "direct,s3"): ApiResponse<HomeFeedSuccessResponse> {
        val baseUrl = sanitizeBaseUrl(baseUrlProvider())
        val endpointUrl = "$baseUrl/api/series/home-feed?sourceTypes=$sourceTypes"
        return try {
            val response = transport.get(endpointUrl)
            parseResponse<HomeFeedSuccessResponse>(response)
        } catch (t: Throwable) {
            ApiResponse.Failure(t)
        }
    }

    suspend fun getSeriesById(seriesId: String, sourceTypes: String = "direct,s3"): ApiResponse<SeriesDetailsSuccessResponse> {
        val baseUrl = sanitizeBaseUrl(baseUrlProvider())
        val endpointUrl = "$baseUrl/api/series/$seriesId?sourceTypes=$sourceTypes"
        return try {
            val response = transport.get(endpointUrl)
            parseResponse<SeriesDetailsSuccessResponse>(response)
        } catch (t: Throwable) {
            ApiResponse.Failure(t)
        }
    }

    suspend fun getGenres(): ApiResponse<GenresListResponse> {
        val baseUrl = sanitizeBaseUrl(baseUrlProvider())
        val endpointUrl = "$baseUrl/genres"
        return try {
            val response = transport.get(endpointUrl)
            parseResponse<GenresListResponse>(response)
        } catch (t: Throwable) {
            ApiResponse.Failure(t)
        }
    }

    suspend fun getSeries(
        genre: String? = null,
        filter: String? = null,
        page: Int = 1,
        limit: Int = 20
    ): ApiResponse<SeriesPageResponse> {
        val baseUrl = sanitizeBaseUrl(baseUrlProvider())
        val params = mutableListOf("page=$page", "limit=$limit")
        if (!genre.isNullOrBlank()) {
            params.add("genre=${encodeQueryParam(genre)}")
        }
        if (!filter.isNullOrBlank() && filter != "all") {
            params.add("filter=${encodeQueryParam(filter)}")
        }
        val endpointUrl = "$baseUrl/api/series?${params.joinToString("&")}"
        return try {
            val response = transport.get(endpointUrl)
            parseResponse<SeriesPageResponse>(response)
        } catch (t: Throwable) {
            ApiResponse.Failure(t)
        }
    }

    suspend fun searchSeries(query: String, limit: Int = 5): ApiResponse<SeriesPageResponse> {
        val baseUrl = sanitizeBaseUrl(baseUrlProvider())
        val endpointUrl = "$baseUrl/api/series?limit=$limit&q=${encodeQueryParam(query)}"
        return try {
            val response = transport.get(endpointUrl)
            parseResponse<SeriesPageResponse>(response)
        } catch (t: Throwable) {
            ApiResponse.Failure(t)
        }
    }

    private fun encodeQueryParam(value: String): String {
        return URLEncoder.encode(value, Charsets.UTF_8.name())
    }

    private inline fun <reified T> parseResponse(response: HttpResponse): ApiResponse<T> {
        return if (response.statusCode in 200..299) {
            try {
                val parsed = json.decodeFromString<T>(response.body)
                ApiResponse.Success(parsed)
            } catch (e: Exception) {
                ApiResponse.Failure(e)
            }
        } else {
            val errorObject = try {
                val errorEnvelope = json.decodeFromString<ErrorEnvelope>(response.body)
                errorEnvelope.error
            } catch (e: Exception) {
                null
            }
            ApiResponse.Error(statusCode = response.statusCode, error = errorObject)
        }
    }
}
