package com.privatemovie.tv.modules.detail

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
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.tv.material3.Border
import androidx.tv.material3.Button as TvButton
import androidx.tv.material3.ButtonDefaults as TvButtonDefaults
import com.privatemovie.tv.data.repository.MediaRepository
import com.privatemovie.tv.modules.detail.internal.DetailUiState
import com.privatemovie.tv.modules.detail.internal.EpisodeCarousel
import com.privatemovie.tv.modules.detail.internal.EpisodeInfoPanel
import com.privatemovie.tv.modules.detail.internal.SeriesHeader
import com.privatemovie.tv.modules.detail.internal.SourcePickerDialog
import com.privatemovie.tv.modules.detail.internal.TvEpisode
import com.privatemovie.tv.modules.detail.internal.TvSeason
import com.privatemovie.tv.modules.detail.internal.TvSeriesDetails
import com.privatemovie.tv.modules.detail.internal.TvVideoSource
import com.privatemovie.tv.modules.detail.internal.findFirstPlayableEpisode
import com.privatemovie.tv.modules.detail.internal.findMetadataForEpisode
import com.privatemovie.tv.modules.detail.internal.toTvSeriesDetails
import com.privatemovie.tv.modules.player.internal.EpisodePlaybackDecision
import com.privatemovie.tv.modules.player.internal.PlaybackMetadataHandoff
import com.privatemovie.tv.modules.player.internal.decideEpisodePlayback

/**
 * Public seam for the Android TV series watch/detail experience.
 *
 * Renders real public series metadata, seasons, and episodes fetched from [MediaRepository]
 * (`GET /api/series/{id}`). Provides:
 * 1. An immersive series header with 16:9 backdrop banner, 2:3 vertical poster card,
 *    rich metadata, and a prominent "Play Now / Watch Episode 1" CTA button that receives
 *    initial D-pad focus.
 * 2. Horizontal season selector tabs when multiple seasons exist.
 * 3. A horizontal 16:9 episode thumbnail carousel with episode order badges and titles.
 * 4. A dynamic info panel updating with the highlighted episode's synopsis, title, and
 *    playback sources as the user navigates across cards.
 * 5. Single-click instant playback for single-source episodes and an explicit source picker
 *    modal for multi-source episodes.
 */
