package com.privatemovie.tv.modules.detail

import com.privatemovie.tv.data.repository.MediaRepository
import com.privatemovie.tv.modules.detail.internal.DetailUiState
import com.privatemovie.tv.modules.detail.internal.TvEpisode
import com.privatemovie.tv.modules.detail.internal.TvSeriesDetails
import com.privatemovie.tv.modules.detail.internal.toTvSeriesDetails
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

/**
 * Pure Kotlin StateHolder / ViewModel for the Android TV series watch/detail experience.
 *
 * Encapsulates series details loading, active season selection index, active episode index focus memory,
 * and pending source picker state.
 */
class DetailViewModel(
    val seriesId: String,
    private val mediaRepository: MediaRepository,
    private val coroutineScope: CoroutineScope = CoroutineScope(SupervisorJob() + Dispatchers.Main.immediate),
    private val onLoadedDetails: ((TvSeriesDetails) -> Unit)? = null
) {
    private val _uiState = MutableStateFlow<DetailUiState>(DetailUiState.Loading)
    val uiState: StateFlow<DetailUiState> = _uiState.asStateFlow()

    private val _selectedSeasonIndex = MutableStateFlow(0)
    val selectedSeasonIndex: StateFlow<Int> = _selectedSeasonIndex.asStateFlow()

    private val _activeEpisodeIndex = MutableStateFlow(0)
    val activeEpisodeIndex: StateFlow<Int> = _activeEpisodeIndex.asStateFlow()

    private val _pendingSourcePickerEpisode = MutableStateFlow<TvEpisode?>(null)
    val pendingSourcePickerEpisode: StateFlow<TvEpisode?> = _pendingSourcePickerEpisode.asStateFlow()

    init {
        loadDetails()
    }

    fun loadDetails() {
        _uiState.value = DetailUiState.Loading
        coroutineScope.launch {
            val result = mediaRepository.getSeriesById(seriesId)
            _uiState.value = result.fold(
                onSuccess = { detailsDto ->
                    val mapped = detailsDto.toTvSeriesDetails()
                    onLoadedDetails?.invoke(mapped)
                    DetailUiState.Success(mapped)
                },
                onFailure = { DetailUiState.Error(it.message ?: "Failed to load series details") }
            )
        }
    }

    fun retry() {
        loadDetails()
    }

    fun selectSeason(index: Int) {
        _selectedSeasonIndex.value = index
        _activeEpisodeIndex.value = 0
    }

    fun setEpisodeIndex(index: Int) {
        _activeEpisodeIndex.value = index
    }

    fun openSourcePicker(episode: TvEpisode) {
        _pendingSourcePickerEpisode.value = episode
    }

    fun dismissSourcePicker() {
        _pendingSourcePickerEpisode.value = null
    }
}
