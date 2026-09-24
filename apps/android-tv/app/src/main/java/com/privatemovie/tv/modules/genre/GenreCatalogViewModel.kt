package com.privatemovie.tv.modules.genre

import com.privatemovie.tv.data.repository.MediaRepository
import com.privatemovie.tv.modules.genre.internal.GenreCatalogFilter
import com.privatemovie.tv.modules.genre.internal.GenreCatalogUiState
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

/**
 * State holder for the Big Genre catalog screen.
 *
 * Manages the active filter (`all` vs `ongoing`), the paged series list for
 * [genreSlug], incremental pagination, and per-page error states. Switching
 * the filter resets to page 1 and reloads. A failed incremental fetch sets
 * `isNextPageError` without wiping already loaded series.
 */
class GenreCatalogViewModel(
    private val mediaRepository: MediaRepository,
    val genreSlug: String,
    private val pageLimit: Int = 20,
    private val coroutineScope: CoroutineScope = CoroutineScope(SupervisorJob() + Dispatchers.Main.immediate)
) {
    private val _uiState = MutableStateFlow<GenreCatalogUiState>(GenreCatalogUiState.Loading)
    val uiState: StateFlow<GenreCatalogUiState> = _uiState.asStateFlow()

    private var currentPage = 1

    init {
        loadPage(page = 1, filter = GenreCatalogFilter.ALL, initial = true)
    }

    fun setFilter(filter: GenreCatalogFilter) {
        val current = _uiState.value
        if (current is GenreCatalogUiState.Success && current.filter == filter) return
        loadPage(page = 1, filter = filter, initial = true)
    }

    fun loadNextPage() {
        val current = _uiState.value as? GenreCatalogUiState.Success ?: return
        if (current.isFetchingNextPage || current.isNextPageError || current.endReached) return
        loadPage(page = currentPage + 1, filter = current.filter, initial = false)
    }

    fun retry() {
        val current = _uiState.value
        val filter = (current as? GenreCatalogUiState.Success)?.filter ?: GenreCatalogFilter.ALL
        val page = if (current is GenreCatalogUiState.Success && current.series.isNotEmpty()) currentPage else 1
        loadPage(page = page, filter = filter, initial = page == 1)
    }

    fun retryNextPage() {
        val current = _uiState.value as? GenreCatalogUiState.Success ?: return
        _uiState.value = current.copy(isNextPageError = false)
        loadPage(page = currentPage + 1, filter = current.filter, initial = false)
    }

    private fun loadPage(page: Int, filter: GenreCatalogFilter, initial: Boolean) {
        if (initial) {
            currentPage = 1
            _uiState.value = GenreCatalogUiState.Loading
        } else {
            val current = _uiState.value as? GenreCatalogUiState.Success ?: return
            _uiState.value = current.copy(isFetchingNextPage = true, isNextPageError = false)
        }
        coroutineScope.launch {
            val result = mediaRepository.getSeriesByGenre(
                genre = genreSlug,
                filter = filter.apiValue,
                page = page,
                limit = pageLimit
            )
            result.fold(
                onSuccess = { pageResult ->
                    currentPage = page
                    val previous = if (initial) {
                        emptyList()
                    } else {
                        (_uiState.value as? GenreCatalogUiState.Success)?.series ?: emptyList()
                    }
                    val combined = previous + pageResult.series
                    _uiState.value = GenreCatalogUiState.Success(
                        series = combined,
                        filter = filter,
                        total = pageResult.meta.total,
                        isFetchingNextPage = false,
                        isNextPageError = false,
                        endReached = combined.size >= pageResult.meta.total
                    )
                },
                onFailure = { throwable ->
                    if (initial) {
                        _uiState.value = GenreCatalogUiState.Error(
                            throwable.message ?: "Failed to load catalog"
                        )
                    } else {
                        val current = _uiState.value as? GenreCatalogUiState.Success
                        _uiState.value = current?.copy(
                            isFetchingNextPage = false,
                            isNextPageError = true
                        ) ?: GenreCatalogUiState.Error(
                            throwable.message ?: "Failed to load catalog"
                        )
                    }
                }
            )
        }
    }
}
