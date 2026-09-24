package com.privatemovie.tv.modules.genre.internal

import com.privatemovie.tv.dto.models.SeriesSummary

/** Catalog filter pills on the Big Genre screen. */
enum class GenreCatalogFilter(val apiValue: String, val label: String) {
    ALL("all", "All"),
    ONGOING("ongoing", "Ongoing")
}

/** UI state for the Big Genre catalog screen. */
sealed interface GenreCatalogUiState {
    data object Loading : GenreCatalogUiState
    data class Error(val message: String) : GenreCatalogUiState
    data class Success(
        val series: List<SeriesSummary>,
        val filter: GenreCatalogFilter,
        val total: Int,
        val isFetchingNextPage: Boolean = false,
        val isNextPageError: Boolean = false,
        val endReached: Boolean = false
    ) : GenreCatalogUiState
}

/**
 * Prefetch trigger for infinite lazy-loading: start fetching the next page
 * when focus lands within [prefetchDistance] items of the loaded boundary
 * (2 grid rows of 5 columns by default).
 */
fun shouldPrefetch(focusedIndex: Int, totalLoaded: Int, prefetchDistance: Int = 10): Boolean {
    if (totalLoaded <= 0) return false
    return focusedIndex >= totalLoaded - prefetchDistance
}
