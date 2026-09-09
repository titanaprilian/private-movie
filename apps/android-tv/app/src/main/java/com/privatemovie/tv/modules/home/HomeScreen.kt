package com.privatemovie.tv.modules.home

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
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
import androidx.compose.foundation.lazy.items
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
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.tv.material3.Border
import androidx.tv.material3.Button as TvButton
import androidx.tv.material3.ButtonDefaults as TvButtonDefaults
import androidx.tv.material3.Card as TvCard
import androidx.tv.material3.CardDefaults as TvCardDefaults
import com.privatemovie.tv.components.MediaAspectRatio
import com.privatemovie.tv.components.MediaPlaceholderIcons
import com.privatemovie.tv.components.TvMediaImage
import com.privatemovie.tv.data.repository.MediaRepository
import com.privatemovie.tv.modules.home.internal.HomeUiState
import com.privatemovie.tv.modules.home.internal.TvHomeFeed
import com.privatemovie.tv.modules.home.internal.TvHomeHero
import com.privatemovie.tv.modules.home.internal.TvSeries
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

    Column(
        modifier = modifier
            .fillMaxSize()
            .background(MaterialTheme.colorScheme.background)
            .padding(horizontal = 48.dp, vertical = 28.dp)
    ) {
        HomeTopBar(
            onOpenDevSettings = onOpenDevSettings
        )

        Spacer(modifier = Modifier.height(16.dp))

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
                onRetry = { reloadKey += 1 }
            )
        }
    }
}

@Composable
private fun HomeTopBar(
    onOpenDevSettings: () -> Unit,
    modifier: Modifier = Modifier
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
        TvButton(
            onClick = onOpenDevSettings,
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
    onRetry: () -> Unit,
    modifier: Modifier = Modifier
) {
    val hasContent = feed.hero != null || feed.rows.any { it.items.isNotEmpty() }
    if (!hasContent) {
        HomeEmpty(onRetry = onRetry, modifier = modifier)
        return
    }

    val heroFocus = remember { FocusRequester() }
    LaunchedEffect(feed.hero?.series?.id) {
        if (feed.hero != null) heroFocus.requestFocus()
    }

    LazyColumn(
        modifier = modifier.fillMaxSize(),
        verticalArrangement = Arrangement.spacedBy(32.dp),
        contentPadding = PaddingValues(bottom = 40.dp)
    ) {
        feed.hero?.let { hero ->
            item(key = "hero-${hero.series.id}") {
                FeaturedHeroCard(
                    hero = hero,
                    baseUrl = baseUrl,
                    onSelect = { onSelectSeries(hero.series.id) },
                    ctaFocusRequester = heroFocus
                )
            }
        }

        feed.rows.forEach { row ->
            if (row.items.isNotEmpty()) {
                item(key = "row-header-${row.title}") {
                    Text(
                        text = row.title,
                        style = MaterialTheme.typography.titleLarge.copy(
                            fontWeight = FontWeight.Bold,
                            letterSpacing = 0.5.sp
                        ),
                        color = MaterialTheme.colorScheme.onBackground,
                        modifier = Modifier.padding(bottom = 12.dp)
                    )
                    LazyRow(
                        horizontalArrangement = Arrangement.spacedBy(20.dp),
                        contentPadding = PaddingValues(vertical = 8.dp)
                    ) {
                        items(row.items, key = { it.id }) { series ->
                            SeriesPosterCard(
                                series = series,
                                baseUrl = baseUrl,
                                onSelect = { onSelectSeries(series.id) }
                            )
                        }
                    }
                }
            }
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
private fun FeaturedHeroCard(
    hero: TvHomeHero,
    baseUrl: String,
    onSelect: () -> Unit,
    ctaFocusRequester: FocusRequester,
    modifier: Modifier = Modifier
) {
    val series = hero.series
    val cardShape = RoundedCornerShape(16.dp)

    Box(
        modifier = modifier
            .fillMaxWidth()
            .height(340.dp)
            .clip(cardShape)
            .background(Color(0xFF18181F))
    ) {
        // Full-width backdrop image
        TvMediaImage(
            imageUrl = series.backdropUrl ?: series.posterUrl,
            contentDescription = series.title,
            baseUrl = baseUrl,
            aspectRatio = MediaAspectRatio.BACKDROP,
            shape = RoundedCornerShape(0.dp),
            contentScale = ContentScale.Crop,
            modifier = Modifier.fillMaxSize()
        )

        // Gradient overlay (cinematic fade to dark surface)
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

        Box(
            modifier = Modifier
                .fillMaxSize()
                .background(
                    Brush.verticalGradient(
                        colors = listOf(
                            Color.Transparent,
                            Color.Black.copy(alpha = 0.7f)
                        ),
                        startY = 100f
                    )
                )
        )

        // Billboard Content overlay
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(32.dp),
            verticalArrangement = Arrangement.SpaceBetween
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

                Spacer(modifier = Modifier.height(12.dp))

                // Title
                Text(
                    text = series.title,
                    style = MaterialTheme.typography.headlineLarge.copy(
                        fontWeight = FontWeight.ExtraBold,
                        letterSpacing = 0.5.sp
                    ),
                    color = Color.White,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis
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

            // Primary Action Button taking initial focus
            val ctaShape = RoundedCornerShape(8.dp)
            TvButton(
                onClick = onSelect,
                modifier = Modifier.focusRequester(ctaFocusRequester),
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
                Text(
                    text = "View Series",
                    style = MaterialTheme.typography.titleMedium.copy(fontWeight = FontWeight.Bold)
                )
            }
        }
    }
}

@Composable
fun SeriesPosterCard(
    series: TvSeries,
    baseUrl: String,
    onSelect: () -> Unit,
    modifier: Modifier = Modifier
) {
    val cardShape = RoundedCornerShape(10.dp)

    Column(
        modifier = modifier.width(160.dp)
    ) {
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
            modifier = Modifier
                .width(160.dp)
                .height(240.dp)
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
