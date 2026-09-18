package com.privatemovie.tv.modules.home

import androidx.compose.animation.Crossfade
import androidx.compose.animation.core.tween
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
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
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.clipToBounds
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.focus.focusRestorer
import androidx.compose.ui.focus.onFocusChanged
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.TransformOrigin
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.input.key.onKeyEvent
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import coil.compose.SubcomposeAsyncImage
import coil.compose.SubcomposeAsyncImageContent
import coil.request.ImageRequest
import kotlinx.coroutines.launch
import androidx.tv.material3.Border
import androidx.tv.material3.Button as TvButton
import androidx.tv.material3.ButtonDefaults as TvButtonDefaults
import androidx.tv.material3.Card as TvCard
import androidx.tv.material3.CardDefaults as TvCardDefaults
import com.privatemovie.tv.components.EdgeScaleTransform
import com.privatemovie.tv.components.FocusTransitionCoordinator
import com.privatemovie.tv.components.ImageUrlResolver
import com.privatemovie.tv.components.LogoOrTitleRender
import com.privatemovie.tv.components.MediaAspectRatio
import com.privatemovie.tv.components.MediaPlaceholderIcons
import com.privatemovie.tv.components.TvMediaImage
import com.privatemovie.tv.components.isRepeatKeyEvent
import com.privatemovie.tv.components.requestFocusSafely
import com.privatemovie.tv.data.repository.MediaRepository
import com.privatemovie.tv.modules.home.internal.HeroSliderState
import com.privatemovie.tv.modules.home.internal.HomeUiState
import com.privatemovie.tv.modules.home.internal.TvHomeFeed
import com.privatemovie.tv.modules.home.internal.TvHomeHero
import com.privatemovie.tv.modules.home.internal.TvSeries
import com.privatemovie.tv.modules.home.internal.rememberHeroSliderState
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

@Composable
fun FloatingTopBarOverlay(
    onOpenDevSettings: () -> Unit,
    modifier: Modifier = Modifier,
    settingsFocusRequester: FocusRequester? = null,
    onDownFromSettings: (() -> Unit)? = null
) {
    Box(
        modifier = modifier
            .fillMaxWidth()
            .background(
                Brush.verticalGradient(
                    colors = listOf(
                        Color.Black.copy(alpha = 0.75f),
                        Color.Black.copy(alpha = 0.4f),
                        Color.Transparent
                    )
                )
            )
            .padding(horizontal = 48.dp, vertical = 16.dp)
    ) {
        HomeTopBar(
            onOpenDevSettings = onOpenDevSettings,
            settingsFocusRequester = settingsFocusRequester,
            onDownFromSettings = onDownFromSettings
        )
    }
}

@Composable
private fun HomeTopBar(
    onOpenDevSettings: () -> Unit,
    modifier: Modifier = Modifier,
    settingsFocusRequester: FocusRequester? = null,
    onDownFromSettings: (() -> Unit)? = null
) {
    Row(
        modifier = modifier
            .fillMaxWidth()
            .height(48.dp),
        horizontalArrangement = Arrangement.SpaceBetween,
        verticalAlignment = Alignment.CenterVertically
    ) {
        Row(
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            Text(
                text = "PRIVATE MOVIE",
                style = MaterialTheme.typography.titleLarge.copy(
                    fontWeight = FontWeight.Black,
                    letterSpacing = 2.sp
                ),
                color = MaterialTheme.colorScheme.primary
            )
            Box(
                modifier = Modifier
                    .clip(RoundedCornerShape(4.dp))
                    .background(Color.White.copy(alpha = 0.12f))
                    .padding(horizontal = 6.dp, vertical = 2.dp)
            ) {
                Text(
                    text = "TV",
                    style = MaterialTheme.typography.labelSmall.copy(
                        fontWeight = FontWeight.Bold,
                        letterSpacing = 1.sp
                    ),
                    color = Color.White.copy(alpha = 0.8f)
                )
            }
        }

        val buttonShape = RoundedCornerShape(20.dp)
        var buttonModifier: Modifier = Modifier
        if (settingsFocusRequester != null) {
            buttonModifier = buttonModifier.focusRequester(settingsFocusRequester)
        }
        if (onDownFromSettings != null) {
            buttonModifier = buttonModifier.onKeyEvent { keyEvent ->
                if (isRepeatKeyEvent(keyEvent)) {
                    return@onKeyEvent true
                }
                if (keyEvent.nativeKeyEvent.action == android.view.KeyEvent.ACTION_DOWN &&
                    keyEvent.nativeKeyEvent.keyCode == android.view.KeyEvent.KEYCODE_DPAD_DOWN
                ) {
                    onDownFromSettings()
                    true
                } else {
                    false
                }
            }
        }

        TvButton(
            onClick = onOpenDevSettings,
            modifier = buttonModifier,
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
                containerColor = Color.White.copy(alpha = 0.08f),
                focusedContainerColor = MaterialTheme.colorScheme.primary,
                contentColor = Color.White.copy(alpha = 0.9f),
                focusedContentColor = Color.White
            ),
            contentPadding = PaddingValues(horizontal = 14.dp, vertical = 8.dp)
        ) {
            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                Icon(
                    imageVector = MediaPlaceholderIcons.Settings,
                    contentDescription = null,
                    modifier = Modifier.size(16.dp)
                )
                Text(
                    text = "Settings",
                    style = MaterialTheme.typography.labelMedium.copy(fontWeight = FontWeight.SemiBold)
                )
            }
        }
    }
}

