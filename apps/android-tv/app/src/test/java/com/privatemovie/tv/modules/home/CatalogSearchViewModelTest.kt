package com.privatemovie.tv.modules.home

import com.privatemovie.tv.data.repository.MediaRepository
import com.privatemovie.tv.dto.models.HomeFeed
import com.privatemovie.tv.dto.models.SeriesSummary
import com.privatemovie.tv.modules.home.internal.CatalogSearchViewModel
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
class CatalogSearchViewModelTest {

    private fun series(id: String) = SeriesSummary(id = id, title = "Title $id")

    private fun repoWith(handler: suspend (query: String, limit: Int) -> Result<List<SeriesSummary>>): MediaRepository {
        return object : MediaRepository {
            override suspend fun getHomeFeed(): Result<HomeFeed> = Result.failure(NotImplementedError())
            override suspend fun getSeriesById(id: String) = Result.failure<com.privatemovie.tv.dto.models.SeriesDetails>(NotImplementedError())
            override suspend fun searchSeries(query: String, limit: Int): Result<List<SeriesSummary>> =
                handler(query, limit)
        }
    }

    @Test
    fun `debounces rapid input and issues single search`() = runTest {
        val dispatcher = UnconfinedTestDispatcher(testScheduler)
        val scope = TestScope(dispatcher)
        var calls = 0
        var lastQuery = ""
        val vm = CatalogSearchViewModel(
            mediaRepository = repoWith { q, _ ->
                calls++
                lastQuery = q
                Result.success(listOf(series("1")))
            },
            debounceMs = 300L,
            coroutineScope = scope
        )

        vm.onQueryChange("a")
        vm.onQueryChange("ab")
        vm.onQueryChange("abc")
        assertEquals(0, calls)

        scope.advanceTimeBy(400L)
        assertEquals(1, calls)
        assertEquals("abc", lastQuery)
        assertEquals(listOf("1"), vm.uiState.value.suggestions.map { it.id })
        assertTrue(vm.uiState.value.isDropdownOpen)
    }

    @Test
    fun `blank query clears suggestions without network call`() = runTest {
        val dispatcher = UnconfinedTestDispatcher(testScheduler)
        val scope = TestScope(dispatcher)
        var calls = 0
        val vm = CatalogSearchViewModel(
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
        assertTrue(vm.uiState.value.isDropdownOpen)

        vm.onQueryChange("   ")
        assertEquals(1, calls)
        assertTrue(vm.uiState.value.suggestions.isEmpty())
        assertFalse(vm.uiState.value.isDropdownOpen)
    }

    @Test
    fun `failure suppresses error and closes dropdown`() = runTest {
        val dispatcher = UnconfinedTestDispatcher(testScheduler)
        val scope = TestScope(dispatcher)
        val vm = CatalogSearchViewModel(
            mediaRepository = repoWith { _, _ -> Result.failure(RuntimeException("offline")) },
            debounceMs = 300L,
            coroutineScope = scope
        )

        vm.onQueryChange("abc")
        scope.advanceTimeBy(400L)

        assertTrue(vm.uiState.value.suggestions.isEmpty())
        assertFalse(vm.uiState.value.isDropdownOpen)
        assertFalse(vm.uiState.value.isLoading)
        assertEquals("abc", vm.uiState.value.query)
    }

    @Test
    fun `dismiss closes dropdown but retains query`() = runTest {
        val dispatcher = UnconfinedTestDispatcher(testScheduler)
        val scope = TestScope(dispatcher)
        val vm = CatalogSearchViewModel(
            mediaRepository = repoWith { _, _ -> Result.success(listOf(series("1"), series("2"))) },
            debounceMs = 300L,
            coroutineScope = scope
        )

        vm.onQueryChange("ab")
        scope.advanceTimeBy(400L)
        assertTrue(vm.uiState.value.isDropdownOpen)

        vm.dismiss()
        assertFalse(vm.uiState.value.isDropdownOpen)
        assertEquals("ab", vm.uiState.value.query)
        assertEquals(2, vm.uiState.value.suggestions.size)
    }

    @Test
    fun `caps suggestions at search limit`() = runTest {
        val dispatcher = UnconfinedTestDispatcher(testScheduler)
        val scope = TestScope(dispatcher)
        val vm = CatalogSearchViewModel(
            mediaRepository = repoWith { _, _ ->
                Result.success((1..8).map { series("$it") })
            },
            searchLimit = 5,
            debounceMs = 300L,
            coroutineScope = scope
        )

        vm.onQueryChange("a")
        scope.advanceTimeBy(400L)

        assertEquals(5, vm.uiState.value.suggestions.size)
    }
}
