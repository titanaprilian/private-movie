package com.privatemovie.tv.modules.home.internal

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
 * UI state for the TV header search component.
 *
 * @param query current text in the search field.
 * @param suggestions up to 5 matching series from `searchSeries`.
 * @param isDropdownOpen true while the floating suggestions overlay is visible.
 * @param isLoading true while a debounced search request is in flight.
 */
data class CatalogSearchUiState(
    val query: String = "",
    val suggestions: List<SeriesSummary> = emptyList(),
    val isDropdownOpen: Boolean = false,
    val isLoading: Boolean = false
)

/**
 * Debounced search state holder for the TV header.
 *
 * - [onQueryChange] debounces input by [debounceMs] then invokes
 *   `MediaRepository.searchSeries(query, limit)`.
 * - Blank queries clear suggestions and close the dropdown without a network call.
 * - Failures suppress the error (empty suggestions, dropdown closed) so typing
 *   never breaks header navigation.
 * - [dismiss] closes the dropdown while retaining the query and focus target.
 * - [clear] resets query, suggestions, and dropdown.
 */
class CatalogSearchViewModel(
    private val mediaRepository: MediaRepository,
    private val searchLimit: Int = 5,
    private val debounceMs: Long = 300L,
    private val coroutineScope: CoroutineScope = CoroutineScope(SupervisorJob() + Dispatchers.Main.immediate)
) {
    private val _uiState = MutableStateFlow(CatalogSearchUiState())
    val uiState: StateFlow<CatalogSearchUiState> = _uiState.asStateFlow()

    private var searchJob: Job? = null

    fun onQueryChange(query: String) {
        searchJob?.cancel()
        if (query.isBlank()) {
            _uiState.value = CatalogSearchUiState(query = query)
            return
        }
        _uiState.value = _uiState.value.copy(query = query, isLoading = true)
        searchJob = coroutineScope.launch {
            delay(debounceMs)
            val result = mediaRepository.searchSeries(query, searchLimit)
            result.fold(
                onSuccess = { series ->
                    _uiState.value = _uiState.value.copy(
                        suggestions = series.take(searchLimit),
                        isDropdownOpen = series.isNotEmpty(),
                        isLoading = false
                    )
                },
                onFailure = {
                    _uiState.value = _uiState.value.copy(
                        suggestions = emptyList(),
                        isDropdownOpen = false,
                        isLoading = false
                    )
                }
            )
        }
    }

    /** Closes the suggestions dropdown, retaining the query and focus on the field. */
    fun dismiss() {
        searchJob?.cancel()
        _uiState.value = _uiState.value.copy(
            suggestions = _uiState.value.suggestions,
            isDropdownOpen = false,
            isLoading = false
        )
    }

    /** Resets the search field, suggestions, and dropdown. */
    fun clear() {
        searchJob?.cancel()
        _uiState.value = CatalogSearchUiState()
    }
}
