package com.privatemovie.tv.modules.home

import com.privatemovie.tv.components.TvFocusLog
import com.privatemovie.tv.data.repository.MediaRepository
import com.privatemovie.tv.modules.home.internal.HomeDrawerReturnTarget
import com.privatemovie.tv.modules.home.internal.HomeReturnFocusTarget
import com.privatemovie.tv.modules.home.internal.HomeUiState
import com.privatemovie.tv.modules.home.internal.heroSelectionTarget
import com.privatemovie.tv.modules.home.internal.rowCardSelectionTarget
import com.privatemovie.tv.modules.home.internal.toTvHomeFeed
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharedFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asSharedFlow
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

    /**
     * Origin recorded when launching Detail, consumed to restore Home focus on return.
     * Null means no restoration is pending (initial entry keeps default hero focus).
     */
    private val _pendingReturnFocus = MutableStateFlow<HomeReturnFocusTarget?>(null)
    val pendingReturnFocus: StateFlow<HomeReturnFocusTarget?> = _pendingReturnFocus.asStateFlow()

    /**
     * Origin recorded when exiting to the navigation drawer, encapsulated privately
     * and emitted to [drawerReturnEvents] upon focus restoration.
     */
    private var _drawerReturnTarget: HomeDrawerReturnTarget? = null

    private val _drawerReturnEvents = MutableSharedFlow<HomeDrawerReturnTarget>(extraBufferCapacity = 1)
    val drawerReturnEvents: SharedFlow<HomeDrawerReturnTarget> = _drawerReturnEvents.asSharedFlow()

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

    /** Records a Hero CTA selection as the return-focus origin. */
    fun recordHeroSelection(seriesId: String) {
        _pendingReturnFocus.value = heroSelectionTarget(seriesId)
    }

    /** Records a catalog row card selection as the return-focus origin. */
    fun recordRowCardSelection(rowIndex: Int, cardIndex: Int, seriesId: String) {
        _pendingReturnFocus.value = rowCardSelectionTarget(rowIndex, cardIndex, seriesId)
    }

    /**
     * Consumes the pending return-focus target after restoration so subsequent
     * recompositions do not trigger unexpected focus jumps.
     */
    fun consumeReturnFocus() {
        _pendingReturnFocus.value = null
    }

    /** Records the drawer-exit origin target. */
    fun recordDrawerOrigin(target: HomeDrawerReturnTarget) {
        TvFocusLog.d("Origin") { "Recording drawer exit origin target: $target" }
        _drawerReturnTarget = target
    }

    /**
     * Restores focus after drawer collapse: checks the pending target, emits it to
     * [drawerReturnEvents], clears the pending target, and returns true.
     * If no target was pending, returns false.
     */
    fun restoreDrawerReturnFocus(): Boolean {
        val target = _drawerReturnTarget ?: return false
        _drawerReturnTarget = null
        TvFocusLog.d("Origin") { "Restoring drawer return focus, emitting target: $target" }
        _drawerReturnEvents.tryEmit(target)
        return true
    }

    fun restoreDrawerFocus(): Boolean = restoreDrawerReturnFocus()
}
