package com.privatemovie.tv.modules.search

import com.privatemovie.tv.data.repository.MediaRepository
import com.privatemovie.tv.dto.models.SeriesSummary
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

/**
 * UI state for the dedicated TV Search Screen.
 *
 * @param query current text in the search field.
 * @param results matching series from `searchSeries`.
 * @param isLoading true while a debounced search request is in flight.
 * @param hasSearched true once a debounced search has completed at least once.
 */
data class SearchUiState(
    val query: String = "",
    val results: List<SeriesSummary> = emptyList(),
    val isLoading: Boolean = false,
    val hasSearched: Boolean = false
)

/**
 * Debounced search state holder for the dedicated TV Search Screen.
 *
 * - [onQueryChange] debounces input by [debounceMs] then invokes
 *   `MediaRepository.searchSeries(query, limit)`.
 * - Blank queries clear results without a network call.
 * - Failures suppress the error (empty results) so typing never breaks navigation.
 * - [clear] resets query, results, and searched flag.
 */
class SearchViewModel(
    private val mediaRepository: MediaRepository,
    private val searchLimit: Int = 20,
    private val debounceMs: Long = 300L,
    private val coroutineScope: CoroutineScope = CoroutineScope(SupervisorJob() + Dispatchers.Main.immediate)
) {
    private val _uiState = MutableStateFlow(SearchUiState())
    val uiState: StateFlow<SearchUiState> = _uiState.asStateFlow()

    private var searchJob: Job? = null

    fun onQueryChange(query: String) {
        searchJob?.cancel()
        if (query.isBlank()) {
            _uiState.value = SearchUiState(query = query)
            return
        }
        _uiState.value = _uiState.value.copy(query = query, isLoading = true)
        searchJob = coroutineScope.launch {
            delay(debounceMs)
            val result = mediaRepository.searchSeries(query, searchLimit)
            result.fold(
                onSuccess = { series ->
                    _uiState.value = _uiState.value.copy(
                        results = series.take(searchLimit),
                        isLoading = false,
                        hasSearched = true
                    )
                },
                onFailure = {
                    _uiState.value = _uiState.value.copy(
                        results = emptyList(),
                        isLoading = false,
                        hasSearched = true
                    )
                }
            )
        }
    }

    /** Resets the search field, results, and searched flag. */
    fun clear() {
        searchJob?.cancel()
        _uiState.value = SearchUiState()
    }
}
