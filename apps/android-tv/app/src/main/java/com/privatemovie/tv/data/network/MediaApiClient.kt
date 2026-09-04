package com.privatemovie.tv.data.network

import com.privatemovie.tv.dto.models.ErrorEnvelope
import com.privatemovie.tv.dto.models.ErrorObject
import com.privatemovie.tv.dto.models.HomeFeedSuccessResponse
import com.privatemovie.tv.dto.models.SeriesDetailsSuccessResponse
import kotlinx.serialization.json.Json

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
