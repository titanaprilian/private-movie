package com.privatemovie.tv.modules.detail

import androidx.compose.foundation.background
import androidx.compose.foundation.border
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
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
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
import androidx.compose.ui.draw.scale
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.focus.onFocusChanged
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp
import com.privatemovie.tv.data.repository.MediaRepository
import com.privatemovie.tv.modules.detail.internal.DetailUiState
import com.privatemovie.tv.modules.detail.internal.SourcePickerDialog
import com.privatemovie.tv.modules.detail.internal.TvEpisode
import com.privatemovie.tv.modules.detail.internal.TvSeason
import com.privatemovie.tv.modules.detail.internal.TvSeriesDetails
import com.privatemovie.tv.modules.detail.internal.TvVideoSource
import com.privatemovie.tv.modules.detail.internal.toTvSeriesDetails
import com.privatemovie.tv.modules.player.internal.EpisodePlaybackDecision
import com.privatemovie.tv.modules.player.internal.decideEpisodePlayback

/**
 * Public seam for the Android TV series watch/detail experience.
 *
 * Renders real public series metadata, seasons, and episodes fetched from [MediaRepository]
 * (`GET /api/series/{id}`). Provides D-pad navigation over seasons and episodes, and shows
 * an explicit source picker modal before playback when multiple video sources exist for an episode.
 */
@Composable
fun DetailScreen(
    seriesId: String,
    mediaRepository: MediaRepository,
    onPlayEpisode: (String) -> Unit,
    onBack: () -> Unit,
    modifier: Modifier = Modifier,
    activeBackendUrl: String? = null,
    onPlaySource: ((episodeId: String, videoSource: TvVideoSource) -> Unit)? = null
) {
    var uiState by remember { mutableStateOf<DetailUiState>(DetailUiState.Loading) }
    var reloadKey by remember { mutableIntStateOf(0) }
    var pendingSourcePickerEpisode by remember { mutableStateOf<TvEpisode?>(null) }

    LaunchedEffect(seriesId, reloadKey) {
        uiState = DetailUiState.Loading
        val result = mediaRepository.getSeriesById(seriesId)
        uiState = result.fold(
            onSuccess = { DetailUiState.Success(it.toTvSeriesDetails()) },
            onFailure = { DetailUiState.Error(it.message ?: "Failed to load series details") }
        )
    }

    val handleStartPlayback: (TvEpisode, TvVideoSource?) -> Unit = { episode, source ->
        if (source != null && onPlaySource != null) {
            onPlaySource(episode.id, source)
        } else {
            onPlayEpisode(episode.id)
        }
    }

    Column(
        modifier = modifier
            .fillMaxSize()
            .background(MaterialTheme.colorScheme.background)
            .padding(32.dp)
    ) {
        when (val state = uiState) {
            is DetailUiState.Loading -> DetailLoading(onBack = onBack)
            is DetailUiState.Error -> DetailError(
                message = state.message,
                onRetry = { reloadKey += 1 },
                onBack = onBack
            )
            is DetailUiState.Success -> DetailContent(
                details = state.details,
                activeBackendUrl = activeBackendUrl,
                onSelectEpisode = { episode ->
                    // End-to-end flow decision shared with the player handoff:
                    // unavailable episodes stay on detail with their inline
                    // "No video sources" state, single-source episodes play
                    // directly, and multi-source episodes open the picker.
                    when (decideEpisodePlayback(episode.videoSources.size)) {
                        is EpisodePlaybackDecision.Unavailable -> Unit
                        is EpisodePlaybackDecision.PlaySingle -> {
                            val singleSource = episode.videoSources.firstOrNull()
                            handleStartPlayback(episode, singleSource)
                        }
                        is EpisodePlaybackDecision.NeedsSourcePicker -> {
                            pendingSourcePickerEpisode = episode
                        }
                    }
                },
                onBack = onBack
            )
        }
    }

    pendingSourcePickerEpisode?.let { episode ->
        SourcePickerDialog(
            episodeTitle = episode.title,
            sources = episode.videoSources,
            onSelectSource = { source ->
                pendingSourcePickerEpisode = null
                handleStartPlayback(episode, source)
            },
            onDismiss = {
                pendingSourcePickerEpisode = null
            }
        )
    }
}

