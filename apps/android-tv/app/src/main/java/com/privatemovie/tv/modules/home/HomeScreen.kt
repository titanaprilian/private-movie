package com.privatemovie.tv.modules.home

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material3.MaterialTheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Modifier
import androidx.compose.ui.focus.FocusRequester
import com.privatemovie.tv.data.repository.MediaRepository
import com.privatemovie.tv.modules.home.internal.HomeError
import com.privatemovie.tv.modules.home.internal.HomeFeedContent
import com.privatemovie.tv.modules.home.internal.HomeLoading
import com.privatemovie.tv.modules.home.internal.HomeUiState

/**
 * Public seam for the Android TV home browsing experience.
 *
 * Full-bleed layout: no top navigation bar is rendered — the hero backdrop
 * extends to the top safe boundary and the global [TvNavigationDrawer] shell
 * (owned by `AppNavigation`) provides Search / Home / Big Genre navigation
 * from the collapsed 72dp left rail. D-pad Left from the hero CTA or the
 * leftmost card of any row shifts focus into the drawer via [onFocusDrawer].
 * Selecting a series navigates into the series watch/detail flow via [onSelectSeries].
 */
@Composable
fun HomeScreen(
    activeBackendUrl: String,
    mediaRepository: MediaRepository,
    onSelectSeries: (String) -> Unit,
    modifier: Modifier = Modifier,
    onSelectGenre: (String) -> Unit = {},
    viewModel: HomeViewModel = remember(mediaRepository, activeBackendUrl) {
        HomeViewModel(mediaRepository = mediaRepository)
    },
    onFocusDrawer: () -> Unit = {}
) {
    val uiState by viewModel.uiState.collectAsState()
    val pendingReturnFocus by viewModel.pendingReturnFocus.collectAsState()
    val heroFocus = remember { FocusRequester() }

    LaunchedEffect(activeBackendUrl) {
        viewModel.loadFeed()
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
                onRetry = { viewModel.retry() }
            )
            is HomeUiState.Success -> HomeFeedContent(
                feed = state.feed,
                baseUrl = activeBackendUrl,
                onSelectSeries = onSelectSeries,
                onRetry = { viewModel.retry() },
                onSelectHero = { seriesId ->
                    viewModel.recordHeroSelection(seriesId)
                    onSelectSeries(seriesId)
                },
                onSelectRowCard = { rowIndex, cardIndex, seriesId ->
                    viewModel.recordRowCardSelection(rowIndex, cardIndex, seriesId)
                    onSelectSeries(seriesId)
                },
                returnFocusTarget = pendingReturnFocus,
                onReturnFocusConsumed = { viewModel.consumeReturnFocus() },
                externalCtaFocusRequester = heroFocus,
                onLeftFromEdge = onFocusDrawer
            )
        }
    }
}
