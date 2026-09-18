package com.privatemovie.tv.modules.home

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material3.MaterialTheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import com.privatemovie.tv.data.repository.MediaRepository
import com.privatemovie.tv.modules.home.internal.HomeError
import com.privatemovie.tv.modules.home.internal.HomeFeedContent
import com.privatemovie.tv.modules.home.internal.HomeLoading
import com.privatemovie.tv.modules.home.internal.HomeUiState
import com.privatemovie.tv.modules.home.internal.toTvHomeFeed

/**
 * Public seam for the Android TV home browsing experience.
 *
 * Renders the real public home feed (`GET /api/series/home-feed`) fetched via
 * the shared DTO-backed [MediaRepository] with D-pad-first focus behavior: every
 * interactive element is focusable, the focused element shows a high-contrast
 * border + scale treatment, and the featured hero takes initial focus.
 * Selecting a series navigates into the series watch/detail flow via [onSelectSeries].
 */
@Composable
fun HomeScreen(
    activeBackendUrl: String,
    mediaRepository: MediaRepository,
    onSelectSeries: (String) -> Unit,
    onOpenDevSettings: () -> Unit,
    modifier: Modifier = Modifier
) {
    var uiState by remember { mutableStateOf<HomeUiState>(HomeUiState.Loading) }
    var reloadKey by remember { mutableIntStateOf(0) }

    LaunchedEffect(activeBackendUrl, reloadKey) {
        uiState = HomeUiState.Loading
        val result = mediaRepository.getHomeFeed()
        uiState = result.fold(
            onSuccess = { HomeUiState.Success(it.toTvHomeFeed()) },
            onFailure = { HomeUiState.Error(it.message ?: "Failed to load home feed") }
        )
    }

    Box(
        modifier = modifier
            .fillMaxSize()
            .background(MaterialTheme.colorScheme.background)
    ) {
        when (val state = uiState) {
            is HomeUiState.Loading -> HomeLoading()
            is HomeUiState.Error -> HomeError(
                message = state.message,
                onRetry = { reloadKey += 1 }
            )
            is HomeUiState.Success -> HomeFeedContent(
                feed = state.feed,
                baseUrl = activeBackendUrl,
                onSelectSeries = onSelectSeries,
                onOpenDevSettings = onOpenDevSettings,
                onRetry = { reloadKey += 1 }
            )
        }
    }
}