@Composable
private fun HomeLoading(modifier: Modifier = Modifier) {
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
private fun HomeError(
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
private fun HomeFeedContent(
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
    val firstCatalogItemFocus = remember { FocusRequester() }
    val coroutineScope = androidx.compose.runtime.rememberCoroutineScope()
    val lazyListState = androidx.compose.foundation.lazy.rememberLazyListState()
    val focusCoordinator = remember(coroutineScope) { FocusTransitionCoordinator(coroutineScope) }

    var isInitialFocusPlaced by rememberSaveable { mutableStateOf(false) }

    LaunchedEffect(effectiveHeroes) {
        if (!isInitialFocusPlaced && effectiveHeroes.isNotEmpty()) {
            isInitialFocusPlaced = true
            requestFocusSafely(heroFocus)
        }
    }

    @OptIn(androidx.compose.foundation.ExperimentalFoundationApi::class)
    val customBringIntoViewSpec = remember(lazyListState) {
        object : androidx.compose.foundation.gestures.BringIntoViewSpec {
            override fun calculateScrollDistance(offset: Float, size: Float, containerSize: Float): Float {
                val isVertical = containerSize <= 1080f
                if (isVertical && lazyListState.firstVisibleItemIndex == 0 && offset + size <= containerSize) {
                    return 0f
                }
                val margin = 64f
                val leadingEdge = offset
                val trailingEdge = offset + size
                return if (leadingEdge >= margin && trailingEdge <= containerSize - margin) {
                    0f
                } else if (leadingEdge < margin) {
                    leadingEdge - margin
                } else {
                    (trailingEdge - containerSize) + margin
                }
            }
        }
    }

    Box(modifier = modifier.fillMaxSize()) {
        @OptIn(
            androidx.compose.foundation.ExperimentalFoundationApi::class,
            androidx.compose.ui.ExperimentalComposeUiApi::class
        )
        androidx.compose.runtime.CompositionLocalProvider(
            androidx.compose.foundation.gestures.LocalBringIntoViewSpec provides customBringIntoViewSpec
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
                                val hasRows = feed.rows.any { it.items.isNotEmpty() }
                                if (hasRows) {
                                    focusCoordinator.tryRequestFocus {
                                        lazyListState.animateScrollToItem(1)
                                        requestFocusSafely(firstCatalogItemFocus)
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

                var isFirstCardPlaced = false
                feed.rows.forEachIndexed { rowIndex, row ->
                    if (row.items.isNotEmpty()) {
                        item(key = "row-header-${row.title}") {
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
                                @OptIn(androidx.compose.ui.ExperimentalComposeUiApi::class)
                                LazyRow(
                                    modifier = Modifier
                                        .fillMaxWidth()
                                        .focusRestorer(),
                                    horizontalArrangement = Arrangement.spacedBy(20.dp),
                                    contentPadding = PaddingValues(horizontal = 48.dp, vertical = 8.dp)
                                ) {
                                    itemsIndexed(row.items, key = { _, series -> series.id }) { index, series ->
                                        val transformOrigin = EdgeScaleTransform(index, row.items.size)
                                        val isVeryFirst = !isFirstCardPlaced && rowIndex == 0 && index == 0
                                        if (isVeryFirst) {
                                            isFirstCardPlaced = true
                                        }
                                        SeriesPosterCard(
                                            series = series,
                                            baseUrl = baseUrl,
                                            onSelect = { onSelectSeries(series.id) },
                                            transformOrigin = transformOrigin,
                                            focusRequester = if (isVeryFirst) firstCatalogItemFocus else null,
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

@Composable
fun FeaturedHeroSlider(
    sliderState: HeroSliderState,
    baseUrl: String,
    onSelectSeries: (String) -> Unit,
    onOpenDevSettings: () -> Unit,
    ctaFocusRequester: FocusRequester,
    modifier: Modifier = Modifier,
    settingsFocusRequester: FocusRequester? = null,
    onUpFromCta: (() -> Unit)? = null,
    onDownFromCta: (() -> Unit)? = null,
    onDownFromSettings: (() -> Unit)? = null
) {
    val heroes = sliderState.heroes
    if (heroes.isEmpty()) return

    val currentHero = sliderState.activeHero ?: heroes.first()
    var isCtaFocused by remember { mutableStateOf(false) }

    Box(
        modifier = modifier
            .fillMaxWidth()
            .clipToBounds()
            .background(MaterialTheme.colorScheme.background)
    ) {
        // Crossfading Backdrop Artwork & Metadata (pure display, not focusable)
        Crossfade(
            targetState = sliderState.activeIndex,
            animationSpec = tween(500),
            label = "HeroSliderCrossfade"
        ) { index ->
            val hero = heroes.getOrNull(index) ?: heroes.first()
            HeroBackdropAndDetails(
                hero = hero,
                baseUrl = baseUrl
            )
        }

        // Persistent CTA Button & Controls overlay (STABLE across slide changes, never loses focus!)
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(start = 48.dp, end = 48.dp, bottom = 48.dp),
            verticalArrangement = Arrangement.Bottom
        ) {
            val ctaShape = RoundedCornerShape(8.dp)
            TvButton(
                onClick = { onSelectSeries(currentHero.series.id) },
                modifier = Modifier
                    .focusRequester(ctaFocusRequester)
                    .onFocusChanged {
                        isCtaFocused = it.isFocused
                        sliderState.onCtaFocusChanged(it.isFocused)
                    }
                    .onKeyEvent { keyEvent ->
                        if (isRepeatKeyEvent(keyEvent)) {
                            return@onKeyEvent true
                        }
                        if (keyEvent.nativeKeyEvent.action == android.view.KeyEvent.ACTION_DOWN) {
                            when (keyEvent.nativeKeyEvent.keyCode) {
                                android.view.KeyEvent.KEYCODE_DPAD_UP -> {
                                    if (onUpFromCta != null) {
                                        onUpFromCta()
                                        true
                                    } else false
                                }
                                android.view.KeyEvent.KEYCODE_DPAD_DOWN -> {
                                    if (onDownFromCta != null) {
                                        onDownFromCta()
                                        true
                                    } else false
                                }
                                else -> sliderState.handleKeyEvent(keyEvent)
                            }
                        } else {
                            sliderState.handleKeyEvent(keyEvent)
                        }
                    },
                shape = TvButtonDefaults.shape(
                    shape = ctaShape,
                    focusedShape = ctaShape
                ),
                scale = TvButtonDefaults.scale(
                    scale = 1.0f,
                    focusedScale = 1.08f
                ),
                border = TvButtonDefaults.border(
                    border = Border.None,
                    focusedBorder = Border(
                        border = BorderStroke(width = 2.dp, color = Color.White),
                        shape = ctaShape
                    )
                ),
                colors = TvButtonDefaults.colors(
                    containerColor = MaterialTheme.colorScheme.primary,
                    focusedContainerColor = MaterialTheme.colorScheme.primary,
                    contentColor = Color.White,
                    focusedContentColor = Color.White
                ),
                contentPadding = PaddingValues(horizontal = 24.dp, vertical = 12.dp)
            ) {
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    if (isCtaFocused && sliderState.heroCount > 1) {
                        Icon(
                            imageVector = MediaPlaceholderIcons.ChevronLeft,
                            contentDescription = "Previous Slide",
                            modifier = Modifier.size(16.dp),
                            tint = Color.White.copy(alpha = 0.85f)
                        )
                    }
                    Text(
                        text = "View Series",
                        style = MaterialTheme.typography.titleMedium.copy(fontWeight = FontWeight.Bold)
                    )
                    if (isCtaFocused && sliderState.heroCount > 1) {
                        Icon(
                            imageVector = MediaPlaceholderIcons.ChevronRight,
                            contentDescription = "Next Slide",
                            modifier = Modifier.size(16.dp),
                            tint = Color.White.copy(alpha = 0.85f)
                        )
                    }
                }
            }
        }

        FloatingTopBarOverlay(
            onOpenDevSettings = onOpenDevSettings,
            settingsFocusRequester = settingsFocusRequester,
            onDownFromSettings = onDownFromSettings,
            modifier = Modifier.align(Alignment.TopCenter)
        )

        if (sliderState.heroCount > 1) {
            PaginationDots(
                count = sliderState.heroCount,
                activeIndex = sliderState.activeIndex,
                onSelectIndex = { sliderState.selectSlide(it) },
                modifier = Modifier
                    .align(Alignment.BottomEnd)
                    .padding(end = 48.dp, bottom = 48.dp)
            )
        }
    }
}

@Composable
fun HeroBackdropAndDetails(
    hero: TvHomeHero,
    baseUrl: String,
    modifier: Modifier = Modifier
) {
    val series = hero.series
    val context = LocalContext.current
    val rawImageUrl = series.backdropUrl ?: series.posterUrl
    val resolvedUrl = remember(rawImageUrl, baseUrl) {
        ImageUrlResolver.resolve(rawImageUrl, baseUrl)
    }

    Box(
        modifier = modifier
            .fillMaxSize()
            .clipToBounds()
    ) {
        // Full-bleed backdrop image with Crop filling 100% of container without aspect ratio spill
        if (resolvedUrl != null) {
            val imageRequest = remember(resolvedUrl, context) {
                ImageRequest.Builder(context)
                    .data(resolvedUrl)
                    .crossfade(true)
                    .build()
            }

            SubcomposeAsyncImage(
                model = imageRequest,
                contentDescription = series.title,
                contentScale = ContentScale.Crop,
                modifier = Modifier
                    .fillMaxSize()
                    .clipToBounds(),
                loading = {
                    Box(
                        modifier = Modifier
                            .fillMaxSize()
                            .background(Color(0xFF141419))
                    )
                },
                error = {
                    Box(
                        modifier = Modifier
                            .fillMaxSize()
                            .background(Color(0xFF141419))
                    )
                },
                success = {
                    SubcomposeAsyncImageContent()
                }
            )
        } else {
            Box(
                modifier = Modifier
                    .fillMaxSize()
                    .background(Color(0xFF141419))
            )
        }

        // Gradient overlay (horizontal cinematic fade from left)
        Box(
            modifier = Modifier
                .fillMaxSize()
                .background(
                    Brush.horizontalGradient(
                        colors = listOf(
                            Color.Black.copy(alpha = 0.95f),
                            Color.Black.copy(alpha = 0.85f),
                            Color.Black.copy(alpha = 0.4f),
                            Color.Transparent
                        ),
                        startX = 0f,
                        endX = 1400f
                    )
                )
        )

        // Gradient overlay (vertical fade: top scrim + SOLID dark background at bottom)
        Box(
            modifier = Modifier
                .fillMaxSize()
                .background(
                    Brush.verticalGradient(
                        colorStops = arrayOf(
                            0.0f to Color.Black.copy(alpha = 0.7f),
                            0.2f to Color.Transparent,
                            0.5f to Color.Transparent,
                            0.75f to Color.Black.copy(alpha = 0.85f),
                            1.0f to MaterialTheme.colorScheme.background
                        ),
                        startY = 0f
                    )
                )
        )

        // Billboard Content overlay (Text & Logo only - CTA button is placed below it)
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(start = 48.dp, end = 48.dp, top = 80.dp, bottom = 120.dp),
            verticalArrangement = Arrangement.Bottom
        ) {
            Column(
                modifier = Modifier.fillMaxWidth(0.65f)
            ) {
                // Featured pill & tags/genres
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    Box(
                        modifier = Modifier
                            .clip(RoundedCornerShape(4.dp))
                            .background(MaterialTheme.colorScheme.primary)
                            .padding(horizontal = 8.dp, vertical = 3.dp)
                    ) {
                        Text(
                            text = "FEATURED",
                            style = MaterialTheme.typography.labelSmall.copy(
                                fontWeight = FontWeight.Bold,
                                letterSpacing = 1.sp
                            ),
                            color = Color.White
                        )
                    }

                    val tagsToDisplay = if (hero.tags.isNotEmpty()) {
                        hero.tags
                    } else {
                        series.genres.map { it.name }
                    }

                    tagsToDisplay.take(3).forEach { tag ->
                        Box(
                            modifier = Modifier
                                .clip(RoundedCornerShape(4.dp))
                                .background(Color.White.copy(alpha = 0.15f))
                                .padding(horizontal = 8.dp, vertical = 3.dp)
                        ) {
                            Text(
                                text = tag,
                                style = MaterialTheme.typography.labelSmall.copy(fontWeight = FontWeight.Medium),
                                color = Color.White.copy(alpha = 0.9f)
                            )
                        }
                    }

                    series.rating?.let { rating ->
                        Row(
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.spacedBy(3.dp),
                            modifier = Modifier
                                .clip(RoundedCornerShape(4.dp))
                                .background(Color(0xFFE5A00D).copy(alpha = 0.2f))
                                .padding(horizontal = 6.dp, vertical = 3.dp)
                        ) {
                            Icon(
                                imageVector = MediaPlaceholderIcons.Star,
                                contentDescription = null,
                                tint = Color(0xFFE5A00D),
                                modifier = Modifier.size(12.dp)
                            )
                            Text(
                                text = rating,
                                style = MaterialTheme.typography.labelSmall.copy(fontWeight = FontWeight.Bold),
                                color = Color(0xFFE5A00D)
                            )
                        }
                    }
                }

                Spacer(modifier = Modifier.height(14.dp))

                // Logo or Title headline render
                LogoOrTitleRender(
                    logoUrl = series.logoUrl,
                    title = series.title,
                    baseUrl = baseUrl
                )

                // Synopsis
                series.description?.let { desc ->
                    Spacer(modifier = Modifier.height(8.dp))
                    Text(
                        text = desc,
                        style = MaterialTheme.typography.bodyMedium,
                        color = Color.White.copy(alpha = 0.8f),
                        maxLines = 2,
                        overflow = TextOverflow.Ellipsis
                    )
                }

                Spacer(modifier = Modifier.height(6.dp))
                Text(
                    text = seriesMetaLine(series),
                    style = MaterialTheme.typography.bodySmall.copy(fontWeight = FontWeight.Medium),
                    color = Color.White.copy(alpha = 0.6f)
                )
            }
        }
    }
}

@Composable
fun PaginationDots(
    count: Int,
    activeIndex: Int,
    onSelectIndex: (Int) -> Unit,
    modifier: Modifier = Modifier
) {
    Row(
        modifier = modifier,
        horizontalArrangement = Arrangement.spacedBy(8.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        for (i in 0 until count) {
            val isActive = i == activeIndex
            Box(
                modifier = Modifier
                    .size(if (isActive) 10.dp else 8.dp)
                    .clip(CircleShape)
                    .background(
                        if (isActive) MaterialTheme.colorScheme.primary
                        else Color.White.copy(alpha = 0.35f)
                    )
                    .clickable { onSelectIndex(i) }
            )
        }
    }
}

@Composable
private fun HomeEmpty(
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

@Composable
fun SeriesPosterCard(
    series: TvSeries,
    baseUrl: String,
    onSelect: () -> Unit,
    modifier: Modifier = Modifier,
    transformOrigin: TransformOrigin = TransformOrigin.Center,
    focusRequester: FocusRequester? = null,
    onUp: (() -> Unit)? = null
) {
    val cardShape = RoundedCornerShape(10.dp)

    Column(
        modifier = modifier.width(160.dp)
    ) {
        var cardModifier: Modifier = Modifier
            .width(160.dp)
            .height(240.dp)
            .graphicsLayer {
                this.transformOrigin = transformOrigin
            }

        if (focusRequester != null) {
            cardModifier = cardModifier.focusRequester(focusRequester)
        }
        if (onUp != null) {
            cardModifier = cardModifier.onKeyEvent { keyEvent ->
                if (isRepeatKeyEvent(keyEvent)) {
                    return@onKeyEvent true
                }
                if (keyEvent.nativeKeyEvent.action == android.view.KeyEvent.ACTION_DOWN &&
                    keyEvent.nativeKeyEvent.keyCode == android.view.KeyEvent.KEYCODE_DPAD_UP
                ) {
                    onUp()
                    true
                } else {
                    false
                }
            }
        }

        TvCard(
            onClick = onSelect,
            shape = TvCardDefaults.shape(
                shape = cardShape,
                focusedShape = cardShape
            ),
            scale = TvCardDefaults.scale(
                scale = 1.0f,
                focusedScale = 1.1f
            ),
            border = TvCardDefaults.border(
                border = Border.None,
                focusedBorder = Border(
                    border = BorderStroke(width = 3.dp, color = Color.White),
                    shape = cardShape
                )
            ),
            colors = TvCardDefaults.colors(
                containerColor = Color.Transparent,
                focusedContainerColor = Color.Transparent
            ),
            modifier = cardModifier
        ) {
            Box(
                modifier = Modifier
                    .fillMaxSize()
                    .clip(cardShape)
            ) {
                TvMediaImage(
                    imageUrl = series.posterUrl,
                    contentDescription = series.title,
                    baseUrl = baseUrl,
                    aspectRatio = MediaAspectRatio.POSTER,
                    title = series.title,
                    shape = RoundedCornerShape(0.dp),
                    modifier = Modifier.fillMaxSize()
                )

                // Format badge (Top Left)
                Box(
                    modifier = Modifier
                        .align(Alignment.TopStart)
                        .padding(8.dp)
                        .clip(RoundedCornerShape(4.dp))
                        .background(Color.Black.copy(alpha = 0.75f))
                        .padding(horizontal = 6.dp, vertical = 2.dp)
                ) {
                    Text(
                        text = series.type.uppercase(),
                        style = MaterialTheme.typography.labelSmall.copy(
                            fontSize = 10.sp,
                            fontWeight = FontWeight.Bold
                        ),
                        color = MaterialTheme.colorScheme.primary
                    )
                }

                // Rating badge (Top Right)
                series.rating?.let { rating ->
                    Row(
                        modifier = Modifier
                            .align(Alignment.TopEnd)
                            .padding(8.dp)
                            .clip(RoundedCornerShape(4.dp))
                            .background(Color.Black.copy(alpha = 0.75f))
                            .padding(horizontal = 5.dp, vertical = 2.dp),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(2.dp)
                    ) {
                        Icon(
                            imageVector = MediaPlaceholderIcons.Star,
                            contentDescription = null,
                            tint = Color(0xFFE5A00D),
                            modifier = Modifier.size(10.dp)
                        )
                        Text(
                            text = rating,
                            style = MaterialTheme.typography.labelSmall.copy(
                                fontSize = 10.sp,
                                fontWeight = FontWeight.Bold
                            ),
                            color = Color(0xFFE5A00D)
                        )
                    }
                }
            }
        }

        Spacer(modifier = Modifier.height(8.dp))

        // Clean title & metadata beneath the poster card
        Text(
            text = series.title,
            style = MaterialTheme.typography.bodyMedium.copy(fontWeight = FontWeight.SemiBold),
            color = MaterialTheme.colorScheme.onSurface,
            maxLines = 1,
            overflow = TextOverflow.Ellipsis
        )
        Text(
            text = seriesMetaLine(series),
            style = MaterialTheme.typography.bodySmall,
            color = Color.Gray,
            maxLines = 1,
            overflow = TextOverflow.Ellipsis
        )
    }
}

private fun seriesMetaLine(series: TvSeries): String {
    val genre = series.genres.firstOrNull()?.name
    val episodes = "${series.episodesCount} ep"
    return if (genre != null) "$genre • $episodes" else episodes
}
