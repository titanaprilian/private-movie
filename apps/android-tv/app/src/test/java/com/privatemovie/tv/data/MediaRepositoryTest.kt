package com.privatemovie.tv.data

import com.privatemovie.tv.data.network.HttpResponse
import com.privatemovie.tv.data.network.MediaApiClient
import com.privatemovie.tv.data.repository.DefaultMediaRepository
import com.privatemovie.tv.data.repository.MediaApiException
import kotlinx.coroutines.test.runTest
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class MediaRepositoryTest {

    @Test
    fun getHomeFeedUnwrapsDataOnSuccess() = runTest {
        val fakeTransport = FakeHttpTransport().apply {
            responseToReturn = HttpResponse(
                statusCode = 200,
                body = """
                    {
                      "data": {
                        "hero": null,
                        "rows": [
                          {
                            "title": "Recently Added",
                            "items": []
                          }
                        ]
                      }
                    }
                """.trimIndent()
            )
        }

        val apiClient = MediaApiClient(
            baseUrlProvider = { "http://localhost:3000" },
            transport = fakeTransport
        )
        val repository = DefaultMediaRepository(apiClient)

        val result = repository.getHomeFeed()
        assertTrue(result.isSuccess)

        val homeFeed = result.getOrThrow()
        assertEquals(1, homeFeed.rows.size)
        assertEquals("Recently Added", homeFeed.rows[0].title)
    }

    @Test
    fun getSeriesByIdFailsWithMediaApiExceptionOnError() = runTest {
        val fakeTransport = FakeHttpTransport().apply {
            responseToReturn = HttpResponse(
                statusCode = 404,
                body = """
                    {
                      "error": {
                        "code": "SERIES_NOT_FOUND",
                        "message": "Series non-existent not found"
                      }
                    }
                """.trimIndent()
            )
        }

        val apiClient = MediaApiClient(
            baseUrlProvider = { "http://localhost:3000" },
            transport = fakeTransport
        )
        val repository = DefaultMediaRepository(apiClient)

        val result = repository.getSeriesById("non-existent")
        assertTrue(result.isFailure)

        val exception = result.exceptionOrNull()
        assertTrue(exception is MediaApiException)
        val apiException = exception as MediaApiException
        assertEquals(404, apiException.statusCode)
        assertEquals("SERIES_NOT_FOUND", apiException.errorObject?.code)
        assertEquals("Series non-existent not found", apiException.errorObject?.message)
    }
}
