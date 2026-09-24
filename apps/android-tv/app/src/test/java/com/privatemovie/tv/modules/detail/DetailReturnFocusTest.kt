package com.privatemovie.tv.modules.detail

import com.privatemovie.tv.data.repository.MediaRepository
import com.privatemovie.tv.dto.models.HomeFeed
import com.privatemovie.tv.dto.models.SeriesDetails
import com.privatemovie.tv.modules.detail.internal.DetailUiState
import com.privatemovie.tv.modules.detail.internal.TvEpisode
import com.privatemovie.tv.modules.detail.internal.TvSeason
import com.privatemovie.tv.modules.detail.internal.TvSeriesDetails
import com.privatemovie.tv.modules.detail.internal.resolveDetailReturnFocus
import com.privatemovie.tv.modules.detail.internal.shouldFocusReturnEpisode
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.test.TestScope
import kotlinx.coroutines.test.UnconfinedTestDispatcher
import kotlinx.coroutines.test.runTest
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

@OptIn(ExperimentalCoroutinesApi::class)
class DetailReturnFocusTest {

    private val testDispatcher = UnconfinedTestDispatcher()
    private val testScope = TestScope(testDispatcher)

    private fun makeEpisode(id: String, order: Int) = TvEpisode(
        id = id,
        title = "Episode $order",
        order = order,
        description = null,
        thumbnailUrl = null,
        videoSources = emptyList()
    )

    private fun makeDetails() = TvSeriesDetails(
        id = "s-1",
        title = "Show",
        type = "tv",
        isFeatured = false,
        genres = emptyList(),
        description = null,
        posterUrl = null,
        backdropUrl = null,
        rating = null,
        seasons = listOf(
            TvSeason(
                id = "season-1",
                title = "Season 1",
                seasonNumber = 1,
                description = null,
                episodes = listOf(makeEpisode("ep-1", 1), makeEpisode("ep-2", 2))
            ),
            TvSeason(
                id = "season-2",
                title = "Season 2",
                seasonNumber = 2,
                description = null,
                episodes = listOf(makeEpisode("ep-3", 1), makeEpisode("ep-4", 2))
            )
        ),
        standaloneEpisodes = listOf(makeEpisode("movie-1", 1))
    )

    private fun viewModelFor(detailsDto: SeriesDetails) = DetailViewModel(
        seriesId = "series-1",
        mediaRepository = object : MediaRepository {
            override suspend fun getHomeFeed(): Result<HomeFeed> = Result.failure(NotImplementedError())
            override suspend fun getSeriesById(id: String): Result<SeriesDetails> = Result.success(detailsDto)
        },
        coroutineScope = testScope
    )

    private fun seriesDto() = SeriesDetails(
        id = "series-1",
        title = "Show",
        description = null,
        type = "tv",
        posterUrl = null,
        backdropUrl = null,
        logoUrl = null,
        rating = null,
        isFeatured = false,
        genres = emptyList(),
        createdAt = "2026-01-01T00:00:00Z",
        updatedAt = "2026-01-01T00:00:00Z",
        seasons = emptyList(),
        episodes = emptyList()
    )

    @Test
    fun `resolveDetailReturnFocus targets episode in second season`() {
        val target = resolveDetailReturnFocus(makeDetails(), "ep-4")
        assertNotNull(target)
        assertEquals(1, target!!.seasonIndex)
        assertEquals(1, target.episodeIndex)
        assertEquals("ep-4", target.episodeId)
        assertFalse(target.isStandalone)
        assertTrue(shouldFocusReturnEpisode(target))
    }

    @Test
    fun `resolveDetailReturnFocus targets standalone episode`() {
        val target = resolveDetailReturnFocus(makeDetails(), "movie-1")
        assertNotNull(target)
        assertEquals(0, target!!.episodeIndex)
        assertTrue(target.isStandalone)
    }

    @Test
    fun `resolveDetailReturnFocus returns null for blank or unknown ids`() {
        val details = makeDetails()
        assertNull(resolveDetailReturnFocus(details, null))
        assertNull(resolveDetailReturnFocus(details, ""))
        assertNull(resolveDetailReturnFocus(details, "nope"))
        assertFalse(shouldFocusReturnEpisode(null))
    }

    @Test
    fun `applyPlayerReturn updates season and episode index plus pending focus`() = testScope.runTest {
        val dto = seriesDto().copy(
            seasons = listOf(
                com.privatemovie.tv.dto.models.SeasonWithEpisodes(
                    id = "season-1",
                    seriesId = "series-1",
                    title = "Season 1",
                    status = "published",
                    createdAt = "2026-01-01T00:00:00Z",
                    updatedAt = "2026-01-01T00:00:00Z",
                    seasonNumber = 1,
                    episodes = listOf(
                        com.privatemovie.tv.dto.models.EpisodeWithSources(
                            id = "ep-1",
                            title = "Ep 1",
                            order = 1,
                            createdAt = "2026-01-01T00:00:00Z",
                            updatedAt = "2026-01-01T00:00:00Z",
                            videoSources = emptyList()
                        ),
                        com.privatemovie.tv.dto.models.EpisodeWithSources(
                            id = "ep-2",
                            title = "Ep 2",
                            order = 2,
                            createdAt = "2026-01-01T00:00:00Z",
                            updatedAt = "2026-01-01T00:00:00Z",
                            videoSources = emptyList()
                        )
                    )
                )
            )
        )
        val vm = viewModelFor(dto)
        assertTrue(vm.uiState.value is DetailUiState.Success)

        // Unknown id is a no-op and leaves no pending focus.
        assertNull(vm.applyPlayerReturn("unknown-ep"))
        assertNull(vm.pendingReturnFocus.value)

        // Latest played episode (e.g. after "Next Episode" in the player)
        // targets its card directly.
        val target = vm.applyPlayerReturn("ep-2")
        assertNotNull(target)
        assertEquals(0, vm.selectedSeasonIndex.value)
        assertEquals(1, vm.activeEpisodeIndex.value)
        assertEquals("ep-2", vm.pendingReturnFocus.value?.episodeId)

        vm.consumeReturnFocus()
        assertNull(vm.pendingReturnFocus.value)
        // Consuming focus must not reset the remembered episode index.
        assertEquals(1, vm.activeEpisodeIndex.value)
    }

    @Test
    fun `loadDetails retains Success state instead of flashing Loading`() = testScope.runTest {
        val vm = viewModelFor(seriesDto())
        assertTrue(vm.uiState.value is DetailUiState.Success)
        vm.loadDetails()
        // Must not re-trigger a loading flash when returning from the player.
        assertTrue(vm.uiState.value is DetailUiState.Success)
    }

    @Test
    fun `retry forces reload even after success`() = testScope.runTest {
        var calls = 0
        val vm = DetailViewModel(
            seriesId = "series-1",
            mediaRepository = object : MediaRepository {
                override suspend fun getHomeFeed(): Result<HomeFeed> = Result.failure(NotImplementedError())
                override suspend fun getSeriesById(id: String): Result<SeriesDetails> {
                    calls++
                    return Result.success(seriesDto())
                }
            },
            coroutineScope = testScope
        )
        assertEquals(1, calls)
        vm.retry()
        assertEquals(2, calls)
        assertTrue(vm.uiState.value is DetailUiState.Success)
    }

    @Test
    fun `consumeReturnFocus clears pending focus`() = testScope.runTest {
        val vm = viewModelFor(seriesDto())
        vm.consumeReturnFocus()
        assertNull(vm.pendingReturnFocus.value)
    }
}