@Composable
fun DetailScreen(
    seriesId: String,
    mediaRepository: MediaRepository,
    onPlayEpisode: (episodeId: String, metadata: PlaybackMetadataHandoff) -> Unit,
    onBack: () -> Unit,
    modifier: Modifier = Modifier,
    activeBackendUrl: String? = null,
    onPlaySource: ((episodeId: String, videoSource: TvVideoSource, metadata: PlaybackMetadataHandoff) -> Unit)? = null
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
        val metadata = (uiState as? DetailUiState.Success)?.details?.findMetadataForEpisode(episode.id)
            ?: PlaybackMetadataHandoff(
                episodeOrder = episode.order,
                episodeTitle = episode.title
            )
        if (source != null && onPlaySource != null) {
            onPlaySource(episode.id, source, metadata)
        } else {
            onPlayEpisode(episode.id, metadata)
        }
    }

    val handleSelectEpisode: (TvEpisode) -> Unit = { episode ->
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
                onSelectEpisode = handleSelectEpisode,
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
                style = MaterialTheme.typography.headlineMedium.copy(fontWeight = FontWeight.Bold),
                color = MaterialTheme.colorScheme.onBackground
            )
            val backShape = RoundedCornerShape(8.dp)
            TvButton(
                onClick = onBack,
                shape = TvButtonDefaults.shape(shape = backShape, focusedShape = backShape),
                scale = TvButtonDefaults.scale(scale = 1.0f, focusedScale = 1.05f),
                border = TvButtonDefaults.border(
                    border = Border.None,
                    focusedBorder = Border(
                        border = BorderStroke(width = 2.dp, color = Color.White),
                        shape = backShape
                    )
                ),
                colors = TvButtonDefaults.colors(
                    containerColor = Color.White.copy(alpha = 0.15f),
                    focusedContainerColor = Color.White.copy(alpha = 0.3f),
                    contentColor = Color.White,
                    focusedContentColor = Color.White
                )
            ) {
                Text("Back", fontWeight = FontWeight.Medium)
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
                style = MaterialTheme.typography.headlineMedium.copy(fontWeight = FontWeight.Bold),
                color = MaterialTheme.colorScheme.onBackground
            )
            val backShape = RoundedCornerShape(8.dp)
            TvButton(
                onClick = onBack,
                shape = TvButtonDefaults.shape(shape = backShape, focusedShape = backShape),
                scale = TvButtonDefaults.scale(scale = 1.0f, focusedScale = 1.05f),
                border = TvButtonDefaults.border(
                    border = Border.None,
                    focusedBorder = Border(
                        border = BorderStroke(width = 2.dp, color = Color.White),
                        shape = backShape
                    )
                ),
                colors = TvButtonDefaults.colors(
                    containerColor = Color.White.copy(alpha = 0.15f),
                    focusedContainerColor = Color.White.copy(alpha = 0.3f),
                    contentColor = Color.White,
                    focusedContentColor = Color.White
                )
            ) {
                Text("Back", fontWeight = FontWeight.Medium)
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
                Row(horizontalArrangement = Arrangement.spacedBy(16.dp)) {
                    val btnShape = RoundedCornerShape(8.dp)
                    TvButton(
                        onClick = onRetry,
                        modifier = Modifier.focusRequester(retryFocus),
                        shape = TvButtonDefaults.shape(shape = btnShape, focusedShape = btnShape),
                        scale = TvButtonDefaults.scale(scale = 1.0f, focusedScale = 1.08f),
                        border = TvButtonDefaults.border(
                            border = Border.None,
                            focusedBorder = Border(
                                border = BorderStroke(width = 2.dp, color = Color.White),
                                shape = btnShape
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

                    TvButton(
                        onClick = onBack,
                        shape = TvButtonDefaults.shape(shape = btnShape, focusedShape = btnShape),
                        scale = TvButtonDefaults.scale(scale = 1.0f, focusedScale = 1.05f),
                        border = TvButtonDefaults.border(
                            border = Border.None,
                            focusedBorder = Border(
                                border = BorderStroke(width = 2.dp, color = Color.White),
                                shape = btnShape
                            )
                        ),
                        colors = TvButtonDefaults.colors(
                            containerColor = Color.White.copy(alpha = 0.15f),
                            focusedContainerColor = Color.White.copy(alpha = 0.25f),
                            contentColor = Color.White,
                            focusedContentColor = Color.White
                        )
                    ) {
                        Text("Back to Home", fontWeight = FontWeight.Medium)
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
    val firstEpisode = remember(details) { findFirstPlayableEpisode(details) }
    var currentlyInspectedEpisode by remember(details, selectedSeasonIndex) {
        val initialEp = if (details.seasons.isNotEmpty()) {
            details.seasons.getOrNull(selectedSeasonIndex)?.episodes?.firstOrNull()
        } else {
            details.standaloneEpisodes.firstOrNull()
        }
        mutableStateOf(initialEp)
    }

    val playCtaFocusRequester = remember { FocusRequester() }

    // Initial D-pad focus placed directly onto the Play Now CTA on screen entry
    LaunchedEffect(details.id) {
        playCtaFocusRequester.requestFocus()
    }

    val currentEpisodes = if (details.seasons.isNotEmpty()) {
        details.seasons.getOrNull(selectedSeasonIndex)?.episodes ?: emptyList()
    } else {
        details.standaloneEpisodes
    }

    LazyColumn(
        modifier = modifier.fillMaxSize(),
        verticalArrangement = Arrangement.spacedBy(28.dp),
        contentPadding = PaddingValues(bottom = 40.dp)
    ) {
        // 1. Immersive Series Header (Backdrop + Poster + Metadata + Play CTA)
        item(key = "header") {
            SeriesHeader(
                details = details,
                baseUrl = activeBackendUrl,
                firstPlayableEpisode = firstEpisode,
                playCtaFocusRequester = playCtaFocusRequester,
                onPlayCta = {
                    firstEpisode?.let { onSelectEpisode(it) }
                },
                onBack = onBack
            )
        }

        // 2. Season Selector Tabs (if more than 1 season)
        if (details.seasons.size > 1) {
            item(key = "seasons-bar") {
                SeasonSelectorBar(
                    seasons = details.seasons,
                    selectedIndex = selectedSeasonIndex,
                    onSelectSeason = { index ->
                        selectedSeasonIndex = index
                        val nextSeasonEp = details.seasons.getOrNull(index)?.episodes?.firstOrNull()
                        currentlyInspectedEpisode = nextSeasonEp
                    }
                )
            }
        }

        // 3. Dynamic Episode Info Panel (shows title, full synopsis, and playback sources)
        item(key = "dynamic-info-panel") {
            EpisodeInfoPanel(
                episode = currentlyInspectedEpisode
            )
        }

        // 4. Horizontal 16:9 Episode Carousel Section
        item(key = "episodes-section") {
            val sectionTitle = if (details.seasons.isNotEmpty()) {
                val currentSeason = details.seasons.getOrNull(selectedSeasonIndex)
                currentSeason?.title ?: "Episodes"
            } else {
                "Episodes"
            }

            Column(modifier = Modifier.fillMaxWidth()) {
                Text(
                    text = sectionTitle,
                    style = MaterialTheme.typography.titleLarge.copy(
                        fontWeight = FontWeight.Bold,
                        letterSpacing = 0.5.sp
                    ),
                    color = MaterialTheme.colorScheme.onBackground,
                    modifier = Modifier.padding(bottom = 8.dp)
                )

                if (currentEpisodes.isEmpty()) {
                    Text(
                        text = "No episodes available for this section.",
                        style = MaterialTheme.typography.bodyMedium,
                        color = Color.Gray,
                        modifier = Modifier.padding(vertical = 16.dp)
                    )
                } else {
                    EpisodeCarousel(
                        episodes = currentEpisodes,
                        baseUrl = activeBackendUrl,
                        onSelectEpisode = onSelectEpisode,
                        onEpisodeFocused = { episode ->
                            currentlyInspectedEpisode = episode
                        }
                    )
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
            val tabShape = RoundedCornerShape(8.dp)

            TvButton(
                onClick = { onSelectSeason(index) },
                shape = TvButtonDefaults.shape(
                    shape = tabShape,
                    focusedShape = tabShape
                ),
                scale = TvButtonDefaults.scale(
                    scale = 1.0f,
                    focusedScale = 1.05f
                ),
                border = TvButtonDefaults.border(
                    border = Border.None,
                    focusedBorder = Border(
                        border = BorderStroke(width = 2.dp, color = Color.White),
                        shape = tabShape
                    )
                ),
                colors = TvButtonDefaults.colors(
                    containerColor = if (isSelected) MaterialTheme.colorScheme.primary else Color(0xFF252530),
                    focusedContainerColor = if (isSelected) MaterialTheme.colorScheme.primary else Color(0xFF353545),
                    contentColor = if (isSelected) Color.White else Color.White.copy(alpha = 0.85f),
                    focusedContentColor = Color.White
                ),
                contentPadding = PaddingValues(horizontal = 20.dp, vertical = 10.dp)
            ) {
                Text(
                    text = season.title,
                    fontWeight = if (isSelected) FontWeight.Bold else FontWeight.Medium
                )
            }
        }
    }
}
