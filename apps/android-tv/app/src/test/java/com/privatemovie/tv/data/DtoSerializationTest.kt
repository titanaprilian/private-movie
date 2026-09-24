package com.privatemovie.tv.data

import com.privatemovie.tv.dto.models.ErrorEnvelope
import com.privatemovie.tv.dto.models.GenresListResponse
import com.privatemovie.tv.dto.models.HomeFeedSuccessResponse
import com.privatemovie.tv.dto.models.SeriesDetailsSuccessResponse
import com.privatemovie.tv.dto.models.SeriesPageResponse
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
                "episodes": []
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

    @Test
    fun deserializesHomeFeedWithLogoUrlAndHeroesArray() {
        val payload = """
            {
              "data": {
                "hero": {
                  "id": "h1",
                  "title": "Demo Series",
                  "type": "series",
                  "isFeatured": true,
                  "createdAt": "2026-01-01T00:00:00.000Z",
                  "updatedAt": "2026-01-01T00:00:00.000Z",
                  "genres": [],
                  "seasonsCount": 1,
                  "episodesCount": 10,
                  "tags": ["Action"],
                  "logoUrl": "https://example.com/logo.png"
                },
                "heroes": [
                  {
                    "id": "h1",
                    "title": "Hero 1",
                    "type": "series",
                    "isFeatured": true,
                    "createdAt": "2026-01-01T00:00:00.000Z",
                    "updatedAt": "2026-01-01T00:00:00.000Z",
                    "genres": [],
                    "seasonsCount": 1,
                    "episodesCount": 10,
                    "tags": ["Action"],
                    "logoUrl": "https://example.com/logo1.png"
                  },
                  {
                    "id": "h2",
                    "title": "Hero 2",
                    "type": "series",
                    "isFeatured": false,
                    "createdAt": "2026-01-01T00:00:00.000Z",
                    "updatedAt": "2026-01-01T00:00:00.000Z",
                    "genres": [],
                    "seasonsCount": 2,
                    "episodesCount": 20,
                    "tags": ["Drama"],
                    "logoUrl": null
                  }
                ],
                "rows": [
                  {
                    "title": "Row 1",
                    "items": [
                      {
                        "id": "s1",
                        "title": "Series with logo",
                        "type": "series",
                        "isFeatured": false,
                        "createdAt": "2026-01-01T00:00:00.000Z",
                        "updatedAt": "2026-01-01T00:00:00.000Z",
                        "genres": [],
                        "seasonsCount": 1,
                        "episodesCount": 5,
                        "logoUrl": "https://example.com/series-logo.png"
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
        assertEquals("https://example.com/logo.png", homeFeed.hero?.logoUrl)

        assertNotNull(homeFeed.heroes)
        assertEquals(2, homeFeed.heroes?.size)
        assertEquals("h1", homeFeed.heroes?.get(0)?.id)
        assertEquals("https://example.com/logo1.png", homeFeed.heroes?.get(0)?.logoUrl)
        assertEquals("h2", homeFeed.heroes?.get(1)?.id)
        assertNull(homeFeed.heroes?.get(1)?.logoUrl)

        assertEquals("https://example.com/series-logo.png", homeFeed.rows[0].items[0].logoUrl)
    }

    @Test
    fun deserializesHomeFeedWithNullLogoUrlAndNullHeroes() {
        val payload = """
            {
              "data": {
                "hero": {
                  "id": "h1",
                  "title": "Demo Series",
                  "type": "series",
                  "isFeatured": true,
                  "createdAt": "2026-01-01T00:00:00.000Z",
                  "updatedAt": "2026-01-01T00:00:00.000Z",
                  "genres": [],
                  "seasonsCount": 1,
                  "episodesCount": 10,
                  "tags": ["Action"],
                  "logoUrl": null
                },
                "heroes": null,
                "rows": []
              }
            }
        """.trimIndent()

        val response = json.decodeFromString<HomeFeedSuccessResponse>(payload)
        val homeFeed = response.data

        assertNotNull(homeFeed.hero)
        assertNull(homeFeed.hero?.logoUrl)
        assertNull(homeFeed.heroes)
    }

    @Test
    fun deserializesGenresListResponse() {
        val payload = """
            {
              "data": [
                {
                  "id": "g-1",
                  "name": "Animation",
                  "slug": "animation",
                  "isBigGenre": true,
                  "displayOrder": 1,
                  "createdAt": "2026-01-01T00:00:00.000Z",
                  "updatedAt": "2026-01-01T00:00:00.000Z"
                },
                {
                  "id": "g-2",
                  "name": "Drama",
                  "slug": "drama",
                  "isBigGenre": true,
                  "displayOrder": 2,
                  "createdAt": "2026-01-01T00:00:00.000Z",
                  "updatedAt": "2026-01-01T00:00:00.000Z"
                },
                {
                  "id": "g-3",
                  "name": "Obscure",
                  "slug": "obscure"
                }
              ]
            }
        """.trimIndent()

        val response = json.decodeFromString<GenresListResponse>(payload)
        val genres = response.data

        assertEquals(3, genres.size)
        assertEquals("animation", genres[0].slug)
        assertEquals(true, genres[0].isBigGenre)
        assertEquals(1, genres[0].displayOrder)
        assertEquals("Drama", genres[1].name)
        assertEquals(2, genres[1].displayOrder)
        // Missing big-genre fields default leniently.
        assertEquals(false, genres[2].isBigGenre)
        assertEquals(0, genres[2].displayOrder)
    }

    @Test
    fun deserializesSeriesPageResponseWithRealListShape() {
        // Mirrors GET /api/series list items (SeriesWithSeasons: full series
        // row plus seasons/genres arrays, unknown keys ignored).
        val payload = """
            {
              "data": {
                "series": [
                  {
                    "id": "series-1",
                    "sourceUrl": "https://example.com/s1",
                    "source": "dramula",
                    "title": "Series One",
                    "type": "tv",
                    "description": "First series",
                    "posterUrl": "https://example.com/poster1.jpg",
                    "backdropUrl": null,
                    "logoUrl": null,
                    "rating": "PG-13",
                    "isFeatured": false,
                    "isOngoingHighlighted": true,
                    "createdAt": "2026-01-01T00:00:00.000Z",
                    "updatedAt": "2026-02-01T00:00:00.000Z",
                    "genres": [
                      { "id": "g-1", "name": "Animation", "slug": "animation" }
                    ],
                    "seasons": [
                      {
                        "id": "season-1",
                        "seriesId": "series-1",
                        "title": "Season 1",
                        "status": "ongoing"
                      }
                    ]
                  },
                  {
                    "id": "series-2",
                    "sourceUrl": "https://example.com/s2",
                    "source": "dramula",
                    "title": "Series Two",
                    "type": "tv",
                    "description": null,
                    "posterUrl": null,
                    "backdropUrl": null,
                    "rating": null,
                    "isFeatured": true,
                    "createdAt": "2026-01-01T00:00:00.000Z",
                    "updatedAt": "2026-01-01T00:00:00.000Z",
                    "genres": [],
                    "seasons": []
                  }
                ],
                "meta": {
                  "total": 42,
                  "page": 1,
                  "limit": 20
                }
              }
            }
        """.trimIndent()

        val response = json.decodeFromString<SeriesPageResponse>(payload)
        val page = response.data

        assertEquals(2, page.series.size)
        assertEquals("series-1", page.series[0].id)
        assertEquals("Series One", page.series[0].title)
        assertEquals("https://example.com/poster1.jpg", page.series[0].posterUrl)
        assertEquals(1, page.series[0].genres.size)
        assertEquals("animation", page.series[0].genres[0].slug)
        assertEquals("series-2", page.series[1].id)
        assertNull(page.series[1].posterUrl)
        assertEquals(42, page.meta.total)
        assertEquals(1, page.meta.page)
        assertEquals(20, page.meta.limit)
    }

    @Test
    fun deserializesSearchPageResponseWithMinimalItems() {
        // GET /api/series?limit=5&q=... shares the paged envelope; search
        // items may carry only a subset of summary fields.
        val payload = """
            {
              "data": {
                "series": [
                  {
                    "id": "series-9",
                    "title": "Demon Slayer",
                    "posterUrl": "https://example.com/ds.jpg"
                  }
                ],
                "meta": {
                  "total": 1,
                  "page": 1,
                  "limit": 5
                }
              }
            }
        """.trimIndent()

        val response = json.decodeFromString<SeriesPageResponse>(payload)
        val page = response.data

        assertEquals(1, page.series.size)
        assertEquals("series-9", page.series[0].id)
        assertEquals("Demon Slayer", page.series[0].title)
        assertEquals("https://example.com/ds.jpg", page.series[0].posterUrl)
        assertNull(page.series[0].description)
        assertEquals(1, page.meta.total)
        assertEquals(5, page.meta.limit)
    }
}
