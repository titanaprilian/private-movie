package com.privatemovie.tv.modules.home

import com.privatemovie.tv.data.repository.MediaRepository
import com.privatemovie.tv.dto.models.GenreItem
import com.privatemovie.tv.dto.models.HomeFeed
import com.privatemovie.tv.modules.home.internal.CatalogHeaderUiState
import com.privatemovie.tv.modules.home.internal.CatalogTopBarViewModel
import com.privatemovie.tv.modules.home.internal.selectBigGenres
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.test.TestScope
import kotlinx.coroutines.test.UnconfinedTestDispatcher
import kotlinx.coroutines.test.runTest
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

@OptIn(ExperimentalCoroutinesApi::class)
class CatalogTopBarStateTest {

    private val testDispatcher = UnconfinedTestDispatcher()
    private val testScope = TestScope(testDispatcher)

    private fun genre(id: String, order: Int, big: Boolean) = GenreItem(
        id = id,
        name = id,
        slug = id.lowercase(),
        isBigGenre = big,
        displayOrder = order
    )

    private fun repoWith(genres: Result<List<GenreItem>>): MediaRepository {
        return object : MediaRepository {
            override suspend fun getHomeFeed(): Result<HomeFeed> = Result.failure(NotImplementedError())
            override suspend fun getSeriesById(id: String) = Result.failure<com.privatemovie.tv.dto.models.SeriesDetails>(NotImplementedError())
            override suspend fun getGenres(): Result<List<GenreItem>> = genres
        }
    }

    @Test
    fun `selectBigGenres filters non-big genres and sorts by displayOrder`() {
        val input = listOf(
            genre("Drama", 2, true),
            genre("Niche", 0, false),
            genre("Animation", 1, true),
            genre("Comedy", 0, true)
        )

        val result = selectBigGenres(input)

        assertEquals(listOf("Comedy", "Animation", "Drama"), result.map { it.name })
    }

    @Test
    fun `viewModel exposes ordered big genres on success`() = testScope.runTest {
        val vm = CatalogTopBarViewModel(
            mediaRepository = repoWith(
                Result.success(
                    listOf(
                        genre("Drama", 2, true),
                        genre("Niche", 0, false),
                        genre("Animation", 1, true)
                    )
                )
            ),
            coroutineScope = this
        )

        val state = vm.uiState.value
        assertTrue(state is CatalogHeaderUiState.Success)
        assertEquals(
            listOf("Animation", "Drama"),
            (state as CatalogHeaderUiState.Success).bigGenres.map { it.name }
        )
    }

    @Test
    fun `viewModel transitions to Error when repository fails`() = testScope.runTest {
        val vm = CatalogTopBarViewModel(
            mediaRepository = repoWith(Result.failure(RuntimeException("offline"))),
            coroutineScope = this
        )

        val state = vm.uiState.value
        assertTrue(state is CatalogHeaderUiState.Error)
        assertEquals("offline", (state as CatalogHeaderUiState.Error).message)
    }

    @Test
    fun `retry reloads genres after failure`() = testScope.runTest {
        var calls = 0
        val repo = object : MediaRepository {
            override suspend fun getHomeFeed(): Result<HomeFeed> = Result.failure(NotImplementedError())
            override suspend fun getSeriesById(id: String) = Result.failure<com.privatemovie.tv.dto.models.SeriesDetails>(NotImplementedError())
            override suspend fun getGenres(): Result<List<GenreItem>> {
                calls++
                return if (calls == 1) Result.failure(RuntimeException("boom"))
                else Result.success(listOf(genre("Animation", 0, true)))
            }
        }
        val vm = CatalogTopBarViewModel(mediaRepository = repo, coroutineScope = this)
        assertTrue(vm.uiState.value is CatalogHeaderUiState.Error)

        vm.retry()
        val state = vm.uiState.value
        assertTrue(state is CatalogHeaderUiState.Success)
        assertEquals(2, calls)
    }
}
