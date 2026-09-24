package com.privatemovie.tv.modules.home

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.material3.MaterialTheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.ui.Modifier
import androidx.compose.ui.focus.FocusRequester
import com.privatemovie.tv.components.CatalogTopBar
import com.privatemovie.tv.components.requestFocusSafely
import com.privatemovie.tv.data.repository.MediaRepository
import com.privatemovie.tv.modules.home.internal.CatalogSearchViewModel
import com.privatemovie.tv.modules.home.internal.CatalogTopBarViewModel
import com.privatemovie.tv.modules.home.internal.HomeError
import com.privatemovie.tv.modules.home.internal.HomeFeedContent
import com.privatemovie.tv.modules.home.internal.HomeLoading
import com.privatemovie.tv.modules.home.internal.HomeUiState
import kotlinx.coroutines.launch

/**
 * Public seam for the Android TV home browsing experience.
 *
 * Renders the unified [CatalogTopBar] (logo, Home link, Big Genre links,
 * interactive search) above the real public home feed
 * (`GET /api/series/home-feed`) fetched via [HomeViewModel] and
 * [MediaRepository] with D-pad-first focus behavior: every interactive
 * element is focusable, the focused element shows a high-contrast border +
 * scale treatment, D-pad Down from any header item hands focus to the
 * featured hero CTA, and the hero takes initial focus.
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
    headerViewModel: CatalogTopBarViewModel = remember(mediaRepository) {
        CatalogTopBarViewModel(mediaRepository = mediaRepository)
    },
    searchViewModel: CatalogSearchViewModel = remember(mediaRepository) {
        CatalogSearchViewModel(mediaRepository = mediaRepository)
    }
) {
    val uiState by viewModel.uiState.collectAsState()
    val pendingReturnFocus by viewModel.pendingReturnFocus.collectAsState()
    val heroFocus = remember { FocusRequester() }
    val coroutineScope = rememberCoroutineScope()

    LaunchedEffect(activeBackendUrl) {
        viewModel.loadFeed()
    }

    val focusHero: () -> Unit = {
        coroutineScope.launch {
            requestFocusSafely(heroFocus)
        }
        Unit
    }

    Column(
        modifier = modifier
            .fillMaxSize()
            .background(MaterialTheme.colorScheme.background)
    ) {
        CatalogTopBar(
            headerViewModel = headerViewModel,
            searchViewModel = searchViewModel,
            onNavigateHome = { /* already home */ },
            onSelectGenre = onSelectGenre,
            onSelectSeries = onSelectSeries,
            modifier = Modifier.fillMaxWidth(),
            activeGenreSlug = null,
            onDownToContent = focusHero
        )
        Box(
            modifier = Modifier
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
                    externalCtaFocusRequester = heroFocus
                )
            }
        }
    }
}
