package com.privatemovie.tv.modules.home

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.Button
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
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
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp
import androidx.tv.material3.Card as TvCard
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
 * border + scale treatment, and the featured hero (or first row item) takes initial
 * focus. Selecting a series navigates into the series watch/detail flow via [onSelectSeries].
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
            .padding(32.dp)
    ) {
        HomeHeader(
            activeBackendUrl = activeBackendUrl,
            onOpenDevSettings = onOpenDevSettings
        )

        Spacer(modifier = Modifier.height(24.dp))

        when (val state = uiState) {
            is HomeUiState.Loading -> HomeLoading()
            is HomeUiState.Error -> HomeError(
                message = state.message,
                onRetry = { reloadKey += 1 }
            )
            is HomeUiState.Success -> HomeFeedContent(
                feed = state.feed,
                onSelectSeries = onSelectSeries,
                onRetry = { reloadKey += 1 }
            )
        }
    }
}

@Composable
private fun HomeHeader(
    activeBackendUrl: String,
    onOpenDevSettings: () -> Unit,
    modifier: Modifier = Modifier
) {
    Row(
        modifier = modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.SpaceBetween,
        verticalAlignment = Alignment.CenterVertically
    ) {
        Column {
            Text(
                text = "Private Movie TV",
                style = MaterialTheme.typography.headlineLarge,
                color = MaterialTheme.colorScheme.onBackground
            )
            Text(
                text = "Public Catalog",
                style = MaterialTheme.typography.bodyMedium,
                color = Color.Gray
            )
        }

        Button(onClick = onOpenDevSettings) {
            Text("Backend URL Settings")
        }
    }

    Spacer(modifier = Modifier.height(12.dp))

    Text(
        text = "Connected Backend: $activeBackendUrl",
        style = MaterialTheme.typography.bodySmall,
        color = MaterialTheme.colorScheme.primary
    )
}

@Composable
private fun HomeLoading(modifier: Modifier = Modifier) {
    Box(
        modifier = modifier.fillMaxSize(),
        contentAlignment = Alignment.Center
    ) {
        Column(horizontalAlignment = Alignment.CenterHorizontally) {
            CircularProgressIndicator(color = MaterialTheme.colorScheme.primary)
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
                style = MaterialTheme.typography.titleLarge,
                color = MaterialTheme.colorScheme.onBackground
            )
            Spacer(modifier = Modifier.height(8.dp))
            Text(
                text = message,
                style = MaterialTheme.typography.bodyMedium,
                color = Color.LightGray
            )
            Spacer(modifier = Modifier.height(24.dp))
            Button(
                onClick = onRetry,
                modifier = Modifier.focusRequester(retryFocus)
            ) {
                Text("Retry")
            }
        }
    }
}

@Composable
private fun HomeFeedContent(
    feed: TvHomeFeed,
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
        verticalArrangement = Arrangement.spacedBy(28.dp)
    ) {
        feed.hero?.let { hero ->
            item(key = "hero-${hero.series.id}") {
                FeaturedHeroCard(
                    hero = hero,
                    onSelect = { onSelectSeries(hero.series.id) },
                    modifier = Modifier.focusRequester(heroFocus)
                )
            }
        }

        feed.rows.forEach { row ->
            if (row.items.isNotEmpty()) {
                item(key = "row-title-${row.title}") {
                    Text(
                        text = row.title,
                        style = MaterialTheme.typography.titleLarge,
                        color = MaterialTheme.colorScheme.onBackground
                    )
                }
                item(key = "row-${row.title}") {
                    LazyRow(
                        horizontalArrangement = Arrangement.spacedBy(16.dp)
                    ) {
                        items(row.items, key = { it.id }) { series ->
                            SeriesCard(
                                series = series,
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
    Box(
        modifier = modifier.fillMaxSize(),
        contentAlignment = Alignment.Center
    ) {
        Column(horizontalAlignment = Alignment.CenterHorizontally) {
            Text(
                text = "No public content yet",
                style = MaterialTheme.typography.titleLarge,
                color = MaterialTheme.colorScheme.onBackground
            )
            Spacer(modifier = Modifier.height(8.dp))
            Text(
                text = "New series will appear here once the catalog has playable content.",
                style = MaterialTheme.typography.bodyMedium,
                color = Color.LightGray
            )
            Spacer(modifier = Modifier.height(24.dp))
            OutlinedButton(onClick = onRetry) {
                Text("Retry")
            }
        }
    }
}

@Composable
private fun FeaturedHeroCard(
    hero: TvHomeHero,
    onSelect: () -> Unit,
    modifier: Modifier = Modifier
) {
    val series = hero.series

    TvCard(
        onClick = onSelect,
        modifier = modifier
            .fillMaxWidth()
            .height(220.dp)
    ) {
        Row(
            modifier = Modifier
                .fillMaxSize()
                .padding(24.dp),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Column(modifier = Modifier.weight(1f)) {
                Text(
                    text = "FEATURED",
                    style = MaterialTheme.typography.labelMedium,
                    color = MaterialTheme.colorScheme.primary
                )
                Spacer(modifier = Modifier.height(8.dp))
                Text(
                    text = series.title,
                    style = MaterialTheme.typography.headlineMedium,
                    color = MaterialTheme.colorScheme.onSurface
                )
                Spacer(modifier = Modifier.height(8.dp))
                if (hero.tags.isNotEmpty()) {
                    Text(
                        text = hero.tags.joinToString("  •  "),
                        style = MaterialTheme.typography.bodySmall,
                        color = Color.LightGray
                    )
                    Spacer(modifier = Modifier.height(8.dp))
                }
                Text(
                    text = seriesMetaLine(series),
                    style = MaterialTheme.typography.bodySmall,
                    color = Color.Gray
                )
            }

            Spacer(modifier = Modifier.width(24.dp))

            Button(onClick = onSelect) {
                Text("View Series")
            }
        }
    }
}

@Composable
fun SeriesCard(
    series: TvSeries,
    onSelect: () -> Unit,
    modifier: Modifier = Modifier
) {
    TvCard(
        onClick = onSelect,
        modifier = modifier
            .width(220.dp)
            .height(150.dp)
    ) {
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(16.dp),
            verticalArrangement = Arrangement.SpaceBetween
        ) {
            Text(
                text = series.type.uppercase(),
                style = MaterialTheme.typography.labelSmall,
                color = MaterialTheme.colorScheme.primary
            )
            Text(
                text = series.title,
                style = MaterialTheme.typography.titleMedium,
                color = MaterialTheme.colorScheme.onSurface,
                maxLines = 2
            )
            Text(
                text = seriesMetaLine(series),
                style = MaterialTheme.typography.bodySmall,
                color = Color.LightGray
            )
        }
    }
}

private fun seriesMetaLine(series: TvSeries): String {
    val genre = series.genres.firstOrNull()?.name
    val episodes = "${series.episodesCount} episodes"
    return if (genre != null) "$genre  •  $episodes" else episodes
}
