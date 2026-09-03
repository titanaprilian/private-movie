package com.privatemovie.tv.data

import com.privatemovie.tv.data.network.ApiResponse
import com.privatemovie.tv.data.network.HttpResponse
import com.privatemovie.tv.data.network.HttpTransport
import com.privatemovie.tv.data.network.MediaApiClient
import com.privatemovie.tv.dto.models.VideoSource
import kotlinx.coroutines.test.runTest
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class FakeHttpTransport : HttpTransport {
    var lastRequestedUrl: String? = null
    var responseToReturn: HttpResponse = HttpResponse(200, "{}")

    override suspend fun get(urlString: String): HttpResponse {
        lastRequestedUrl = urlString
        return responseToReturn
    }
}

class MediaApiClientTest {

    @Test
    fun getHomeFeedRequestsCorrectEndpointAndParsesSuccess() = runTest {
        val fakeTransport = FakeHttpTransport().apply {
            responseToReturn = HttpResponse(
                statusCode = 200,
                body = """
                    {
                      "data": {
                        "hero": null,
                        "rows": [
                          {
                            "title": "Popular",
                            "items": []
                          }
                        ]
                      }
                    }
                """.trimIndent()
            )
        }

        var activeUrl = "http://10.0.2.2:3000"
        val client = MediaApiClient(
            baseUrlProvider = { activeUrl },
            transport = fakeTransport
        )

        val result = client.getHomeFeed()

        assertEquals("http://10.0.2.2:3000/api/series/home-feed", fakeTransport.lastRequestedUrl)
        assertTrue(result is ApiResponse.Success)
        val successData = (result as ApiResponse.Success).data.data
        assertEquals(1, successData.rows.size)
        assertEquals("Popular", successData.rows[0].title)
    }

    @Test
    fun getSeriesByIdHandles404ErrorEnvelope() = runTest {
        val fakeTransport = FakeHttpTransport().apply {
            responseToReturn = HttpResponse(
                statusCode = 404,
                body = """
                    {
                      "error": {
                        "code": "SERIES_NOT_FOUND",
                        "message": "Series unknown-id not found"
                      }
                    }
                """.trimIndent()
            )
        }

        val client = MediaApiClient(
            baseUrlProvider = { "http://localhost:3000/" },
            transport = fakeTransport
        )

        val result = client.getSeriesById("unknown-id")

        assertEquals("http://localhost:3000/api/series/unknown-id", fakeTransport.lastRequestedUrl)
        assertTrue(result is ApiResponse.Error)
        val errorResult = result as ApiResponse.Error
        assertEquals(404, errorResult.statusCode)
        assertEquals("SERIES_NOT_FOUND", errorResult.error?.code)
        assertEquals("Series unknown-id not found", errorResult.error?.message)
    }

    @Test
    fun dynamicBaseUrlChangesReflectOnNextCall() = runTest {
        val fakeTransport = FakeHttpTransport().apply {
            responseToReturn = HttpResponse(
                statusCode = 200,
                body = """{"data":{"hero":null,"rows":[]}}"""
            )
        }

        var currentBaseUrl = "http://10.0.2.2:3000"
        val client = MediaApiClient(
            baseUrlProvider = { currentBaseUrl },
            transport = fakeTransport
        )

        client.getHomeFeed()
        assertEquals("http://10.0.2.2:3000/api/series/home-feed", fakeTransport.lastRequestedUrl)

        currentBaseUrl = "http://192.168.1.50:3000"
        client.getHomeFeed()
        assertEquals("http://192.168.1.50:3000/api/series/home-feed", fakeTransport.lastRequestedUrl)
    }

    @Test
    fun handlesNetworkFailureGracefully() = runTest {
        val failingTransport = object : HttpTransport {
            override suspend fun get(urlString: String): HttpResponse {
                throw java.io.IOException("Connection refused")
            }
        }

        val client = MediaApiClient(
            baseUrlProvider = { "http://10.0.2.2:3000" },
            transport = failingTransport
        )

        val result = client.getHomeFeed()
        assertTrue(result is ApiResponse.Failure)
        val failure = result as ApiResponse.Failure
        assertTrue(failure.throwable is java.io.IOException)
    }
}
