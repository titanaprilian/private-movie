package com.privatemovie.tv.modules.home

import com.privatemovie.tv.data.repository.MediaRepository
import com.privatemovie.tv.modules.home.internal.HomeUiState
import com.privatemovie.tv.modules.home.internal.toTvHomeFeed
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

/**
 * Pure Kotlin StateHolder / ViewModel for the Android TV home browsing experience.
 *
 * Manages reactive home feed UI state, coroutine lifecycle, and explicit intent dispatch.
 */
class HomeViewModel(
    private val mediaRepository: MediaRepository,
    private val coroutineScope: CoroutineScope = CoroutineScope(SupervisorJob() + Dispatchers.Main.immediate)
) {
    private val _uiState = MutableStateFlow<HomeUiState>(HomeUiState.Loading)
    val uiState: StateFlow<HomeUiState> = _uiState.asStateFlow()

    init {
        loadFeed()
    }

    fun loadFeed() {
        _uiState.value = HomeUiState.Loading
        coroutineScope.launch {
            val result = mediaRepository.getHomeFeed()
            _uiState.value = result.fold(
                onSuccess = { HomeUiState.Success(it.toTvHomeFeed()) },
                onFailure = { HomeUiState.Error(it.message ?: "Failed to load home feed") }
            )
        }
    }

    fun retry() {
        loadFeed()
    }
}
