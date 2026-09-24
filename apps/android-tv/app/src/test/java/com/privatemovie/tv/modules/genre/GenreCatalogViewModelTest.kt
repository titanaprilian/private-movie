package com.privatemovie.tv.modules.genre

import com.privatemovie.tv.data.repository.MediaRepository
import com.privatemovie.tv.dto.models.HomeFeed
import com.privatemovie.tv.dto.models.SeriesPageMeta
import com.privatemovie.tv.dto.models.SeriesPagedData
import com.privatemovie.tv.dto.models.SeriesSummary
import com.privatemovie.tv.modules.genre.internal.GenreCatalogFilter
import com.privatemovie.tv.modules.genre.internal.GenreCatalogUiState
import com.privatemovie.tv.modules.genre.internal.shouldPrefetch
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.test.TestScope
import kotlinx.coroutines.test.UnconfinedTestDispatcher
import kotlinx.coroutines.test.runTest
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

@OptIn(ExperimentalCoroutinesApi::class)
class GenreCatalogViewModelTest {

    private val testDispatcher = UnconfinedTestDispatcher()
    private val testScope = TestScope(testDispatcher)

    private fun series(id: String) = SeriesSummary(id = id, title = "Title $id")

    private fun page(ids: List<String>, total: Int, page: Int = 1) = SeriesPagedData(
        series = ids.map { series(it) },
        meta = SeriesPageMeta(total = total, page = page, limit = 20)
    )

    private fun repoWith(
        handler: suspend (genre: String, filter: String?, page: Int, limit: Int) -> Result<SeriesPagedData>
    ): MediaRepository {
        return object : MediaRepository {
            override suspend fun getHomeFeed(): Result<HomeFeed> = Result.failure(NotImplementedError())
            override suspend fun getSeriesById(id: String) = Result.failure<com.privatemovie.tv.dto.models.SeriesDetails>(NotImplementedError())
            override suspend fun getSeriesByGenre(
                genre: String,
                filter: String?,
                page: Int,
                limit: Int
            ): Result<SeriesPagedData> = handler(genre, filter, page, limit)
        }
    }

    @Test
    fun `initial load fetches page 1 with all filter`() = testScope.runTest {
        val seen = mutableListOf<Triple<String?, Int, Int>>()
        val vm = GenreCatalogViewModel(
            mediaRepository = repoWith { genre, filter, page, limit ->
                seen.add(Triple(filter, page, limit))
                assertEquals("animation", genre)
                Result.success(page(listOf("a", "b"), total = 2))
            },
            genreSlug = "animation",
            coroutineScope = this
        )

        val state = vm.uiState.value
        assertTrue(state is GenreCatalogUiState.Success)
        val success = state as GenreCatalogUiState.Success
        assertEquals(listOf("a", "b"), success.series.map { it.id })
        assertEquals(GenreCatalogFilter.ALL, success.filter)
        assertEquals(listOf(Triple("all", 1, 20)), seen)
    }

    @Test
    fun `initial failure transitions to Error`() = testScope.runTest {
        val vm = GenreCatalogViewModel(
            mediaRepository = repoWith { _, _, _, _ -> Result.failure(RuntimeException("offline")) },
            genreSlug = "animation",
            coroutineScope = this
        )

        val state = vm.uiState.value
        assertTrue(state is GenreCatalogUiState.Error)
        assertEquals("offline", (state as GenreCatalogUiState.Error).message)
    }

    @Test
    fun `filter switch resets page and reloads with selected filter`() = testScope.runTest {
        val seenFilters = mutableListOf<String?>()
        val seenPages = mutableListOf<Int>()
        val vm = GenreCatalogViewModel(
            mediaRepository = repoWith { _, filter, page, _ ->
                seenFilters.add(filter)
                seenPages.add(page)
                Result.success(page(listOf("x"), total = 1))
            },
            genreSlug = "drama",
            coroutineScope = this
        )
        assertTrue(vm.uiState.value is GenreCatalogUiState.Success)

        vm.setFilter(GenreCatalogFilter.ONGOING)

        val state = vm.uiState.value as GenreCatalogUiState.Success
        assertEquals(GenreCatalogFilter.ONGOING, state.filter)
        assertEquals(listOf("all", "ongoing"), seenFilters)
        assertEquals(listOf(1, 1), seenPages)
    }

