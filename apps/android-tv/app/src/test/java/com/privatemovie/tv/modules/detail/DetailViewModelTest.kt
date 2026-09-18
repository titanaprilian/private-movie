package com.privatemovie.tv.modules.detail

import com.privatemovie.tv.data.repository.MediaRepository
import com.privatemovie.tv.dto.models.HomeFeed
import com.privatemovie.tv.dto.models.SeriesDetails
import com.privatemovie.tv.modules.detail.internal.DetailUiState
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.test.TestScope
import kotlinx.coroutines.test.UnconfinedTestDispatcher
import kotlinx.coroutines.test.runTest
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

@OptIn(ExperimentalCoroutinesApi::class)
class DetailViewModelTest {

    private val testDispatcher = UnconfinedTestDispatcher()
    private val testScope = TestScope(testDispatcher)

    @Test
    fun `initial state transitions to Success on valid series id`() = testScope.runTest {
        val fakeDetails = SeriesDetails(
            id = "series-1",
            title = "Test Series",
            description = "Desc",
            type = "anime",
            posterUrl = null,
            backdropUrl = null,
            logoUrl = null,
            rating = "8.5",
            isFeatured = false,
            genres = emptyList(),
            createdAt = "2026-01-01T00:00:00Z",
            updatedAt = "2026-01-01T00:00:00Z",
            seasons = emptyList(),
            episodes = emptyList()
        )

        val fakeRepo = object : MediaRepository {
            override suspend fun getHomeFeed(): Result<HomeFeed> = Result.failure(NotImplementedError())
            override suspend fun getSeriesById(id: String): Result<SeriesDetails> = Result.success(fakeDetails)
        }

        val viewModel = DetailViewModel(seriesId = "series-1", mediaRepository = fakeRepo, coroutineScope = this)
        val state = viewModel.uiState.value

        assertTrue(state is DetailUiState.Success)
        assertEquals("Test Series", (state as DetailUiState.Success).details.title)
    }

    @Test
    fun `selectSeason updates selectedSeasonIndex and resets activeEpisodeIndex`() = testScope.runTest {
        val fakeDetails = SeriesDetails(
            id = "series-1",
            title = "Test Series",
            description = null,
            type = "anime",
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

        val fakeRepo = object : MediaRepository {
            override suspend fun getHomeFeed(): Result<HomeFeed> = Result.failure(NotImplementedError())
            override suspend fun getSeriesById(id: String): Result<SeriesDetails> = Result.success(fakeDetails)
        }

        val viewModel = DetailViewModel(seriesId = "series-1", mediaRepository = fakeRepo, coroutineScope = this)
        viewModel.setEpisodeIndex(3)
        assertEquals(3, viewModel.activeEpisodeIndex.value)

        viewModel.selectSeason(1)
        assertEquals(1, viewModel.selectedSeasonIndex.value)
        assertEquals(0, viewModel.activeEpisodeIndex.value)
    }

    @Test
    fun `openSourcePicker and dismissSourcePicker update pendingSourcePickerEpisode state`() = testScope.runTest {
        val fakeRepo = object : MediaRepository {
            override suspend fun getHomeFeed(): Result<HomeFeed> = Result.failure(NotImplementedError())
            override suspend fun getSeriesById(id: String): Result<SeriesDetails> =
                Result.failure(RuntimeException("Not needed"))
        }

        val viewModel = DetailViewModel(seriesId = "series-1", mediaRepository = fakeRepo, coroutineScope = this)
        assertNull(viewModel.pendingSourcePickerEpisode.value)

        val fakeEp = com.privatemovie.tv.modules.detail.internal.TvEpisode(
            id = "ep-10",
            order = 1,
            title = "Ep 1",
            description = "Ep desc",
            thumbnailUrl = null,
            videoSources = emptyList()
        )

        viewModel.openSourcePicker(fakeEp)
        assertEquals(fakeEp, viewModel.pendingSourcePickerEpisode.value)

        viewModel.dismissSourcePicker()
        assertNull(viewModel.pendingSourcePickerEpisode.value)
    }
}
