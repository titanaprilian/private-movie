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
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clipToBounds
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.input.key.onKeyEvent
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.tv.material3.Border
import androidx.tv.material3.Button as TvButton
import androidx.tv.material3.ButtonDefaults as TvButtonDefaults
import com.privatemovie.tv.components.FocusTransitionCoordinator
import com.privatemovie.tv.components.TvVerticalHeaderBringIntoViewSpec
import com.privatemovie.tv.components.isRepeatKeyEvent
import com.privatemovie.tv.components.requestFocusSafely
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
import com.privatemovie.tv.modules.detail.internal.toPlaylistEpisodeItems
import com.privatemovie.tv.modules.player.PlaybackMetadataHandoff
import com.privatemovie.tv.modules.player.PlaybackSourceRef
import com.privatemovie.tv.modules.player.PlayerNavArgs
import com.privatemovie.tv.modules.player.internal.EpisodePlaybackDecision
import com.privatemovie.tv.modules.player.internal.decideEpisodePlayback

/**
 * Public seam for the Android TV series watch/detail experience.
 *
 * Renders real public series metadata, seasons, and episodes fetched from [MediaRepository]
 * via [DetailViewModel].
 */
@Composable
fun DetailScreen(
    seriesId: String,
    mediaRepository: MediaRepository,
    onPlayEpisode: (episodeId: String, metadata: PlaybackMetadataHandoff) -> Unit,
    onBack: () -> Unit,
    modifier: Modifier = Modifier,
    activeBackendUrl: String? = null,
    onLoadedDetails: ((TvSeriesDetails) -> Unit)? = null,
    onPlaySource: ((episodeId: String, videoSource: TvVideoSource, metadata: PlaybackMetadataHandoff) -> Unit)? = null,
    onPlayNavArgs: ((PlayerNavArgs) -> Unit)? = null,
    viewModel: DetailViewModel = remember(seriesId, mediaRepository) {
        DetailViewModel(
            seriesId = seriesId,
            mediaRepository = mediaRepository,
            onLoadedDetails = onLoadedDetails
        )
    },
    playerReturnEpisodeId: String? = null,
    onPlayerReturnConsumed: (() -> Unit)? = null
) {
    val uiState by viewModel.uiState.collectAsState()
    val selectedSeasonIndex by viewModel.selectedSeasonIndex.collectAsState()
    val activeEpisodeIndex by viewModel.activeEpisodeIndex.collectAsState()
    val pendingSourcePickerEpisode by viewModel.pendingSourcePickerEpisode.collectAsState()
    val pendingReturnFocus by viewModel.pendingReturnFocus.collectAsState()

    LaunchedEffect(playerReturnEpisodeId) {
        if (playerReturnEpisodeId != null) {
            viewModel.applyPlayerReturn(playerReturnEpisodeId)
            onPlayerReturnConsumed?.invoke()
        }
    }

    val handleStartPlayback: (TvEpisode, TvVideoSource?) -> Unit = { episode, source ->
        val details = (uiState as? DetailUiState.Success)?.details
        val metadata = details?.findMetadataForEpisode(episode.id)
            ?: PlaybackMetadataHandoff(
                episodeOrder = episode.order,
                episodeTitle = episode.title
            )
        val playlist = details?.toPlaylistEpisodeItems() ?: emptyList()
        val sourceRef = source?.let { PlaybackSourceRef(type = it.type, url = it.url) }
        val playerNavArgs = PlayerNavArgs(
            episodeId = episode.id,
            source = sourceRef,
            metadata = metadata,
            playlist = playlist
        )
        if (onPlayNavArgs != null) {
            onPlayNavArgs(playerNavArgs)
        } else if (source != null && onPlaySource != null) {
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
                viewModel.openSourcePicker(episode)
            }
        }
    }

    Column(
        modifier = modifier
            .fillMaxSize()
            .background(MaterialTheme.colorScheme.background)
    ) {
        when (val state = uiState) {
            is DetailUiState.Loading -> DetailLoading(onBack = onBack)
            is DetailUiState.Error -> DetailError(
                message = state.message,
                onRetry = { viewModel.retry() },
                onBack = onBack
            )
            is DetailUiState.Success -> DetailContent(
                details = state.details,
                activeBackendUrl = activeBackendUrl,
                selectedSeasonIndex = selectedSeasonIndex,
                activeEpisodeIndex = activeEpisodeIndex,
                onSelectSeason = { viewModel.selectSeason(it) },
                onEpisodeFocusedIndex = { viewModel.setEpisodeIndex(it) },
                onSelectEpisode = handleSelectEpisode,
                onBack = onBack,
                returnFocusTarget = pendingReturnFocus,
                hasCompletedInitialFocus = viewModel.hasCompletedInitialFocus,
                onInitialFocusPerformed = { viewModel.hasCompletedInitialFocus = true },
                onReturnFocusConsumed = { viewModel.consumeReturnFocus() }
            )
        }
    }

    pendingSourcePickerEpisode?.let { episode ->
        SourcePickerDialog(
            episodeTitle = episode.title,
            sources = episode.videoSources,
            onSelectSource = { source ->
                viewModel.dismissSourcePicker()
                handleStartPlayback(episode, source)
            },
            onDismiss = {
                viewModel.dismissSourcePicker()
            }
        )
    }
}