    @Test
    fun `pagination appends items and marks end reached`() = testScope.runTest {
        val vm = GenreCatalogViewModel(
            mediaRepository = repoWith { _, _, page, _ ->
                if (page == 1) Result.success(page(listOf("a", "b"), total = 3, page = 1))
                else Result.success(page(listOf("c"), total = 3, page = 2))
            },
            genreSlug = "drama",
            coroutineScope = this
        )

        vm.loadNextPage()

        val state = vm.uiState.value as GenreCatalogUiState.Success
        assertEquals(listOf("a", "b", "c"), state.series.map { it.id })
        assertTrue(state.endReached)
        assertFalse(state.isFetchingNextPage)
        assertFalse(state.isNextPageError)
    }

    @Test
    fun `pagination failure keeps series and sets retry flag`() = testScope.runTest {
        var calls = 0
        val vm = GenreCatalogViewModel(
            mediaRepository = repoWith { _, _, page, _ ->
                calls++
                if (page == 1) Result.success(page(listOf("a", "b"), total = 5, page = 1))
                else Result.failure(RuntimeException("page boom"))
            },
            genreSlug = "drama",
            coroutineScope = this
        )

        vm.loadNextPage()

        val state = vm.uiState.value as GenreCatalogUiState.Success
        assertEquals(listOf("a", "b"), state.series.map { it.id })
        assertTrue(state.isNextPageError)
        assertFalse(state.isFetchingNextPage)

        // Duplicate loadNextPage while error is pending must not refetch.
        vm.loadNextPage()
        assertEquals(2, calls)
    }

    @Test
    fun `retryNextPage recovers after pagination failure`() = testScope.runTest {
        var failNext = true
        val vm = GenreCatalogViewModel(
            mediaRepository = repoWith { _, _, page, _ ->
                if (page == 1) Result.success(page(listOf("a"), total = 2, page = 1))
                else if (failNext) Result.failure(RuntimeException("boom"))
                else Result.success(page(listOf("b"), total = 2, page = 2))
            },
            genreSlug = "drama",
            coroutineScope = this
        )
        vm.loadNextPage()
        assertTrue((vm.uiState.value as GenreCatalogUiState.Success).isNextPageError)

        failNext = false
        vm.retryNextPage()

        val state = vm.uiState.value as GenreCatalogUiState.Success
        assertEquals(listOf("a", "b"), state.series.map { it.id })
        assertFalse(state.isNextPageError)
        assertTrue(state.endReached)
    }

    @Test
    fun `no further fetch once end reached`() = testScope.runTest {
        var calls = 0
        val vm = GenreCatalogViewModel(
            mediaRepository = repoWith { _, _, _, _ ->
                calls++
                Result.success(page(listOf("a"), total = 1))
            },
            genreSlug = "drama",
            coroutineScope = this
        )
        assertTrue((vm.uiState.value as GenreCatalogUiState.Success).endReached)

        vm.loadNextPage()
        assertEquals(1, calls)
    }

    @Test
    fun `shouldPrefetch triggers within two rows of boundary`() {
        assertFalse(shouldPrefetch(focusedIndex = 5, totalLoaded = 20))
        assertTrue(shouldPrefetch(focusedIndex = 10, totalLoaded = 20))
        assertTrue(shouldPrefetch(focusedIndex = 19, totalLoaded = 20))
        assertFalse(shouldPrefetch(focusedIndex = 0, totalLoaded = 0))
    }
}
