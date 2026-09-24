package com.privatemovie.tv.modules.search

import com.privatemovie.tv.data.repository.MediaRepository
import com.privatemovie.tv.dto.models.HomeFeed
import com.privatemovie.tv.dto.models.SeriesDetails
import com.privatemovie.tv.dto.models.SeriesSummary
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.test.TestScope
import kotlinx.coroutines.test.UnconfinedTestDispatcher
import kotlinx.coroutines.test.advanceTimeBy
import kotlinx.coroutines.test.runTest
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

@OptIn(ExperimentalCoroutinesApi::class)
class SearchViewModelTest {

    private fun series(id: String) = SeriesSummary(id = id, title = "Title $id")

    private fun repoWith(handler: suspend (query: String, limit: Int) -> Result<List<SeriesSummary>>): MediaRepository {
        return object : MediaRepository {
            override suspend fun getHomeFeed(): Result<HomeFeed> = Result.failure(NotImplementedError())
            override suspend fun getSeriesById(id: String): Result<SeriesDetails> = Result.failure(NotImplementedError())
            override suspend fun searchSeries(query: String, limit: Int): Result<List<SeriesSummary>> =
                handler(query, limit)
        }
    }

    @Test
    fun `debounces rapid input and issues single search with limit 20`() = runTest {
        val dispatcher = UnconfinedTestDispatcher(testScheduler)
        val scope = TestScope(dispatcher)
        var calls = 0
        var lastQuery = ""
        var lastLimit = 0
        val vm = SearchViewModel(
            mediaRepository = repoWith { q, limit ->
                calls++
                lastQuery = q
                lastLimit = limit
                Result.success(listOf(series("1")))
            },
            debounceMs = 300L,
            coroutineScope = scope
        )

        vm.onQueryChange("a")
        vm.onQueryChange("ab")
        vm.onQueryChange("abc")
        assertEquals(0, calls)
        assertTrue(vm.uiState.value.isLoading)

        scope.advanceTimeBy(400L)
        assertEquals(1, calls)
        assertEquals("abc", lastQuery)
        assertEquals(20, lastLimit)
        assertEquals(listOf("1"), vm.uiState.value.results.map { it.id })
        assertFalse(vm.uiState.value.isLoading)
        assertTrue(vm.uiState.value.hasSearched)
    }

    @Test
    fun `successful search populates results`() = runTest {
        val dispatcher = UnconfinedTestDispatcher(testScheduler)
        val scope = TestScope(dispatcher)
        val vm = SearchViewModel(
            mediaRepository = repoWith { _, _ ->
                Result.success(listOf(series("1"), series("2"), series("3")))
            },
            debounceMs = 300L,
            coroutineScope = scope
        )

        vm.onQueryChange("demon")
        scope.advanceTimeBy(400L)

        assertEquals(listOf("1", "2", "3"), vm.uiState.value.results.map { it.id })
        assertEquals("demon", vm.uiState.value.query)
        assertFalse(vm.uiState.value.isLoading)
    }

    @Test
    fun `blank query clears results without network call`() = runTest {
        val dispatcher = UnconfinedTestDispatcher(testScheduler)
        val scope = TestScope(dispatcher)
        var calls = 0
        val vm = SearchViewModel(
            mediaRepository = repoWith { _, _ ->
                calls++
                Result.success(listOf(series("1")))
            },
            debounceMs = 300L,
            coroutineScope = scope
        )

        vm.onQueryChange("abc")
        scope.advanceTimeBy(400L)
        assertEquals(1, calls)
        assertTrue(vm.uiState.value.hasSearched)

        vm.onQueryChange("   ")
        assertEquals(1, calls)
        assertTrue(vm.uiState.value.results.isEmpty())
        assertFalse(vm.uiState.value.isLoading)
        assertFalse(vm.uiState.value.hasSearched)
    }

    @Test
    fun `empty results map to empty state after search`() = runTest {
        val dispatcher = UnconfinedTestDispatcher(testScheduler)
        val scope = TestScope(dispatcher)
        val vm = SearchViewModel(
            mediaRepository = repoWith { _, _ -> Result.success(emptyList()) },
            debounceMs = 300L,
            coroutineScope = scope
        )

        vm.onQueryChange("zzz-no-match")
        scope.advanceTimeBy(400L)

        assertTrue(vm.uiState.value.results.isEmpty())
        assertTrue(vm.uiState.value.hasSearched)
        assertFalse(vm.uiState.value.isLoading)
    }

    @Test
    fun `failure suppresses error and yields empty results`() = runTest {
        val dispatcher = UnconfinedTestDispatcher(testScheduler)
        val scope = TestScope(dispatcher)
        val vm = SearchViewModel(
            mediaRepository = repoWith { _, _ -> Result.failure(RuntimeException("offline")) },
            debounceMs = 300L,
            coroutineScope = scope
        )

        vm.onQueryChange("abc")
        scope.advanceTimeBy(400L)

        assertTrue(vm.uiState.value.results.isEmpty())
        assertFalse(vm.uiState.value.isLoading)
        assertTrue(vm.uiState.value.hasSearched)
        assertEquals("abc", vm.uiState.value.query)
    }
}
