package com.privatemovie.tv.modules.home

import com.privatemovie.tv.data.repository.MediaRepository
import com.privatemovie.tv.dto.models.HomeFeed
import com.privatemovie.tv.modules.home.internal.HomeUiState
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.test.TestScope
import kotlinx.coroutines.test.UnconfinedTestDispatcher
import kotlinx.coroutines.test.runTest
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

@OptIn(ExperimentalCoroutinesApi::class)
class HomeViewModelTest {

    private val testDispatcher = UnconfinedTestDispatcher()
    private val testScope = TestScope(testDispatcher)

    @Test
    fun `initial state is Loading then transitions to Success on repository resolution`() = testScope.runTest {
        val fakeFeed = HomeFeed(hero = null, heroes = emptyList(), rows = emptyList())
        val fakeRepo = object : MediaRepository {
            override suspend fun getHomeFeed(): Result<HomeFeed> = Result.success(fakeFeed)
            override suspend fun getSeriesById(id: String): Result<com.privatemovie.tv.dto.models.SeriesDetails> =
                Result.failure(NotImplementedError())
        }

        val viewModel = HomeViewModel(mediaRepository = fakeRepo, coroutineScope = this)
        val state = viewModel.uiState.value

        assertTrue(state is HomeUiState.Success)
    }

    @Test
    fun `transitions to Error state when repository returns failure`() = testScope.runTest {
        val fakeRepo = object : MediaRepository {
            override suspend fun getHomeFeed(): Result<HomeFeed> =
                Result.failure(RuntimeException("Network error"))

            override suspend fun getSeriesById(id: String): Result<com.privatemovie.tv.dto.models.SeriesDetails> =
                Result.failure(NotImplementedError())
        }

        val viewModel = HomeViewModel(mediaRepository = fakeRepo, coroutineScope = this)
        val state = viewModel.uiState.value

        assertTrue(state is HomeUiState.Error)
        assertEquals("Network error", (state as HomeUiState.Error).message)
    }

    @Test
    fun `retry re-executes loadFeed`() = testScope.runTest {
        var callCount = 0
        val fakeRepo = object : MediaRepository {
            override suspend fun getHomeFeed(): Result<HomeFeed> {
                callCount++
                return if (callCount == 1) {
                    Result.failure(RuntimeException("First failure"))
                } else {
                    Result.success(HomeFeed(hero = null, heroes = emptyList(), rows = emptyList()))
                }
            }

            override suspend fun getSeriesById(id: String): Result<com.privatemovie.tv.dto.models.SeriesDetails> =
                Result.failure(NotImplementedError())
        }

        val viewModel = HomeViewModel(mediaRepository = fakeRepo, coroutineScope = this)
        assertTrue(viewModel.uiState.value is HomeUiState.Error)

        viewModel.retry()
        assertTrue(viewModel.uiState.value is HomeUiState.Success)
        assertEquals(2, callCount)
    }
}
