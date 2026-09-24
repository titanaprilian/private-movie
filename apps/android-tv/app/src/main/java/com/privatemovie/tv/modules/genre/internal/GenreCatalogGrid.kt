package com.privatemovie.tv.modules.genre.internal

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.foundation.lazy.grid.GridItemSpan
import androidx.compose.foundation.lazy.grid.LazyGridState
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.foundation.lazy.grid.itemsIndexed
import androidx.compose.foundation.lazy.grid.rememberLazyGridState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.input.key.onKeyEvent
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.tv.material3.Border
import androidx.tv.material3.Button as TvButton
import androidx.tv.material3.ButtonDefaults as TvButtonDefaults
import com.privatemovie.tv.components.isRepeatKeyEvent
import com.privatemovie.tv.components.requestFocusSafely
import com.privatemovie.tv.dto.models.SeriesSummary

private const val GENRE_GRID_COLUMNS = 5

/**
 * Filter pill row + 5-column vertical poster grid for the genre catalog.
 *
 * - Focusing a card near the loaded boundary invokes [onNearBottom] for
 *   infinite lazy-loading; focusing the active pill row keeps header access.
 * - D-pad Up from the pills or the top grid row invokes [onUpToHeader].
 * - Bottom span shows a loading spinner while [isFetchingNextPage], a
 *   focusable retry button when [isNextPageError], and an empty state when
 *   the catalog has no series.
 */
