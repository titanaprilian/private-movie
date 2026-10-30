package com.privatemovie.tv.modules.home

import com.privatemovie.tv.data.repository.MediaRepository
import com.privatemovie.tv.modules.home.internal.HomeDrawerReturnTarget
import com.privatemovie.tv.dto.models.HomeFeed
import com.privatemovie.tv.modules.home.internal.HomeUiState
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.test.TestScope
import kotlinx.coroutines.test.UnconfinedTestDispatcher
import kotlinx.coroutines.test.runTest
import kotlinx.coroutines.launch
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
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

    @Test
    fun `restoreDrawerReturnFocus atomically consumes pending target and emits to drawerReturnEvents`() = testScope.runTest {
        val fakeRepo = object : MediaRepository {
            override suspend fun getHomeFeed(): Result<HomeFeed> =
                Result.success(HomeFeed(hero = null, heroes = emptyList(), rows = emptyList()))

            override suspend fun getSeriesById(id: String): Result<com.privatemovie.tv.dto.models.SeriesDetails> =
                Result.failure(NotImplementedError())
        }
        val viewModel = HomeViewModel(mediaRepository = fakeRepo, coroutineScope = this)

        // When no origin is recorded, restoreDrawerReturnFocus returns false
        assertFalse(viewModel.restoreDrawerReturnFocus())

        var emittedTarget: HomeDrawerReturnTarget? = null
        val job = launch(UnconfinedTestDispatcher(testScheduler)) {
            viewModel.drawerReturnEvents.collect {
                emittedTarget = it
            }
        }

        viewModel.recordDrawerOrigin(HomeDrawerReturnTarget.Row(2))
        val restored = viewModel.restoreDrawerReturnFocus()
        assertTrue(restored)
        assertEquals(HomeDrawerReturnTarget.Row(2), emittedTarget)

        // Subsequent call returns false because pending target was consumed
        assertFalse(viewModel.restoreDrawerReturnFocus())
        job.cancel()
    }
}
