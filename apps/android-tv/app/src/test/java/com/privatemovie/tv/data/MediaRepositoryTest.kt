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

    @Test
    fun getGenresUnwrapsDataOnSuccess() = runTest {
        val fakeTransport = FakeHttpTransport().apply {
            responseToReturn = HttpResponse(
                statusCode = 200,
                body = """
                    {
                      "data": [
                        { "id": "g-1", "name": "Animation", "slug": "animation", "isBigGenre": true, "displayOrder": 1 }
                      ]
                    }
                """.trimIndent()
            )
        }

        val repository = DefaultMediaRepository(
            MediaApiClient(baseUrlProvider = { "http://localhost:3000" }, transport = fakeTransport)
        )

        val result = repository.getGenres()
        assertTrue(result.isSuccess)
        val genres = result.getOrThrow()
        assertEquals(1, genres.size)
        assertEquals("animation", genres[0].slug)
        assertTrue(genres[0].isBigGenre)
    }

    @Test
    fun getSeriesByGenreUnwrapsPageOnSuccess() = runTest {
        val fakeTransport = FakeHttpTransport().apply {
            responseToReturn = HttpResponse(
                statusCode = 200,
                body = """
                    {
                      "data": {
                        "series": [
                          { "id": "s-1", "title": "Series One", "type": "tv", "isFeatured": false }
                        ],
                        "meta": { "total": 10, "page": 1, "limit": 20 }
                      }
                    }
                """.trimIndent()
            )
        }

        val repository = DefaultMediaRepository(
            MediaApiClient(baseUrlProvider = { "http://localhost:3000" }, transport = fakeTransport)
        )

        val result = repository.getSeriesByGenre(genre = "animation", filter = "ongoing", page = 1, limit = 20)
        assertTrue(result.isSuccess)
        val page = result.getOrThrow()
        assertEquals(1, page.series.size)
        assertEquals("Series One", page.series[0].title)
        assertEquals(10, page.meta.total)
        assertEquals(
            "http://localhost:3000/api/series?page=1&limit=20&genre=animation&filter=ongoing",
            fakeTransport.lastRequestedUrl
        )
    }

    @Test
    fun searchSeriesReturnsItemsOnSuccess() = runTest {
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

        val repository = DefaultMediaRepository(
            MediaApiClient(baseUrlProvider = { "http://localhost:3000" }, transport = fakeTransport)
        )

        val result = repository.searchSeries("demon", limit = 5)
        assertTrue(result.isSuccess)
        val items = result.getOrThrow()
        assertEquals(1, items.size)
        assertEquals("s-9", items[0].id)
    }

    @Test
    fun searchSeriesFailsWithMediaApiExceptionOnError() = runTest {
        val fakeTransport = FakeHttpTransport().apply {
            responseToReturn = HttpResponse(
                statusCode = 500,
                body = """
                    {
                      "error": {
                        "code": "INTERNAL_ERROR",
                        "message": "Search failed"
                      }
                    }
                """.trimIndent()
            )
        }

        val repository = DefaultMediaRepository(
            MediaApiClient(baseUrlProvider = { "http://localhost:3000" }, transport = fakeTransport)
        )

        val result = repository.searchSeries("demon")
        assertTrue(result.isFailure)
        val exception = result.exceptionOrNull()
        assertTrue(exception is MediaApiException)
        assertEquals(500, (exception as MediaApiException).statusCode)
    }
}
