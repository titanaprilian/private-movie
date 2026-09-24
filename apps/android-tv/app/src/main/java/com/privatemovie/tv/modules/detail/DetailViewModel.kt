package com.privatemovie.tv.modules.detail

import com.privatemovie.tv.data.repository.MediaRepository
import com.privatemovie.tv.modules.detail.internal.DetailReturnFocusTarget
import com.privatemovie.tv.modules.detail.internal.DetailUiState
import com.privatemovie.tv.modules.detail.internal.TvEpisode
import com.privatemovie.tv.modules.detail.internal.TvSeriesDetails
import com.privatemovie.tv.modules.detail.internal.resolveDetailReturnFocus
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

    private val _pendingReturnFocus = MutableStateFlow<DetailReturnFocusTarget?>(null)
    val pendingReturnFocus: StateFlow<DetailReturnFocusTarget?> = _pendingReturnFocus.asStateFlow()

    /**
     * Tracks whether the hero-banner initial focus has already been performed.
     * Survives player navigation when the ViewModel instance is retained, so
     * returning from the player never resets focus/scroll to the top.
     */
    var hasCompletedInitialFocus: Boolean = false

    init {
        loadDetails()
    }

    fun loadDetails() {
        // Retain loaded state across player navigation: never flash loading again
        // once details for this series are already available.
        if (_uiState.value is DetailUiState.Success) return
        fetchDetails()
    }

    fun retry() {
        fetchDetails()
    }

    private fun fetchDetails() {
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

    fun selectSeason(index: Int) {
        _selectedSeasonIndex.value = index
        _activeEpisodeIndex.value = 0
    }

    fun setEpisodeIndex(index: Int) {
        _activeEpisodeIndex.value = index
    }

    /**
     * Applies the latest played episode reported back from the player.
     *
     * Updates the selected season and remembered episode index so the detail
     * screen focuses that specific episode card instead of resetting to the
     * hero banner. Returns the resolved focus target, or null when there is
     * nothing to focus (unknown id or details not loaded yet).
     */
    fun applyPlayerReturn(returnEpisodeId: String?): DetailReturnFocusTarget? {
        if (returnEpisodeId.isNullOrBlank()) return null
        val details = (_uiState.value as? DetailUiState.Success)?.details ?: return null
        val target = resolveDetailReturnFocus(details, returnEpisodeId) ?: return null
        if (!target.isStandalone) {
            _selectedSeasonIndex.value = target.seasonIndex
        }
        _activeEpisodeIndex.value = target.episodeIndex
        _pendingReturnFocus.value = target
        return target
    }

    fun consumeReturnFocus() {
        _pendingReturnFocus.value = null
    }

    fun openSourcePicker(episode: TvEpisode) {
        _pendingSourcePickerEpisode.value = episode
    }

    fun dismissSourcePicker() {
        _pendingSourcePickerEpisode.value = null
    }
}
