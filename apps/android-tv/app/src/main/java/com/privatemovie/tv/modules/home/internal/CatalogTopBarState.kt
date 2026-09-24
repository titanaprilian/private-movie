package com.privatemovie.tv.modules.home.internal

import com.privatemovie.tv.data.repository.MediaRepository
import com.privatemovie.tv.dto.models.GenreItem
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

/**
 * Returns only big-genre entries ordered by [GenreItem.displayOrder] ascending.
 *
 * Pure function so header ordering is unit-testable without Compose.
 */
fun selectBigGenres(genres: List<GenreItem>): List<GenreItem> {
    return genres
        .filter { it.isBigGenre }
        .sortedBy { it.displayOrder }
}

/** UI state for the unified TV header genre links. */
sealed interface CatalogHeaderUiState {
    data object Loading : CatalogHeaderUiState
    data class Success(val bigGenres: List<GenreItem>) : CatalogHeaderUiState
    data class Error(val message: String) : CatalogHeaderUiState
}

/**
 * Loads genres via [MediaRepository] and exposes the filtered big-genre list
 * for [CatalogTopBar]-style headers.
 */
class CatalogTopBarViewModel(
    private val mediaRepository: MediaRepository,
    private val coroutineScope: CoroutineScope = CoroutineScope(SupervisorJob() + Dispatchers.Main.immediate)
) {
    private val _uiState = MutableStateFlow<CatalogHeaderUiState>(CatalogHeaderUiState.Loading)
    val uiState: StateFlow<CatalogHeaderUiState> = _uiState.asStateFlow()

    init {
        loadGenres()
    }

    fun loadGenres() {
        _uiState.value = CatalogHeaderUiState.Loading
        coroutineScope.launch {
            val result = mediaRepository.getGenres()
            _uiState.value = result.fold(
                onSuccess = { CatalogHeaderUiState.Success(selectBigGenres(it)) },
                onFailure = { CatalogHeaderUiState.Error(it.message ?: "Failed to load genres") }
            )
        }
    }

    fun retry() {
        loadGenres()
    }
}