@Composable
private fun DetailLoading(
    onBack: () -> Unit,
    modifier: Modifier = Modifier
) {
    Column(modifier = modifier.fillMaxSize()) {
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Text(
                text = "Series Details",
                style = MaterialTheme.typography.headlineMedium,
                color = MaterialTheme.colorScheme.onBackground
            )
            Button(onClick = onBack) {
                Text("Back")
            }
        }

        Box(
            modifier = Modifier
                .fillMaxSize()
                .weight(1f),
            contentAlignment = Alignment.Center
        ) {
            Column(horizontalAlignment = Alignment.CenterHorizontally) {
                CircularProgressIndicator(color = MaterialTheme.colorScheme.primary)
                Spacer(modifier = Modifier.height(16.dp))
                Text(
                    text = "Loading series details…",
                    style = MaterialTheme.typography.titleMedium,
                    color = MaterialTheme.colorScheme.onBackground
                )
            }
        }
    }
}

@Composable
private fun DetailError(
    message: String,
    onRetry: () -> Unit,
    onBack: () -> Unit,
    modifier: Modifier = Modifier
) {
    val retryFocus = remember { FocusRequester() }
    LaunchedEffect(Unit) { retryFocus.requestFocus() }

    Column(modifier = modifier.fillMaxSize()) {
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Text(
                text = "Series Details",
                style = MaterialTheme.typography.headlineMedium,
                color = MaterialTheme.colorScheme.onBackground
            )
            Button(onClick = onBack) {
                Text("Back")
            }
        }

        Box(
            modifier = Modifier
                .fillMaxSize()
                .weight(1f),
            contentAlignment = Alignment.Center
        ) {
            Column(horizontalAlignment = Alignment.CenterHorizontally) {
                Text(
                    text = "Could not load series",
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
                Row(horizontalArrangement = Arrangement.spacedBy(16.dp)) {
                    Button(
                        onClick = onRetry,
                        modifier = Modifier.focusRequester(retryFocus)
                    ) {
                        Text("Retry")
                    }
                    OutlinedButton(onClick = onBack) {
                        Text("Back to Home")
                    }
                }
            }
        }
    }
}

@Composable
private fun DetailContent(
    details: TvSeriesDetails,
    activeBackendUrl: String?,
    onSelectEpisode: (TvEpisode) -> Unit,
    onBack: () -> Unit,
    modifier: Modifier = Modifier
) {
    var selectedSeasonIndex by remember { mutableIntStateOf(0) }

    val currentEpisodes = if (details.seasons.isNotEmpty()) {
        details.seasons.getOrNull(selectedSeasonIndex)?.episodes ?: emptyList()
    } else {
        details.standaloneEpisodes
    }

    LazyColumn(
        modifier = modifier.fillMaxSize(),
        verticalArrangement = Arrangement.spacedBy(24.dp)
    ) {
        item(key = "header") {
            SeriesHeaderCard(
                details = details,
                activeBackendUrl = activeBackendUrl,
                onBack = onBack
            )
        }

        if (details.seasons.size > 1) {
            item(key = "seasons-bar") {
                SeasonSelectorBar(
                    seasons = details.seasons,
                    selectedIndex = selectedSeasonIndex,
                    onSelectSeason = { index -> selectedSeasonIndex = index }
                )
            }
        }

        item(key = "section-title") {
            val titleText = if (details.seasons.isNotEmpty()) {
                val currentSeason = details.seasons.getOrNull(selectedSeasonIndex)
                currentSeason?.title ?: "Episodes"
            } else {
                "Episodes"
            }

            Text(
                text = titleText,
                style = MaterialTheme.typography.titleLarge,
                color = MaterialTheme.colorScheme.onBackground
            )
        }

        if (currentEpisodes.isEmpty()) {
            item(key = "empty-episodes") {
                Text(
                    text = "No episodes available for this section.",
                    style = MaterialTheme.typography.bodyMedium,
                    color = Color.Gray,
                    modifier = Modifier.padding(vertical = 16.dp)
                )
            }
        } else {
            items(currentEpisodes, key = { it.id }) { episode ->
                TvEpisodeCard(
                    episode = episode,
                    onSelect = { onSelectEpisode(episode) }
                )
            }
        }
    }
}

