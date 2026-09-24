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

        assertEquals("http://10.0.2.2:3000/api/series/home-feed?sourceTypes=direct,s3", fakeTransport.lastRequestedUrl)
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

        assertEquals("http://localhost:3000/api/series/unknown-id?sourceTypes=direct,s3", fakeTransport.lastRequestedUrl)
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
        assertEquals("http://10.0.2.2:3000/api/series/home-feed?sourceTypes=direct,s3", fakeTransport.lastRequestedUrl)

        currentBaseUrl = "http://192.168.1.50:3000"
        client.getHomeFeed()
        assertEquals("http://192.168.1.50:3000/api/series/home-feed?sourceTypes=direct,s3", fakeTransport.lastRequestedUrl)
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

    @Test
    fun getGenresRequestsCorrectEndpointAndParsesSuccess() = runTest {
        val fakeTransport = FakeHttpTransport().apply {
            responseToReturn = HttpResponse(
                statusCode = 200,
                body = """
                    {
                      "data": [
                        { "id": "g-1", "name": "Animation", "slug": "animation", "isBigGenre": true, "displayOrder": 1 },
                        { "id": "g-2", "name": "Drama", "slug": "drama", "isBigGenre": false, "displayOrder": 5 }
                      ]
                    }
                """.trimIndent()
            )
        }

        val client = MediaApiClient(
            baseUrlProvider = { "http://10.0.2.2:3000/" },
            transport = fakeTransport
        )

        val result = client.getGenres()

        assertEquals("http://10.0.2.2:3000/genres", fakeTransport.lastRequestedUrl)
        assertTrue(result is ApiResponse.Success)
        val genres = (result as ApiResponse.Success).data.data
        assertEquals(2, genres.size)
        assertEquals("animation", genres[0].slug)
        assertTrue(genres[0].isBigGenre)
        assertEquals(1, genres[0].displayOrder)
    }

    @Test
    fun getSeriesEncodesGenreFilterAndPagination() = runTest {
        val fakeTransport = FakeHttpTransport().apply {
            responseToReturn = HttpResponse(
                statusCode = 200,
                body = """{"data":{"series":[],"meta":{"total":0,"page":2,"limit":20}}}"""
            )
        }

        val client = MediaApiClient(
            baseUrlProvider = { "http://10.0.2.2:3000" },
            transport = fakeTransport
        )

        val result = client.getSeries(genre = "animation", filter = "ongoing", page = 2, limit = 20)

        assertEquals(
            "http://10.0.2.2:3000/api/series?page=2&limit=20&genre=animation&filter=ongoing",
            fakeTransport.lastRequestedUrl
        )
        assertTrue(result is ApiResponse.Success)
        assertEquals(0, (result as ApiResponse.Success).data.data.meta.total)
    }

    @Test
    fun getSeriesOmitsBlankGenreAndAllFilter() = runTest {
        val fakeTransport = FakeHttpTransport().apply {
            responseToReturn = HttpResponse(
                statusCode = 200,
                body = """{"data":{"series":[],"meta":{"total":0,"page":1,"limit":20}}}"""
            )
        }

        val client = MediaApiClient(
            baseUrlProvider = { "http://10.0.2.2:3000" },
            transport = fakeTransport
        )

        client.getSeries(genre = null, filter = "all", page = 1, limit = 20)

        assertEquals(
            "http://10.0.2.2:3000/api/series?page=1&limit=20",
            fakeTransport.lastRequestedUrl
        )
    }

    @Test
    fun searchSeriesEncodesQueryAndLimit() = runTest {
        val fakeTransport = FakeHttpTransport().apply {
            responseToReturn = HttpResponse(
                statusCode = 200,
                body = """
                    {
                      "data": {
                        "series": [
                          { "id": "s-9", "title": "Demon Slayer", "type": "tv", "isFeatured": false }
                        ],
                        "meta": { "total": 1, "page": 1, "limit": 5 }
                      }
                    }
                """.trimIndent()
            )
        }

        val client = MediaApiClient(
            baseUrlProvider = { "http://10.0.2.2:3000" },
            transport = fakeTransport
        )

        val result = client.searchSeries("demon slayer", limit = 5)

        assertEquals(
            "http://10.0.2.2:3000/api/series?limit=5&q=demon+slayer",
            fakeTransport.lastRequestedUrl
        )
        assertTrue(result is ApiResponse.Success)
        val page = (result as ApiResponse.Success).data.data
        assertEquals(1, page.series.size)
        assertEquals("Demon Slayer", page.series[0].title)
    }

    @Test
    fun getSeriesHandlesErrorEnvelope() = runTest {
        val fakeTransport = FakeHttpTransport().apply {
            responseToReturn = HttpResponse(
                statusCode = 500,
                body = """
                    {
                      "error": {
                        "code": "INTERNAL_ERROR",
                        "message": "Something went wrong"
                      }
                    }
                """.trimIndent()
            )
        }

        val client = MediaApiClient(
            baseUrlProvider = { "http://10.0.2.2:3000" },
            transport = fakeTransport
        )

        val result = client.getSeries(genre = "drama", filter = null, page = 1, limit = 20)

        assertTrue(result is ApiResponse.Error)
        val error = result as ApiResponse.Error
        assertEquals(500, error.statusCode)
        assertEquals("INTERNAL_ERROR", error.error?.code)
    }
}
