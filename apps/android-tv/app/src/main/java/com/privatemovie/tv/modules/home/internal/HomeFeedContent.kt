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
    onRetry: () -> Unit,
    modifier: Modifier = Modifier,
    onSelectHero: ((String) -> Unit)? = null,
    onSelectRowCard: ((rowIndex: Int, cardIndex: Int, seriesId: String) -> Unit)? = null,
    returnFocusTarget: HomeReturnFocusTarget? = null,
    onReturnFocusConsumed: (() -> Unit)? = null,
    externalCtaFocusRequester: FocusRequester? = null,
    onLeftFromEdge: (() -> Unit)? = null,
    onSelectEpisode: ((TvRecentlyAddedEpisode) -> Unit)? = null,
    onLeftFromHero: (() -> Unit)? = null,
    onLeftFromRecentEpisodes: (() -> Unit)? = null,
    onLeftFromRow: ((rowIndex: Int) -> Unit)? = null,
    drawerReturnTarget: HomeDrawerReturnTarget? = null,
    onDrawerReturnConsumed: (() -> Unit)? = null,
    drawerReturnTrigger: kotlinx.coroutines.flow.SharedFlow<Unit>? = null
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

    val hasContent = effectiveHeroes.isNotEmpty() || feed.rows.any { it.items.isNotEmpty() } ||
        feed.recentlyAddedEpisodes.isNotEmpty()
    if (!hasContent) {
        HomeEmpty(onRetry = onRetry, modifier = modifier)
        return
    }

    val sliderState = rememberHeroSliderState(heroes = effectiveHeroes)
    val heroFocus = externalCtaFocusRequester ?: remember { FocusRequester() }
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

    // "Recently Added Episodes" carousel state: one FocusRequester per episode
    // plus a dedicated LazyListState so the first card can be scrolled into view
    // before focus is requested.
    val recentEpisodes = feed.recentlyAddedEpisodes
    val hasRecentEpisodes = recentEpisodes.isNotEmpty()
    val episodeFocusRequesters = remember(recentEpisodes) {
        recentEpisodes.map { FocusRequester() }
    }
    val episodeListState = remember(recentEpisodes) {
        androidx.compose.foundation.lazy.LazyListState()
    }
    var recentEpisodeFocusIndex by rememberSaveable { androidx.compose.runtime.mutableIntStateOf(0) }

    // LazyColumn item offsets: the hero slider is item 0, the "Recently Added
    // Episodes" carousel (when present) is item 1, rows start after that.
    val rowItemOffset = if (hasRecentEpisodes) 2 else 1

    val handleSelectHero: (String) -> Unit = { seriesId ->
        if (onSelectHero != null) onSelectHero(seriesId) else onSelectSeries(seriesId)
    }
    val handleSelectRowCard: (Int, Int, String) -> Unit = { rowIndex, cardIndex, seriesId ->
        if (onSelectRowCard != null) onSelectRowCard(rowIndex, cardIndex, seriesId)
        else onSelectSeries(seriesId)
    }

    var isInitialFocusPlaced by rememberSaveable { mutableStateOf(false) }

    LaunchedEffect(effectiveHeroes) {
        if (!isInitialFocusPlaced && effectiveHeroes.isNotEmpty() && returnFocusTarget == null) {
            isInitialFocusPlaced = true
            requestFocusSafely(heroFocus)
        }
    }

    // End-to-end return focus: when popping back from Detail, restore focus to
    // the origin item (Hero CTA or exact row card) with a 3-step fallback:
    // target card -> Card 0 of that row -> Hero CTA. Consumed once applied so
    // recompositions do not trigger focus jumps.
    // Per-row horizontal list states for scroll-into-view before focusing.
    val rowListStates = remember(feed.rows) {
        feed.rows.map { androidx.compose.foundation.lazy.LazyListState() }
    }
    LaunchedEffect(returnFocusTarget, feed) {
        val target = returnFocusTarget ?: return@LaunchedEffect
        if (!shouldRestoreHomeFocus(target)) return@LaunchedEffect
        val resolved = resolveHomeReturnFocus(feed, target) ?: return@LaunchedEffect
        // Skip the initial-focus effect once a return target has been handled.
        isInitialFocusPlaced = true
        focusCoordinator.tryRequestFocus {
            val result = executeHomeReturnFocus(
                resolved = resolved,
                requestCardFocus = { rowIndex, cardIndex ->
                    // LazyColumn item index: hero is item 0, rows start at item 1.
                    val lazyItemIndex =
                        if (effectiveHeroes.isNotEmpty()) rowIndex + rowItemOffset else rowIndex
                    try {
                        lazyListState.animateScrollToItem(lazyItemIndex)
                    } catch (_: Exception) {
                        // Best-effort: a failed scroll must not block focus.
                    }
                    rowListStates.getOrNull(rowIndex)?.let {
                        try {
                            it.animateScrollToItem(cardIndex)
                        } catch (_: Exception) {
                        }
                    }
                    val requester = rowFocusRequesters[rowIndex]?.getOrNull(cardIndex)
                    if (requester != null) requestFocusSafely(requester) else false
                },
                requestHeroFocus = {
                    try {
                        lazyListState.animateScrollToItem(0)
                    } catch (_: Exception) {
                    }
                    requestFocusSafely(heroFocus)
                }
            )
            if (result != HomeReturnFocusResult.Unfocused) {
                onReturnFocusConsumed?.invoke()
            } else {
                // Even when focus could not be acquired, consume the target so
                // recompositions do not loop retrying focus transitions.
                onReturnFocusConsumed?.invoke()
            }
            result != HomeReturnFocusResult.Unfocused
        }
    }

    // Drawer return focus: when returning from navigation drawer, restore focus to
    // the remembered section and card 0 with 3-step fallback:
    // target section card 0 -> first section card 0 -> Hero CTA.
    val performDrawerReturnFocus: suspend () -> Boolean = {
        val target = drawerReturnTarget ?: HomeDrawerReturnTarget.Hero
        focusCoordinator.tryRequestFocus {
            val result = executeHomeDrawerReturnFocus(
                target = target,
                feed = feed,
                requestHeroFocus = {
                    try {
                        lazyListState.animateScrollToItem(0)
                    } catch (_: Exception) {
                    }
                    requestFocusSafely(heroFocus)
                },
                requestRecentEpisodesFocus = {
                    val episodeItemIndex = if (effectiveHeroes.isNotEmpty()) 1 else 0
                    try {
                        lazyListState.animateScrollToItem(episodeItemIndex)
                    } catch (_: Exception) {
                    }
                    try {
                        episodeListState.animateScrollToItem(0)
                    } catch (_: Exception) {
                    }
                    val requester = episodeFocusRequesters.firstOrNull()
                    if (requester != null) requestFocusSafely(requester) else false
                },
                requestRowCardFocus = { rowIndex, cardIndex ->
                    val lazyItemIndex =
                        if (effectiveHeroes.isNotEmpty()) rowIndex + rowItemOffset else rowIndex
                    try {
                        lazyListState.animateScrollToItem(lazyItemIndex)
                    } catch (_: Exception) {
                    }
                    rowListStates.getOrNull(rowIndex)?.let {
                        try {
                            it.animateScrollToItem(cardIndex)
                        } catch (_: Exception) {
                        }
                    }
                    val requester = rowFocusRequesters[rowIndex]?.getOrNull(cardIndex)
                    if (requester != null) requestFocusSafely(requester) else false
                }
            )
            onDrawerReturnConsumed?.invoke()
            result != HomeDrawerReturnFocusResult.Unfocused
        }
    }

    LaunchedEffect(drawerReturnTrigger) {
        drawerReturnTrigger?.collect {
            performDrawerReturnFocus()
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
            val lazyItemIndex = if (effectiveHeroes.isNotEmpty()) targetRowIndex + rowItemOffset else targetRowIndex
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

    // Scroll to the "Recently Added Episodes" carousel and restore focus to the remembered card.
    // Falls back to card 0 if the remembered index is out of range or focus acquisition fails.
    val focusRecentEpisodeCard: suspend () -> Boolean = {
        if (hasRecentEpisodes && episodeFocusRequesters.isNotEmpty()) {
            val clampedIndex = recentEpisodeFocusIndex.coerceIn(0, episodeFocusRequesters.size - 1)
            val episodeItemIndex = if (effectiveHeroes.isNotEmpty()) 1 else 0
            try {
                lazyListState.animateScrollToItem(episodeItemIndex)
            } catch (_: Exception) {
            }
            try {
                episodeListState.animateScrollToItem(clampedIndex)
            } catch (_: Exception) {
            }
            val targetRequester = episodeFocusRequesters[clampedIndex]
            val success = requestFocusSafely(targetRequester)
            if (!success) {
                // Fallback: try Card 0
                requestFocusSafely(episodeFocusRequesters[0])
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
                            onSelectSeries = handleSelectHero,
                            ctaFocusRequester = heroFocus,
                            onDownFromCta = {
                                when (resolveHeroDownFocusTarget(feed)) {
                                    HeroDownFocusTarget.EpisodeCarousel -> {
                                        focusCoordinator.tryRequestFocus {
                                            focusRecentEpisodeCard()
                                        }
                                    }
                                    HeroDownFocusTarget.FirstRow -> {
                                        val firstNonEmptyRowIndex = feed.rows.indexOfFirst { it.items.isNotEmpty() }
                                        if (firstNonEmptyRowIndex >= 0) {
                                            focusCoordinator.tryRequestFocus {
                                                focusRowCard(firstNonEmptyRowIndex)
                                            }
                                        }
                                    }
                                    HeroDownFocusTarget.None -> Unit
                                }
                            },
                            onLeftFromCta = {
                                onLeftFromHero?.invoke()
                                onLeftFromEdge?.invoke()
                            },
                            modifier = Modifier
                                .fillParentMaxHeight()
                                .clipToBounds()
                        )
                    }
                }

                if (hasRecentEpisodes) {
                    @OptIn(
                        androidx.compose.foundation.ExperimentalFoundationApi::class,
                        androidx.compose.ui.ExperimentalComposeUiApi::class
                    )
                    item(key = "recent-episodes") {
                        Column(modifier = Modifier.fillMaxWidth()) {
                            Text(
                                text = "Recently Added Episodes",
                                style = MaterialTheme.typography.titleLarge.copy(
                                    fontWeight = FontWeight.Bold,
                                    letterSpacing = 0.5.sp
                                ),
                                color = MaterialTheme.colorScheme.onBackground,
                                modifier = Modifier.padding(start = 48.dp, end = 48.dp, bottom = 12.dp)
                            )
                            androidx.compose.runtime.CompositionLocalProvider(
                                androidx.compose.foundation.gestures.LocalBringIntoViewSpec provides horizontalBringIntoViewSpec
                            ) {
                                androidx.compose.foundation.lazy.LazyRow(
                                    state = episodeListState,
                                    modifier = Modifier
                                        .fillMaxWidth()
                                        .focusRestorer(),
                                    horizontalArrangement = Arrangement.spacedBy(20.dp),
                                    contentPadding = PaddingValues(horizontal = 48.dp, vertical = 8.dp)
                                ) {
                                    itemsIndexed(recentEpisodes, key = { _, episode -> episode.id }) { index, episode ->
                                        val transformOrigin = EdgeScaleTransform(index, recentEpisodes.size)
                                        RecentEpisodeCard(
                                            episode = episode,
                                            baseUrl = baseUrl,
                                            onSelect = { onSelectEpisode?.invoke(episode) },
                                            transformOrigin = transformOrigin,
                                            focusRequester = episodeFocusRequesters.getOrNull(index),
                                            onFocused = {
                                                recentEpisodeFocusIndex = index
                                            },
                                            onLeft = if (index == 0) {
                                                {
                                                    onLeftFromRecentEpisodes?.invoke()
                                                    onLeftFromEdge?.invoke()
                                                }
                                            } else null,
                                            onUp = if (effectiveHeroes.isNotEmpty()) {
                                                {
                                                    focusCoordinator.tryRequestFocus {
                                                        lazyListState.animateScrollToItem(0)
                                                        requestFocusSafely(heroFocus)
                                                    }
                                                }
                                            } else null,
                                            onDown = {
                                                val firstNonEmptyRowIndex = feed.rows.indexOfFirst { it.items.isNotEmpty() }
                                                if (firstNonEmptyRowIndex >= 0) {
                                                    focusCoordinator.tryRequestFocus {
                                                        focusRowCard(firstNonEmptyRowIndex)
                                                    }
                                                }
                                            }
                                        )
                                    }
                                }
                            }
                        }
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
                                        state = rowListStates.getOrNull(rowIndex)
                                            ?: androidx.compose.foundation.lazy.rememberLazyListState(),
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
                                                onSelect = { handleSelectRowCard(rowIndex, index, series.id) },
                                                transformOrigin = transformOrigin,
                                                focusRequester = itemRequester,
                                                onFocused = {
                                                    rowFocusIndices[rowIndex] = index
                                                },
                                                onUp = if (rowIndex == 0) {
                                                    if (hasRecentEpisodes) {
                                                        {
                                                            focusCoordinator.tryRequestFocus {
                                                                focusRecentEpisodeCard()
                                                            }
                                                        }
                                                    } else if (effectiveHeroes.isNotEmpty()) {
                                                        {
                                                            focusCoordinator.tryRequestFocus {
                                                                lazyListState.animateScrollToItem(0)
                                                                requestFocusSafely(heroFocus)
                                                            }
                                                        }
                                                    } else null
                                                } else null,
                                                onLeft = if (index == 0) {
                                                    {
                                                        onLeftFromRow?.invoke(rowIndex)
                                                        onLeftFromEdge?.invoke()
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