@Composable
private fun SeriesHeaderCard(
    details: TvSeriesDetails,
    activeBackendUrl: String?,
    onBack: () -> Unit,
    modifier: Modifier = Modifier
) {
    Card(
        colors = CardDefaults.cardColors(
            containerColor = MaterialTheme.colorScheme.surface
        ),
        modifier = modifier.fillMaxWidth(),
        shape = RoundedCornerShape(16.dp)
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(24.dp)
        ) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.Top
            ) {
                Column(modifier = Modifier.weight(1f)) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Text(
                            text = details.type.uppercase(),
                            style = MaterialTheme.typography.labelMedium,
                            color = MaterialTheme.colorScheme.primary
                        )
                        if (details.rating != null) {
                            Text(
                                text = "  •  Rating: ${details.rating}",
                                style = MaterialTheme.typography.labelMedium,
                                color = Color.Yellow
                            )
                        }
                    }

                    Spacer(modifier = Modifier.height(8.dp))

                    Text(
                        text = details.title,
                        style = MaterialTheme.typography.headlineLarge,
                        color = MaterialTheme.colorScheme.onSurface
                    )

                    val genreNames = details.genres.joinToString("  •  ") { it.name }
                    if (genreNames.isNotEmpty()) {
                        Spacer(modifier = Modifier.height(6.dp))
                        Text(
                            text = genreNames,
                            style = MaterialTheme.typography.bodyMedium,
                            color = Color.LightGray
                        )
                    }

                    details.description?.let { desc ->
                        Spacer(modifier = Modifier.height(12.dp))
                        Text(
                            text = desc,
                            style = MaterialTheme.typography.bodyMedium,
                            color = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                    }

                    activeBackendUrl?.let { url ->
                        Spacer(modifier = Modifier.height(12.dp))
                        Text(
                            text = "Connected Backend: $url",
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.primary
                        )
                    }
                }

                Spacer(modifier = Modifier.width(16.dp))

                Button(onClick = onBack) {
                    Text("Back")
                }
            }
        }
    }
}

@Composable
private fun SeasonSelectorBar(
    seasons: List<TvSeason>,
    selectedIndex: Int,
    onSelectSeason: (Int) -> Unit,
    modifier: Modifier = Modifier
) {
    LazyRow(
        modifier = modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        itemsIndexed(seasons) { index, season ->
            val isSelected = index == selectedIndex
            var isFocused by remember { mutableStateOf(false) }

            Button(
                onClick = { onSelectSeason(index) },
                colors = ButtonDefaults.buttonColors(
                    containerColor = if (isSelected) {
                        MaterialTheme.colorScheme.primary
                    } else if (isFocused) {
                        MaterialTheme.colorScheme.surfaceVariant
                    } else {
                        Color(0xFF2C2C2C)
                    }
                ),
                modifier = Modifier
                    .onFocusChanged { isFocused = it.isFocused }
                    .then(
                        if (isFocused && !isSelected) {
                            Modifier.border(2.dp, MaterialTheme.colorScheme.primary, RoundedCornerShape(8.dp))
                        } else {
                            Modifier
                        }
                    )
            ) {
                Text(
                    text = season.title,
                    color = if (isSelected) MaterialTheme.colorScheme.onPrimary else MaterialTheme.colorScheme.onSurface
                )
            }
        }
    }
}

@Composable
private fun TvEpisodeCard(
    episode: TvEpisode,
    onSelect: () -> Unit,
    modifier: Modifier = Modifier
) {
    var isFocused by remember { mutableStateOf(false) }

    Card(
        onClick = onSelect,
        enabled = episode.videoSources.isNotEmpty(),
        colors = CardDefaults.cardColors(
            containerColor = if (isFocused) {
                MaterialTheme.colorScheme.surfaceVariant
            } else {
                MaterialTheme.colorScheme.surface
            }
        ),
        modifier = modifier
            .fillMaxWidth()
            .onFocusChanged { isFocused = it.isFocused }
            .then(
                if (isFocused) {
                    Modifier
                        .scale(1.01f)
                        .border(3.dp, MaterialTheme.colorScheme.primary, RoundedCornerShape(12.dp))
                } else {
                    Modifier.border(1.dp, Color(0xFF3A3A3A), RoundedCornerShape(12.dp))
                }
            ),
        shape = RoundedCornerShape(12.dp)
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(20.dp),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Column(modifier = Modifier.weight(1f)) {
                Text(
                    text = "Episode ${episode.order} — ${episode.title}",
                    style = MaterialTheme.typography.titleMedium,
                    color = MaterialTheme.colorScheme.onSurface
                )

                episode.description?.let { desc ->
                    Spacer(modifier = Modifier.height(4.dp))
                    Text(
                        text = desc,
                        style = MaterialTheme.typography.bodySmall,
                        color = Color.LightGray,
                        maxLines = 2
                    )
                }

                Spacer(modifier = Modifier.height(8.dp))

                val sourceCountText = when (episode.videoSources.size) {
                    0 -> "No video sources"
                    1 -> "1 Playback Source"
                    else -> "${episode.videoSources.size} Playback Sources (Source Picker)"
                }

                Text(
                    text = sourceCountText,
                    style = MaterialTheme.typography.labelSmall,
                    color = if (episode.videoSources.size > 1) MaterialTheme.colorScheme.primary else Color.Gray
                )
            }

            Spacer(modifier = Modifier.width(16.dp))

            Button(
                onClick = onSelect,
                enabled = episode.videoSources.isNotEmpty()
            ) {
                Text(
                    if (episode.videoSources.size > 1) "Select Source & Play" else "Play Episode"
                )
            }
        }
    }
}
