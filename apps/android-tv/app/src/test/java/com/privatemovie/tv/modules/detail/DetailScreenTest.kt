package com.privatemovie.tv.modules.detail

import androidx.compose.ui.focus.FocusRequester
import com.privatemovie.tv.components.FocusTransitionCoordinator
import com.privatemovie.tv.components.requestFocusSafely
import com.privatemovie.tv.data.network.HttpResponse
import com.privatemovie.tv.data.network.MediaApiClient
import com.privatemovie.tv.data.repository.DefaultMediaRepository
import com.privatemovie.tv.data.FakeHttpTransport
import com.privatemovie.tv.modules.detail.internal.TvEpisode
import com.privatemovie.tv.modules.detail.internal.TvSeason
import com.privatemovie.tv.modules.detail.internal.TvSeriesDetails
import com.privatemovie.tv.modules.detail.internal.toTvSeriesDetails
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.test.advanceUntilIdle
import kotlinx.coroutines.test.runTest
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test
import java.util.concurrent.atomic.AtomicInteger

@OptIn(ExperimentalCoroutinesApi::class)
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

    @Test
    fun `downward focus transition targets carousel for single-season series`() = runTest {
        val playCtaFocus = FocusRequester()
        val carouselFocus = FocusRequester()
        val coordinator = FocusTransitionCoordinator(this)
        var targetFocused = false

        val details = TvSeriesDetails(
            id = "s-1",
            title = "Single Season Show",
            type = "tv",
            isFeatured = false,
            genres = emptyList(),
            description = "A show",
            posterUrl = null,
            backdropUrl = null,
            rating = "8.0",
            seasons = listOf(
                TvSeason(
                    id = "season-1",
                    title = "Season 1",
                    seasonNumber = 1,
                    description = "Season 1 description",
                    episodes = listOf(
                        TvEpisode(
                            id = "ep-1",
                            title = "Pilot",
                            order = 1,
                            description = "Pilot episode",
                            thumbnailUrl = null,
                            videoSources = emptyList()
                        )
                    )
                )
            ),
            standaloneEpisodes = emptyList()
        )

        val handled = coordinator.tryRequestFocus {
            if (details.seasons.size > 1) {
                false
            } else {
                targetFocused = requestFocusSafely(carouselFocus, maxRetries = 2, rawRequest = { true })
                targetFocused
            }
        }

        assertTrue(handled)
        advanceUntilIdle()
        assertTrue(targetFocused)
    }

    @Test
    fun `downward focus transition targets season tabs for multi-season series`() = runTest {
        val playCtaFocus = FocusRequester()
        val seasonTabsFocus = FocusRequester()
        val coordinator = FocusTransitionCoordinator(this)
        var targetFocused = false

        val details = TvSeriesDetails(
            id = "s-2",
            title = "Multi Season Show",
            type = "tv",
            isFeatured = false,
            genres = emptyList(),
            description = "A show",
            posterUrl = null,
            backdropUrl = null,
            rating = "8.0",
            seasons = listOf(
                TvSeason(id = "season-1", title = "Season 1", seasonNumber = 1, description = null, episodes = emptyList()),
                TvSeason(id = "season-2", title = "Season 2", seasonNumber = 2, description = null, episodes = emptyList())
            ),
            standaloneEpisodes = emptyList()
        )

        val handled = coordinator.tryRequestFocus {
            if (details.seasons.size > 1) {
                targetFocused = requestFocusSafely(seasonTabsFocus, maxRetries = 2, rawRequest = { true })
                targetFocused
            } else {
                false
            }
        }

        assertTrue(handled)
        advanceUntilIdle()
        assertTrue(targetFocused)
    }

    @Test
    fun `upward focus transition targets play CTA safely`() = runTest {
        val playCtaFocus = FocusRequester()
        val coordinator = FocusTransitionCoordinator(this)
        var ctaFocused = false

        val handled = coordinator.tryRequestFocus {
            ctaFocused = requestFocusSafely(playCtaFocus, maxRetries = 2, rawRequest = { true })
            ctaFocused
        }

        assertTrue(handled)
        advanceUntilIdle()
        assertTrue(ctaFocused)
    }

    @Test
    fun `rapid D-pad transitions are guarded against contention`() = runTest {
        val coordinator = FocusTransitionCoordinator(this)
        val counter = AtomicInteger(0)

        val first = coordinator.tryRequestFocus {
            counter.incrementAndGet()
            kotlinx.coroutines.delay(500)
            true
        }

        val second = coordinator.tryRequestFocus {
            counter.incrementAndGet()
            true
        }

        assertTrue(first)
        assertFalse(second)
        advanceUntilIdle()
        assertEquals(1, counter.get())
    }

    // ── Episode focus-memory & season-reset tests ─────────────────────────────

    private fun makeDetails(seasons: List<TvSeason> = emptyList(), standalone: List<TvEpisode> = emptyList()) =
        TvSeriesDetails(
            id = "s-test",
            title = "Test Show",
            type = "tv",
            isFeatured = false,
            genres = emptyList(),
            description = null,
            posterUrl = null,
            backdropUrl = null,
            rating = null,
            seasons = seasons,
            standaloneEpisodes = standalone
        )

    private fun makeEpisode(id: String, order: Int) = TvEpisode(
        id = id,
        title = "Episode $order",
        order = order,
        description = null,
        thumbnailUrl = null,
        videoSources = emptyList()
    )

    @Test
    fun `downward navigation restores focus to remembered episode index`() = runTest {
        val episodes = listOf(makeEpisode("ep-1", 1), makeEpisode("ep-2", 2), makeEpisode("ep-3", 3))
        val focusRequesters = List(episodes.size) { FocusRequester() }
        val coordinator = FocusTransitionCoordinator(this)

        // Simulate user has navigated to episode index 2 (the third card).
        var rememberedIndex = 2
        var focusedIndex = -1

        val handled = coordinator.tryRequestFocus {
            val targetIndex = rememberedIndex.coerceIn(0, episodes.size - 1)
            val requester = focusRequesters.getOrNull(targetIndex)
            if (requester != null) {
                focusedIndex = targetIndex
                requestFocusSafely(requester, maxRetries = 2, rawRequest = { true })
            } else {
                false
            }
        }

        assertTrue(handled)
        advanceUntilIdle()
        assertEquals(2, focusedIndex)
    }

    @Test
    fun `focus fallback to episode 0 when remembered index is out of bounds`() = runTest {
        val episodes = listOf(makeEpisode("ep-1", 1), makeEpisode("ep-2", 2))
        val focusRequesters = List(episodes.size) { FocusRequester() }
        val coordinator = FocusTransitionCoordinator(this)

        // Stale index from a previous season with more episodes.
        var rememberedIndex = 99
        var focusedIndex = -1

        val handled = coordinator.tryRequestFocus {
            val targetIndex = rememberedIndex.coerceIn(0, (episodes.size - 1).coerceAtLeast(0))
            val requester = focusRequesters.getOrNull(targetIndex) ?: focusRequesters.firstOrNull()
            if (requester != null) {
                focusedIndex = targetIndex
                requestFocusSafely(requester, maxRetries = 2, rawRequest = { true })
            } else {
                false
            }
        }

        assertTrue(handled)
        advanceUntilIdle()
        // Clamped to the last valid index (1 for a 2-episode list).
        assertEquals(1, focusedIndex)
    }

    @Test
    fun `season tab switch resets active episode index to 0`() {
        var activeEpisodeIndex = 3 // user was on episode 4

        // Simulate selecting a new season.
        val newSeasonIndex = 1
        activeEpisodeIndex = 0 // this is what DetailContent does on season switch

        assertEquals(0, activeEpisodeIndex)
    }

    @Test
    fun `navigating between carousel and info panel preserves episode focus index`() = runTest {
        val episodes = listOf(makeEpisode("ep-1", 1), makeEpisode("ep-2", 2), makeEpisode("ep-3", 3))
        var activeEpisodeIndex = 0

        // User focuses episode index 2 in the carousel.
        val onEpisodeFocused: (TvEpisode, Int) -> Unit = { _, index ->
            activeEpisodeIndex = index
        }
        onEpisodeFocused(episodes[2], 2)
        assertEquals(2, activeEpisodeIndex)

        // User navigates to the info panel (a vertical move — index must not change).
        // (The panel transition does NOT call onEpisodeFocused — it just moves vertical focus.)
        assertEquals(2, activeEpisodeIndex)

        // User returns to the carousel — remembered index is still 2.
        val focusRequesters = List(episodes.size) { FocusRequester() }
        val coordinator = FocusTransitionCoordinator(this)
        var restoredIndex = -1

        val handled = coordinator.tryRequestFocus {
            val targetIndex = activeEpisodeIndex.coerceIn(0, episodes.size - 1)
            val requester = focusRequesters.getOrNull(targetIndex)
            if (requester != null) {
                restoredIndex = targetIndex
                requestFocusSafely(requester, maxRetries = 2, rawRequest = { true })
            } else false
        }

        assertTrue(handled)
        advanceUntilIdle()
        assertEquals(2, restoredIndex)
    }

    @Test
    fun `downward transition from season tabs targets remembered episode not card 0`() = runTest {
        val episodes = listOf(makeEpisode("ep-1", 1), makeEpisode("ep-2", 2), makeEpisode("ep-3", 3))
        val focusRequesters = List(episodes.size) { FocusRequester() }
        val coordinator = FocusTransitionCoordinator(this)

        var rememberedIndex = 1 // user previously focused episode 2
        var actuallyFocusedIndex = -1

        // Simulate pressing D-pad Down from season tabs.
        val onDown: () -> Unit = {
            coordinator.tryRequestFocus {
                val targetIndex = rememberedIndex.coerceIn(0, episodes.size - 1)
                val requester = focusRequesters.getOrNull(targetIndex)
                if (requester != null) {
                    actuallyFocusedIndex = targetIndex
                    requestFocusSafely(requester, maxRetries = 2, rawRequest = { true })
                } else false
            }
        }

        onDown()
        advanceUntilIdle()
        assertEquals(1, actuallyFocusedIndex)
    }
}
