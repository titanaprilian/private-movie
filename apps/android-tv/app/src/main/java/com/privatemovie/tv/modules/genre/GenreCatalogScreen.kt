package com.privatemovie.tv.modules.genre

import androidx.activity.compose.BackHandler
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.lazy.grid.rememberLazyGridState
import androidx.compose.material3.MaterialTheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.ui.Modifier
import androidx.compose.ui.focus.FocusRequester
import com.privatemovie.tv.components.requestFocusSafely
import com.privatemovie.tv.data.repository.MediaRepository
import com.privatemovie.tv.modules.genre.internal.GenreCatalogError
import com.privatemovie.tv.modules.genre.internal.GenreCatalogFilter
import com.privatemovie.tv.modules.genre.internal.GenreCatalogGrid
import com.privatemovie.tv.modules.genre.internal.GenreCatalogLoading
import com.privatemovie.tv.modules.genre.internal.GenreCatalogUiState
import kotlinx.coroutines.launch

/**
 * Public seam for the Big Genre catalog browsing experience (`genre/{slug}`).
 *
 * Full-bleed layout: no top navigation bar is rendered — the filter pills and
 * 5-column poster grid extend to the top safe boundary and the global
 * `TvNavigationDrawer` shell (owned by `AppNavigation`) provides Search /
 * Home / genre navigation from the collapsed 72dp left rail. D-pad Left from
 * a leftmost-column card shifts focus into the drawer via [onFocusDrawer].
 * D-pad Up from the pills/top row returns to the header focus target;
 * remote Back navigates to Home via [onNavigateHome]; selecting another
 * genre goes through [onSelectGenre].
 */
@Composable
fun GenreCatalogScreen(
    genreSlug: String,
    activeBackendUrl: String,
    mediaRepository: MediaRepository,
    onSelectSeries: (String) -> Unit,
    onNavigateHome: () -> Unit,
    onSelectGenre: (String) -> Unit,
    modifier: Modifier = Modifier,
    viewModel: GenreCatalogViewModel = remember(mediaRepository, genreSlug) {
        GenreCatalogViewModel(mediaRepository = mediaRepository, genreSlug = genreSlug)
    },
    onFocusDrawer: () -> Unit = {},
    contentFocusRequester: FocusRequester? = null,
) {
    val uiState by viewModel.uiState.collectAsState()
    val internalHeaderFocus = remember { FocusRequester() }
    // The drawer shell hands focus back to the filter pills when it collapses.
    val headerFocus = contentFocusRequester ?: internalHeaderFocus
    // Dedicated requester for the loading container so focus stays anchored
    // inside the page while the catalog is fetched.
    val loadingFocus = remember { FocusRequester() }
    val pillFocusers = remember(headerFocus) {
        mapOf(
            GenreCatalogFilter.ALL to headerFocus,
            GenreCatalogFilter.ONGOING to FocusRequester()
        )
    }
    val coroutineScope = rememberCoroutineScope()

    BackHandler {
        onNavigateHome()
    }

    val focusHeader: () -> Unit = {
        coroutineScope.launch {
            requestFocusSafely(headerFocus)
        }
        Unit
    }

    Box(
        modifier = modifier
            .fillMaxSize()
            .background(MaterialTheme.colorScheme.background)
    ) {
        when (val state = uiState) {
            is GenreCatalogUiState.Loading -> GenreCatalogLoading(
                modifier = Modifier.fillMaxSize(),
                focusRequester = loadingFocus,
            )
            is GenreCatalogUiState.Error -> GenreCatalogError(
                message = state.message,
                onRetry = { viewModel.retry() },
                modifier = Modifier.fillMaxSize()
            )
            is GenreCatalogUiState.Success -> {
                val gridState = rememberLazyGridState()
                // Focus was held by the loading container; move it into the
                // page (filter pills) now that the catalog is available.
                LaunchedEffect(Unit) {
                    requestFocusSafely(headerFocus)
                }
                LaunchedEffect(genreSlug, state.filter) {
                    try {
                        gridState.scrollToItem(0)
                    } catch (_: Exception) {
                    }
                }
                GenreCatalogGrid(
                    series = state.series,
                    baseUrl = activeBackendUrl,
                    activeFilter = state.filter,
                    onFilterChange = { viewModel.setFilter(it) },
                    onSelectSeries = onSelectSeries,
                    modifier = Modifier.fillMaxSize(),
                    isFetchingNextPage = state.isFetchingNextPage,
                    isNextPageError = state.isNextPageError,
                    onRetryNextPage = { viewModel.retryNextPage() },
                    onNearBottom = { viewModel.loadNextPage() },
                    onUpToHeader = focusHeader,
                    onLeftFromEdge = onFocusDrawer,
                    pillFocusers = pillFocusers,
                    gridState = gridState
                )
            }
        }
    }
}
