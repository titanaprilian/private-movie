package com.privatemovie.tv.modules.home.internal

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateMapOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clipToBounds
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.focus.focusRestorer
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.tv.material3.Border
import androidx.tv.material3.Button as TvButton
import androidx.tv.material3.ButtonDefaults as TvButtonDefaults
import com.privatemovie.tv.components.EdgeScaleTransform
import com.privatemovie.tv.components.FocusTransitionCoordinator
import com.privatemovie.tv.components.TvHorizontalBringIntoViewSpec
import com.privatemovie.tv.components.TvVerticalHeaderBringIntoViewSpec
import com.privatemovie.tv.components.requestFocusSafely

@Composable
fun HomeLoading(modifier: Modifier = Modifier) {
    Box(
        modifier = modifier.fillMaxSize(),
        contentAlignment = Alignment.Center
    ) {
        Column(horizontalAlignment = Alignment.CenterHorizontally) {
            CircularProgressIndicator(
                color = MaterialTheme.colorScheme.primary,
                strokeWidth = 3.dp,
                modifier = Modifier.size(44.dp)
            )
            Spacer(modifier = Modifier.height(16.dp))
            Text(
                text = "Loading catalog…",
                style = MaterialTheme.typography.titleMedium,
                color = MaterialTheme.colorScheme.onBackground
            )
        }
    }
}

@Composable
fun HomeError(
    message: String,
    onRetry: () -> Unit,
    modifier: Modifier = Modifier
) {
    val retryFocus = remember { FocusRequester() }
    LaunchedEffect(Unit) { retryFocus.requestFocus() }

    Box(
        modifier = modifier.fillMaxSize(),
        contentAlignment = Alignment.Center
    ) {
        Column(horizontalAlignment = Alignment.CenterHorizontally) {
            Text(
                text = "Could not load the catalog",
                style = MaterialTheme.typography.titleLarge.copy(fontWeight = FontWeight.Bold),
                color = MaterialTheme.colorScheme.onBackground
            )
            Spacer(modifier = Modifier.height(8.dp))
            Text(
                text = message,
                style = MaterialTheme.typography.bodyMedium,
                color = Color.LightGray
            )
            Spacer(modifier = Modifier.height(24.dp))
            val buttonShape = RoundedCornerShape(8.dp)
            TvButton(
                onClick = onRetry,
                modifier = Modifier.focusRequester(retryFocus),
                shape = TvButtonDefaults.shape(
                    shape = buttonShape,
                    focusedShape = buttonShape
                ),
                scale = TvButtonDefaults.scale(
                    scale = 1.0f,
                    focusedScale = 1.08f
                ),
                border = TvButtonDefaults.border(
                    border = Border.None,
                    focusedBorder = Border(
                        border = BorderStroke(width = 2.dp, color = Color.White),
                        shape = buttonShape
                    )
                ),
                colors = TvButtonDefaults.colors(
                    containerColor = MaterialTheme.colorScheme.primary,
                    focusedContainerColor = MaterialTheme.colorScheme.primary,
                    contentColor = Color.White,
                    focusedContentColor = Color.White
                )
            ) {
                Text("Retry", fontWeight = FontWeight.Bold)
            }
        }
    }
}

@Composable
fun HomeEmpty(
    onRetry: () -> Unit,
    modifier: Modifier = Modifier
) {
    val retryFocus = remember { FocusRequester() }
    LaunchedEffect(Unit) { retryFocus.requestFocus() }

    Box(
        modifier = modifier.fillMaxSize(),
        contentAlignment = Alignment.Center
    ) {
        Column(horizontalAlignment = Alignment.CenterHorizontally) {
            Text(
                text = "No public content yet",
                style = MaterialTheme.typography.titleLarge.copy(fontWeight = FontWeight.Bold),
                color = MaterialTheme.colorScheme.onBackground
            )
            Spacer(modifier = Modifier.height(8.dp))
            Text(
                text = "New series will appear here once the catalog has playable content.",
                style = MaterialTheme.typography.bodyMedium,
                color = Color.LightGray
            )
            Spacer(modifier = Modifier.height(24.dp))
            val buttonShape = RoundedCornerShape(8.dp)
            TvButton(
                onClick = onRetry,
                modifier = Modifier.focusRequester(retryFocus),
                shape = TvButtonDefaults.shape(
                    shape = buttonShape,
                    focusedShape = buttonShape
                ),
                scale = TvButtonDefaults.scale(
                    scale = 1.0f,
                    focusedScale = 1.08f
                ),
                border = TvButtonDefaults.border(
                    border = Border.None,
                    focusedBorder = Border(
                        border = BorderStroke(width = 2.dp, color = Color.White),
                        shape = buttonShape
                    )
                ),
                colors = TvButtonDefaults.colors(
                    containerColor = Color.White.copy(alpha = 0.15f),
                    focusedContainerColor = MaterialTheme.colorScheme.primary,
                    contentColor = Color.White,
                    focusedContentColor = Color.White
                )
            ) {
                Text("Retry", fontWeight = FontWeight.Bold)
            }
        }
    }
}

