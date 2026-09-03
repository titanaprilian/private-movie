package com.privatemovie.tv.modules.detail

import com.privatemovie.tv.data.network.HttpResponse
import com.privatemovie.tv.data.network.MediaApiClient
import com.privatemovie.tv.data.repository.DefaultMediaRepository
import com.privatemovie.tv.data.FakeHttpTransport
import com.privatemovie.tv.modules.detail.internal.toTvSeriesDetails
import kotlinx.coroutines.test.runTest
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class DetailScreenTest {

    @Test
    fun `fetches series details from repository and maps to TV detail model`() = runTest {
        val fakeTransport = FakeHttpTransport().apply {
            responseToReturn = HttpResponse(
                statusCode = 200,
                body = """
                    {
                      "data": {
                        "id": "series-123",
                        "title": "Demon Slayer",
                        "type": "tv",
                        "isFeatured": true,
                        "createdAt": "2026-01-01T00:00:00.000Z",
                        "updatedAt": "2026-01-01T00:00:00.000Z",
                        "seasons": [
                          {
                            "id": "season-1",
                            "seriesId": "series-123",
                            "title": "Season 1: Unwavering Resolve",
                            "status": "published",
                            "createdAt": "2026-01-01T00:00:00.000Z",
                            "updatedAt": "2026-01-01T00:00:00.000Z",
                            "seasonNumber": 1,
                            "episodes": [
                              {
                                "id": "ep-1",
                                "title": "Cruelty",
                                "order": 1,
                                "createdAt": "2026-01-01T00:00:00.000Z",
                                "updatedAt": "2026-01-01T00:00:00.000Z",
                                "videoSources": [
                                  {
                                    "id": "src-1",
                                    "episodeId": "ep-1",
                                    "type": "embed",
                                    "url": "https://example.com/embed/1",
                                    "label": "Videobello Server",
                                    "quality": "1080p",
                                    "createdAt": "2026-01-01T00:00:00.000Z",
                                    "updatedAt": "2026-01-01T00:00:00.000Z"
                                  },
                                  {
                                    "id": "src-2",
                                    "episodeId": "ep-1",
                                    "type": "direct",
                                    "url": "https://example.com/stream/1.mp4",
                                    "label": "Direct MP4 Server",
                                    "quality": "720p",
                                    "createdAt": "2026-01-01T00:00:00.000Z",
                                    "updatedAt": "2026-01-01T00:00:00.000Z"
                                  }
                                ]
                              }
                            ]
                          }
                        ],
                        "episodes": [],
                        "relations": [],
                        "genres": [
                          { "id": "g-1", "name": "Action", "slug": "action" }
                        ],
                        "description": "Tanjiro sets out to become a demon slayer.",
                        "rating": "8.7"
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

        val result = repository.getSeriesById("series-123")
        assertTrue(result.isSuccess)

        val seriesDetails = result.getOrThrow()
        assertEquals("series-123", seriesDetails.id)
        assertEquals("Demon Slayer", seriesDetails.title)

        val tvDetails = seriesDetails.toTvSeriesDetails()
        assertEquals(1, tvDetails.seasons.size)
        val season = tvDetails.seasons[0]
        assertEquals("Season 1: Unwavering Resolve", season.title)

        assertEquals(1, season.episodes.size)
        val episode = season.episodes[0]
        assertEquals("Cruelty", episode.title)
        assertEquals(2, episode.videoSources.size)
        assertEquals("Videobello Server", episode.videoSources[0].label)
        assertEquals("embed", episode.videoSources[0].type)
        assertEquals("Direct MP4 Server", episode.videoSources[1].label)
        assertEquals("direct", episode.videoSources[1].type)
    }

    @Test
    fun `returns failure when series ID is not found`() = runTest {
        val fakeTransport = FakeHttpTransport().apply {
            responseToReturn = HttpResponse(
                statusCode = 404,
                body = """
                    {
                      "error": {
                        "code": "SERIES_NOT_FOUND",
                        "message": "Series unknown not found"
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

        val result = repository.getSeriesById("unknown")
        assertTrue(result.isFailure)
        assertEquals("Series unknown not found", result.exceptionOrNull()?.message)
    }
}
