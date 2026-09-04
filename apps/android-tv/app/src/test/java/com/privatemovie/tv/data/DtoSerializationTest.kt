package com.privatemovie.tv.data

import com.privatemovie.tv.dto.models.ErrorEnvelope
import com.privatemovie.tv.dto.models.HomeFeedSuccessResponse
import com.privatemovie.tv.dto.models.SeriesDetailsSuccessResponse
import com.privatemovie.tv.dto.models.VideoSource
import kotlinx.serialization.json.Json
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Test

class DtoSerializationTest {

    private val json = Json { ignoreUnknownKeys = true; isLenient = true }

    @Test
    fun deserializesHomeFeedSuccessResponse() {
        val payload = """
            {
              "data": {
                "hero": {
                  "id": "hero-1",
                  "title": "Hero Series",
                  "description": "Featured content description",
                  "type": "series",
                  "posterUrl": "https://example.com/poster.jpg",
                  "backdropUrl": "https://example.com/backdrop.jpg",
                  "rating": "PG-13",
                  "isFeatured": true,
                  "createdAt": "2026-01-01T00:00:00.000Z",
                  "updatedAt": "2026-01-01T00:00:00.000Z",
                  "genres": [
                    { "id": "g-1", "name": "Action", "slug": "action" }
                  ],
                  "seasonsCount": 2,
                  "episodesCount": 24,
                  "tags": ["TV Series", "Action"]
                },
                "rows": [
                  {
                    "title": "Ongoing Series",
                    "items": [
                      {
                        "id": "series-1",
                        "title": "Ongoing Show 1",
                        "description": null,
                        "type": "series",
                        "posterUrl": null,
                        "backdropUrl": null,
                        "rating": null,
                        "isFeatured": false,
                        "createdAt": "2026-01-01T00:00:00.000Z",
                        "updatedAt": "2026-01-01T00:00:00.000Z",
                        "genres": [],
                        "seasonsCount": 1,
                        "episodesCount": 12
                      }
                    ]
                  }
                ]
              }
            }
        """.trimIndent()

        val response = json.decodeFromString<HomeFeedSuccessResponse>(payload)
        val homeFeed = response.data

        assertNotNull(homeFeed.hero)
        assertEquals("hero-1", homeFeed.hero?.id)
        assertEquals("Hero Series", homeFeed.hero?.title)
        assertEquals(true, homeFeed.hero?.isFeatured)
        assertEquals(1, homeFeed.hero?.genres?.size)
        assertEquals("Action", homeFeed.hero?.genres?.first()?.name)

        assertEquals(1, homeFeed.rows.size)
        assertEquals("Ongoing Series", homeFeed.rows[0].title)
        assertEquals(1, homeFeed.rows[0].items.size)
        assertEquals("series-1", homeFeed.rows[0].items[0].id)
    }

    @Test
    fun deserializesSeriesDetailsSuccessResponseWithVideoSources() {
        val payload = """
            {
              "data": {
                "id": "series-123",
                "title": "Test Series",
                "description": "Series description",
                "type": "series",
                "posterUrl": null,
                "backdropUrl": null,
                "rating": "TV-MA",
                "isFeatured": false,
                "createdAt": "2026-01-01T00:00:00.000Z",
                "updatedAt": "2026-01-01T00:00:00.000Z",
                "genres": [],
                "seasons": [
                  {
                    "id": "season-1",
                    "seriesId": "series-123",
                    "title": "Season 1",
                    "description": null,
                    "posterUrl": null,
                    "seasonNumber": 1,
                    "status": "published",
                    "createdAt": "2026-01-01T00:00:00.000Z",
                    "updatedAt": "2026-01-01T00:00:00.000Z",
                    "episodes": [
                      {
                        "id": "ep-1",
                        "title": "Episode 1",
                        "order": 1,
                        "description": "Episode 1 desc",
                        "seasonId": "season-1",
                        "thumbnailUrl": null,
                        "rating": null,
                        "createdAt": "2026-01-01T00:00:00.000Z",
                        "updatedAt": "2026-01-01T00:00:00.000Z",
                        "videoSources": [
                          {
                            "id": "src-embed",
                            "episodeId": "ep-1",
                            "type": "embed",
                            "url": "/embed/abc123hash",
                            "label": "Embed Source",
                            "quality": "1080p",
                            "createdAt": "2026-01-01T00:00:00.000Z",
                            "updatedAt": "2026-01-01T00:00:00.000Z"
                          },
                          {
                            "id": "src-direct",
                            "episodeId": "ep-1",
                            "type": "direct",
                            "url": "https://cdn.example.com/video.mp4",
                            "label": "Direct Stream",
                            "quality": null,
                            "createdAt": "2026-01-01T00:00:00.000Z",
                            "updatedAt": "2026-01-01T00:00:00.000Z"
                          },
                          {
                            "id": "src-s3",
                            "episodeId": "ep-1",
                            "type": "s3",
                            "url": "https://s3.example.com/video.mp4",
                            "label": "S3 Stream",
                            "quality": "1080p",
                            "createdAt": "2026-01-01T00:00:00.000Z",
                            "updatedAt": "2026-01-01T00:00:00.000Z"
                          }
                        ]
                      }
                    ]
                  }
                ],
                "episodes": [],
                "relations": []
              }
            }
        """.trimIndent()

        val response = json.decodeFromString<SeriesDetailsSuccessResponse>(payload)
        val series = response.data

        assertEquals("series-123", series.id)
        assertEquals("Test Series", series.title)
        assertEquals(1, series.seasons.size)

        val episode = series.seasons[0].episodes[0]
        assertEquals("ep-1", episode.id)
        assertEquals(3, episode.videoSources.size)

        val embedSource = episode.videoSources[0]
        assertEquals(VideoSource.Type.EMBED, embedSource.type)
        assertEquals("/embed/abc123hash", embedSource.url)

        val directSource = episode.videoSources[1]
        assertEquals(VideoSource.Type.DIRECT, directSource.type)
        assertEquals("https://cdn.example.com/video.mp4", directSource.url)

        val s3Source = episode.videoSources[2]
        assertEquals(VideoSource.Type.S3, s3Source.type)
        assertEquals("https://s3.example.com/video.mp4", s3Source.url)
    }

    @Test
    fun deserializesErrorEnvelope() {
        val payload = """
            {
              "error": {
                "code": "SERIES_NOT_FOUND",
                "message": "Series with given identifier was not found."
              }
            }
        """.trimIndent()

        val errorResponse = json.decodeFromString<ErrorEnvelope>(payload)
        val errorObj = errorResponse.error

        assertNotNull(errorObj)
        assertEquals("SERIES_NOT_FOUND", errorObj.code)
        assertEquals("Series with given identifier was not found.", errorObj.message)
    }
}