@Composable
fun GenreCatalogGrid(
    series: List<SeriesSummary>,
    baseUrl: String,
    activeFilter: GenreCatalogFilter,
    onFilterChange: (GenreCatalogFilter) -> Unit,
    onSelectSeries: (String) -> Unit,
    modifier: Modifier = Modifier,
    isFetchingNextPage: Boolean = false,
    isNextPageError: Boolean = false,
    onRetryNextPage: (() -> Unit)? = null,
    onNearBottom: (() -> Unit)? = null,
    onUpToHeader: (() -> Unit)? = null,
    onLeftFromEdge: (() -> Unit)? = null,
    pillFocusers: Map<GenreCatalogFilter, FocusRequester>? = null,
    gridState: LazyGridState = rememberLazyGridState()
) {
    val retryFocus = remember { FocusRequester() }

    LaunchedEffect(isNextPageError) {
        if (isNextPageError) {
            requestFocusSafely(retryFocus)
        }
    }

    Column(modifier = modifier.fillMaxSize()) {
        FilterPillRow(
            activeFilter = activeFilter,
            onFilterChange = onFilterChange,
            onUpToHeader = onUpToHeader,
            pillFocusers = pillFocusers,
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 48.dp, vertical = 12.dp)
        )

        if (series.isEmpty() && !isFetchingNextPage) {
            GenreCatalogEmpty(modifier = Modifier.fillMaxSize())
            return
        }

        LazyVerticalGrid(
            columns = GridCells.Fixed(GENRE_GRID_COLUMNS),
            state = gridState,
            modifier = Modifier.fillMaxSize(),
            contentPadding = PaddingValues(start = 48.dp, end = 48.dp, bottom = 48.dp),
            verticalArrangement = Arrangement.spacedBy(24.dp),
            horizontalArrangement = Arrangement.spacedBy(20.dp)
        ) {
            itemsIndexed(series, key = { _, item -> item.id }) { index, item ->
                GenrePosterCard(
                    series = item,
                    baseUrl = baseUrl,
                    onSelect = { onSelectSeries(item.id) },
                    onFocused = {
                        if (shouldPrefetch(index, series.size)) {
                            onNearBottom?.invoke()
                        }
                    },
                    onUp = if (index < GENRE_GRID_COLUMNS) onUpToHeader else null,
                    onLeft = if (index % GENRE_GRID_COLUMNS == 0) onLeftFromEdge else null
                )
            }

            if (isFetchingNextPage || isNextPageError) {
                item(span = { GridItemSpan(GENRE_GRID_COLUMNS) }) {
                    Box(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(vertical = 24.dp),
                        contentAlignment = Alignment.Center
                    ) {
                        if (isNextPageError) {
                            val retryShape = RoundedCornerShape(8.dp)
                            TvButton(
                                onClick = { onRetryNextPage?.invoke() },
                                modifier = Modifier.focusRequester(retryFocus),
                                shape = TvButtonDefaults.shape(
                                    shape = retryShape,
                                    focusedShape = retryShape
                                ),
                                scale = TvButtonDefaults.scale(scale = 1.0f, focusedScale = 1.08f),
                                border = TvButtonDefaults.border(
                                    border = Border.None,
                                    focusedBorder = Border(
                                        border = BorderStroke(width = 2.dp, color = Color.White),
                                        shape = retryShape
                                    )
                                ),
                                colors = TvButtonDefaults.colors(
                                    containerColor = Color.White.copy(alpha = 0.15f),
                                    focusedContainerColor = MaterialTheme.colorScheme.primary,
                                    contentColor = Color.White,
                                    focusedContentColor = Color.White
                                )
                            ) {
                                Text("Retry loading more", fontWeight = FontWeight.Bold)
                            }
                        } else {
                            CircularProgressIndicator(
                                color = MaterialTheme.colorScheme.primary,
                                strokeWidth = 3.dp,
                                modifier = Modifier.size(36.dp)
                            )
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun FilterPillRow(
    activeFilter: GenreCatalogFilter,
    onFilterChange: (GenreCatalogFilter) -> Unit,
    modifier: Modifier = Modifier,
    onUpToHeader: (() -> Unit)? = null,
    pillFocusers: Map<GenreCatalogFilter, FocusRequester>? = null
) {
    Row(
        modifier = modifier,
        horizontalArrangement = Arrangement.spacedBy(12.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        GenreCatalogFilter.entries.forEach { filter ->
            val isActive = filter == activeFilter
            val pillShape = RoundedCornerShape(20.dp)
            var pillModifier: Modifier = Modifier
            val focuser = pillFocusers?.get(filter)
            if (focuser != null) {
                pillModifier = pillModifier.focusRequester(focuser)
            }
            if (onUpToHeader != null) {
                pillModifier = pillModifier.onKeyEvent { keyEvent ->
                    if (isRepeatKeyEvent(keyEvent)) {
                        return@onKeyEvent true
                    }
                    if (keyEvent.nativeKeyEvent.action == android.view.KeyEvent.ACTION_DOWN &&
                        keyEvent.nativeKeyEvent.keyCode == android.view.KeyEvent.KEYCODE_DPAD_UP
                    ) {
                        onUpToHeader()
                        true
                    } else {
                        false
                    }
                }
            }
            TvButton(
                onClick = { onFilterChange(filter) },
                modifier = pillModifier,
                shape = TvButtonDefaults.shape(shape = pillShape, focusedShape = pillShape),
                scale = TvButtonDefaults.scale(scale = 1.0f, focusedScale = 1.08f),
                border = TvButtonDefaults.border(
                    border = Border.None,
                    focusedBorder = Border(
                        border = BorderStroke(width = 2.dp, color = Color.White),
                        shape = pillShape
                    )
                ),
                colors = TvButtonDefaults.colors(
                    containerColor = if (isActive) MaterialTheme.colorScheme.primary.copy(alpha = 0.35f)
                    else Color.White.copy(alpha = 0.12f),
                    focusedContainerColor = MaterialTheme.colorScheme.primary,
                    contentColor = Color.White.copy(alpha = 0.85f),
                    focusedContentColor = Color.White
                )
            ) {
                Text(
                    text = filter.label,
                    style = MaterialTheme.typography.bodyMedium.copy(
                        fontWeight = if (isActive) FontWeight.Bold else FontWeight.Medium
                    )
                )
            }
        }
    }
}

@Composable
fun GenreCatalogEmpty(modifier: Modifier = Modifier) {
    Box(modifier = modifier, contentAlignment = Alignment.Center) {
        Column(horizontalAlignment = Alignment.CenterHorizontally) {
            Text(
                text = "No series found",
                style = MaterialTheme.typography.titleLarge.copy(fontWeight = FontWeight.Bold),
                color = MaterialTheme.colorScheme.onBackground
            )
            Spacer(modifier = Modifier.height(8.dp))
            Text(
                text = "Try another genre or filter.",
                style = MaterialTheme.typography.bodyMedium,
                color = Color.LightGray,
                textAlign = TextAlign.Center
            )
        }
    }
}