@OptIn(androidx.compose.foundation.ExperimentalFoundationApi::class)
@Composable
fun HomeFeedContent(
    feed: TvHomeFeed,
    baseUrl: String,
    onSelectSeries: (String) -> Unit,
    onOpenDevSettings: () -> Unit,
    onRetry: () -> Unit,
    modifier: Modifier = Modifier
) {
    val effectiveHeroes = remember(feed) {
        if (feed.heroes.isNotEmpty()) {
            feed.heroes
        } else if (feed.hero != null) {
            listOf(feed.hero)
        } else {
            emptyList()
        }
    }

    val hasContent = effectiveHeroes.isNotEmpty() || feed.rows.any { it.items.isNotEmpty() }
    if (!hasContent) {
        HomeEmpty(onRetry = onRetry, modifier = modifier)
        return
    }

    val sliderState = rememberHeroSliderState(heroes = effectiveHeroes)
    val heroFocus = remember { FocusRequester() }
    val settingsFocus = remember { FocusRequester() }
    val coroutineScope = androidx.compose.runtime.rememberCoroutineScope()
    val lazyListState = androidx.compose.foundation.lazy.rememberLazyListState()
    val focusCoordinator = remember(coroutineScope) { FocusTransitionCoordinator(coroutineScope) }

    // Per-row last-focused card index. rowFocusIndices[rowIndex] = lastCardIndex.
    val rowFocusIndices = remember { mutableStateMapOf<Int, Int>() }

    // Per-row, per-card FocusRequesters. Keyed by (rowIndex -> List<FocusRequester>).
    // Recomputed only when the row item counts change.
    val rowFocusRequesters = remember(feed.rows) {
        feed.rows.mapIndexed { rowIndex, row ->
            rowIndex to List(row.items.size) { FocusRequester() }
        }.toMap()
    }

    var isInitialFocusPlaced by rememberSaveable { mutableStateOf(false) }

    LaunchedEffect(effectiveHeroes) {
        if (!isInitialFocusPlaced && effectiveHeroes.isNotEmpty()) {
            isInitialFocusPlaced = true
            requestFocusSafely(heroFocus)
        }
    }

    // Scroll to the catalog rows section and restore focus to the remembered card for a given row.
    // Falls back to card 0 if the remembered index is out of range or focus acquisition fails.
    val focusRowCard: suspend (targetRowIndex: Int) -> Boolean = { targetRowIndex ->
        val row = feed.rows.getOrNull(targetRowIndex)
        val requesters = rowFocusRequesters[targetRowIndex]
        if (row != null && requesters != null && requesters.isNotEmpty()) {
            val rememberedIndex = rowFocusIndices[targetRowIndex] ?: 0
            val clampedIndex = rememberedIndex.coerceIn(0, requesters.size - 1)
            // LazyColumn item index: hero is item 0, rows start at item 1.
            val lazyItemIndex = if (effectiveHeroes.isNotEmpty()) targetRowIndex + 1 else targetRowIndex
            lazyListState.animateScrollToItem(lazyItemIndex)
            val targetRequester = requesters[clampedIndex]
            val success = requestFocusSafely(targetRequester)
            if (!success) {
                // Fallback: try Card 0
                requestFocusSafely(requesters[0])
            } else {
                true
            }
        } else {
            false
        }
    }

    // Per-row BringIntoView spec for horizontal carousels — stateless, shared across all rows.
    @OptIn(androidx.compose.foundation.ExperimentalFoundationApi::class)
    val horizontalBringIntoViewSpec = remember { TvHorizontalBringIntoViewSpec(edgeMargin = 48f) }

    @OptIn(androidx.compose.foundation.ExperimentalFoundationApi::class)
    val verticalHeaderBringIntoViewSpec = remember(lazyListState) {
        TvVerticalHeaderBringIntoViewSpec(lazyListState)
    }

    Box(modifier = modifier.fillMaxSize()) {
        @OptIn(androidx.compose.ui.ExperimentalComposeUiApi::class)
        androidx.compose.runtime.CompositionLocalProvider(
            androidx.compose.foundation.gestures.LocalBringIntoViewSpec provides verticalHeaderBringIntoViewSpec
        ) {
            LazyColumn(
                state = lazyListState,
                modifier = Modifier
                    .fillMaxSize()
                    .focusRestorer(),
                verticalArrangement = Arrangement.spacedBy(32.dp),
                contentPadding = PaddingValues(bottom = 48.dp)
            ) {
                if (effectiveHeroes.isNotEmpty()) {
                    item(key = "hero-slider") {
                        FeaturedHeroSlider(
                            sliderState = sliderState,
                            baseUrl = baseUrl,
                            onSelectSeries = onSelectSeries,
                            onOpenDevSettings = onOpenDevSettings,
                            ctaFocusRequester = heroFocus,
                            settingsFocusRequester = settingsFocus,
                            onUpFromCta = {
                                focusCoordinator.tryRequestFocus {
                                    requestFocusSafely(settingsFocus)
                                }
                            },
                            onDownFromCta = {
                                val firstNonEmptyRowIndex = feed.rows.indexOfFirst { it.items.isNotEmpty() }
                                if (firstNonEmptyRowIndex >= 0) {
                                    focusCoordinator.tryRequestFocus {
                                        focusRowCard(firstNonEmptyRowIndex)
                                    }
                                }
                            },
                            onDownFromSettings = {
                                focusCoordinator.tryRequestFocus {
                                    lazyListState.animateScrollToItem(0)
                                    requestFocusSafely(heroFocus)
                                }
                            },
                            modifier = Modifier
                                .fillParentMaxHeight()
                                .clipToBounds()
                        )
                    }
                }

                @OptIn(androidx.compose.foundation.ExperimentalFoundationApi::class)
                feed.rows.forEachIndexed { rowIndex, row ->
                    if (row.items.isNotEmpty()) {
                        item(key = "row-header-${row.title}") {
                            val requesters = rowFocusRequesters[rowIndex] ?: emptyList()
                            Column(modifier = Modifier.fillMaxWidth()) {
                                Text(
                                    text = row.title,
                                    style = MaterialTheme.typography.titleLarge.copy(
                                        fontWeight = FontWeight.Bold,
                                        letterSpacing = 0.5.sp
                                    ),
                                    color = MaterialTheme.colorScheme.onBackground,
                                    modifier = Modifier.padding(start = 48.dp, end = 48.dp, bottom = 12.dp)
                                )
                                @OptIn(
                                    androidx.compose.foundation.ExperimentalFoundationApi::class,
                                    androidx.compose.ui.ExperimentalComposeUiApi::class
                                )
                                androidx.compose.runtime.CompositionLocalProvider(
                                    androidx.compose.foundation.gestures.LocalBringIntoViewSpec provides horizontalBringIntoViewSpec
                                ) {
                                    LazyRow(
                                        modifier = Modifier
                                            .fillMaxWidth()
                                            .focusRestorer(),
                                        horizontalArrangement = Arrangement.spacedBy(20.dp),
                                        contentPadding = PaddingValues(horizontal = 48.dp, vertical = 8.dp)
                                    ) {
                                        itemsIndexed(row.items, key = { _, series -> series.id }) { index, series ->
                                            val transformOrigin = EdgeScaleTransform(index, row.items.size)
                                            val itemRequester = requesters.getOrNull(index)
                                            SeriesPosterCard(
                                                series = series,
                                                baseUrl = baseUrl,
                                                onSelect = { onSelectSeries(series.id) },
                                                transformOrigin = transformOrigin,
                                                focusRequester = itemRequester,
                                                onFocused = {
                                                    rowFocusIndices[rowIndex] = index
                                                },
                                                onUp = if (rowIndex == 0 && effectiveHeroes.isNotEmpty()) {
                                                    {
                                                        focusCoordinator.tryRequestFocus {
                                                            lazyListState.animateScrollToItem(0)
                                                            requestFocusSafely(heroFocus)
                                                        }
                                                    }
                                                } else null
                                            )
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    }
}