@Composable
private fun DetailLoading(
    onBack: () -> Unit,
    modifier: Modifier = Modifier
) {
    Column(
        modifier = modifier
            .fillMaxSize()
            .padding(48.dp)
    ) {
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

    Column(
        modifier = modifier
            .fillMaxSize()
            .padding(48.dp)
    ) {
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

@OptIn(androidx.compose.foundation.ExperimentalFoundationApi::class)
@Composable
private fun DetailContent(
    details: TvSeriesDetails,
    activeBackendUrl: String?,
    selectedSeasonIndex: Int,
    activeEpisodeIndex: Int,
    onSelectSeason: (Int) -> Unit,
    onEpisodeFocusedIndex: (Int) -> Unit,
    onSelectEpisode: (TvEpisode) -> Unit,
    onBack: () -> Unit,
    modifier: Modifier = Modifier,
    returnFocusTarget: com.privatemovie.tv.modules.detail.internal.DetailReturnFocusTarget? = null,
    hasCompletedInitialFocus: Boolean = true,
    onInitialFocusPerformed: (() -> Unit)? = null,
    onReturnFocusConsumed: (() -> Unit)? = null
) {
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
    val backFocusRequester = remember { FocusRequester() }
    val seasonTabsFocusRequester = remember { FocusRequester() }
    val lazyListState = androidx.compose.foundation.lazy.rememberLazyListState()
    val coroutineScope = androidx.compose.runtime.rememberCoroutineScope()
    val focusCoordinator = remember(coroutineScope) { FocusTransitionCoordinator(coroutineScope) }

    val currentEpisodes = if (details.seasons.isNotEmpty()) {
        details.seasons.getOrNull(selectedSeasonIndex)?.episodes ?: emptyList()
    } else {
        details.standaloneEpisodes
    }

    val episodeFocusRequesters = remember(currentEpisodes) {
        List(currentEpisodes.size) { FocusRequester() }
    }

    val focusRememberedEpisode: suspend () -> Boolean = {
        val targetIndex = activeEpisodeIndex.coerceIn(0, (currentEpisodes.size - 1).coerceAtLeast(0))
        val requester = episodeFocusRequesters.getOrNull(targetIndex)
            ?: episodeFocusRequesters.firstOrNull()
        if (requester != null) {
            lazyListState.animateScrollToItem(if (details.seasons.size > 1) 2 else 1)
            requestFocusSafely(requester)
        } else {
            false
        }
    }

    LaunchedEffect(details.id) {
        if (returnFocusTarget != null) {
            // Returning from the player: focus the active episode card directly
            // instead of resetting to the hero banner. Scroll position is restored
            // to the carousel, not the top.
            focusRememberedEpisode()
            onReturnFocusConsumed?.invoke()
        } else if (!hasCompletedInitialFocus) {
            requestFocusSafely(playCtaFocusRequester)
            lazyListState.scrollToItem(0, 0)
            onInitialFocusPerformed?.invoke()
        } else {
            // Re-entering an already-visited detail screen (e.g. back from player
            // without a return payload): restore the remembered episode focus
            // rather than jumping back to the hero banner.
            focusRememberedEpisode()
        }
    }

    @OptIn(androidx.compose.foundation.ExperimentalFoundationApi::class)
    val verticalHeaderBringIntoViewSpec = remember(lazyListState) {
        TvVerticalHeaderBringIntoViewSpec(lazyListState)
    }

    @OptIn(androidx.compose.foundation.ExperimentalFoundationApi::class)
    androidx.compose.runtime.CompositionLocalProvider(
        androidx.compose.foundation.gestures.LocalBringIntoViewSpec provides verticalHeaderBringIntoViewSpec
    ) {
        LazyColumn(
            state = lazyListState,
            modifier = modifier.fillMaxSize(),
            verticalArrangement = Arrangement.spacedBy(24.dp),
            contentPadding = PaddingValues(bottom = 40.dp)
        ) {
            item(key = "header") {
                SeriesHeader(
                    details = details,
                    baseUrl = activeBackendUrl,
                    firstPlayableEpisode = firstEpisode,
                    playCtaFocusRequester = playCtaFocusRequester,
                    backFocusRequester = backFocusRequester,
                    onPlayCta = {
                        firstEpisode?.let { onSelectEpisode(it) }
                    },
                    onBack = onBack,
                    onDownFromCta = {
                        focusCoordinator.tryRequestFocus {
                            if (details.seasons.size > 1) {
                                lazyListState.animateScrollToItem(1)
                                requestFocusSafely(seasonTabsFocusRequester)
                            } else if (currentEpisodes.isNotEmpty()) {
                                focusRememberedEpisode()
                            } else {
                                false
                            }
                        }
                    },
                    modifier = Modifier
                        .fillParentMaxHeight()
                        .clipToBounds()
                )
            }

            if (details.seasons.size > 1) {
                item(key = "seasons-bar") {
                    SeasonSelectorBar(
                        seasons = details.seasons,
                        selectedIndex = selectedSeasonIndex,
                        onSelectSeason = { index ->
                            onSelectSeason(index)
                            val nextSeasonEp = details.seasons.getOrNull(index)?.episodes?.firstOrNull()
                            currentlyInspectedEpisode = nextSeasonEp
                        },
                        firstTabFocusRequester = seasonTabsFocusRequester,
                        onUp = {
                            focusCoordinator.tryRequestFocus {
                                lazyListState.animateScrollToItem(0)
                                requestFocusSafely(playCtaFocusRequester)
                            }
                        },
                        onDown = if (currentEpisodes.isNotEmpty()) {
                            {
                                focusCoordinator.tryRequestFocus {
                                    focusRememberedEpisode()
                                }
                            }
                        } else null
                    )
                }
            }

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
                        modifier = Modifier.padding(start = 48.dp, end = 48.dp, bottom = 8.dp)
                    )

                    if (currentEpisodes.isEmpty()) {
                        Text(
                            text = "No episodes available for this section.",
                            style = MaterialTheme.typography.bodyMedium,
                            color = Color.Gray,
                            modifier = Modifier.padding(horizontal = 48.dp, vertical = 16.dp)
                        )
                    } else {
                        EpisodeCarousel(
                            episodes = currentEpisodes,
                            baseUrl = activeBackendUrl,
                            onSelectEpisode = onSelectEpisode,
                            onEpisodeFocused = { episode, index ->
                                currentlyInspectedEpisode = episode
                                onEpisodeFocusedIndex(index)
                            },
                            itemFocusRequesters = episodeFocusRequesters,
                            onUp = if (details.seasons.size <= 1) {
                                {
                                    focusCoordinator.tryRequestFocus {
                                        lazyListState.animateScrollToItem(0)
                                        requestFocusSafely(playCtaFocusRequester)
                                    }
                                }
                            } else null
                        )
                    }
                }
            }

            item(key = "bottom-description-panel") {
                Box(modifier = Modifier.padding(horizontal = 48.dp)) {
                    EpisodeInfoPanel(
                        episode = currentlyInspectedEpisode,
                        focusRequester = remember { FocusRequester() }
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
    modifier: Modifier = Modifier,
    firstTabFocusRequester: FocusRequester? = null,
    onUp: (() -> Unit)? = null,
    onDown: (() -> Unit)? = null
) {
    LazyRow(
        modifier = modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.spacedBy(12.dp),
        contentPadding = PaddingValues(horizontal = 48.dp)
    ) {
        itemsIndexed(seasons) { index, season ->
            val isSelected = index == selectedIndex
            val tabShape = RoundedCornerShape(8.dp)

            TvButton(
                onClick = { onSelectSeason(index) },
                modifier = Modifier
                    .then(
                        if (index == 0 && firstTabFocusRequester != null) {
                            Modifier.focusRequester(firstTabFocusRequester)
                        } else Modifier
                    )
                    .then(
                        if (onUp != null || onDown != null) {
                            Modifier.onKeyEvent { keyEvent ->
                                if (isRepeatKeyEvent(keyEvent)) {
                                    return@onKeyEvent true
                                }
                                when {
                                    onUp != null &&
                                        keyEvent.nativeKeyEvent.action == android.view.KeyEvent.ACTION_DOWN &&
                                        keyEvent.nativeKeyEvent.keyCode == android.view.KeyEvent.KEYCODE_DPAD_UP -> {
                                        onUp()
                                        true
                                    }
                                    onDown != null &&
                                        keyEvent.nativeKeyEvent.action == android.view.KeyEvent.ACTION_DOWN &&
                                        keyEvent.nativeKeyEvent.keyCode == android.view.KeyEvent.KEYCODE_DPAD_DOWN -> {
                                        onDown()
                                        true
                                    }
                                    else -> false
                                }
                            }
                        } else Modifier
                    ),
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
