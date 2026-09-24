package com.privatemovie.tv.modules.player

import android.app.Activity
import android.view.KeyEvent as AndroidKeyEvent
import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.slideInVertically
import androidx.compose.animation.slideOutVertically
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.focusable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableLongStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Shape
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.input.key.KeyEvent
import androidx.compose.ui.input.key.KeyEventType
import androidx.compose.ui.input.key.key
import androidx.compose.ui.input.key.nativeKeyCode
import androidx.compose.ui.input.key.onKeyEvent
import androidx.compose.ui.input.key.onPreviewKeyEvent
import androidx.compose.ui.input.key.type
import androidx.compose.ui.platform.LocalView
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.core.view.WindowCompat
import androidx.core.view.WindowInsetsCompat
import androidx.core.view.WindowInsetsControllerCompat
import androidx.media3.exoplayer.ExoPlayer
import androidx.tv.material3.Border
import androidx.tv.material3.Button as TvButton
import androidx.tv.material3.ButtonDefaults as TvButtonDefaults
import com.privatemovie.tv.components.MediaPlaceholderIcons
import com.privatemovie.tv.components.requestFocusSafely
import com.privatemovie.tv.modules.player.DEFAULT_CONTROLS_TIMEOUT_MS
import com.privatemovie.tv.modules.player.DEFAULT_EXIT_CONFIRM_TIMEOUT_MS
import com.privatemovie.tv.modules.player.PlaybackCompletionDecision
import com.privatemovie.tv.modules.player.PlaybackMetadataHandoff
import com.privatemovie.tv.modules.player.PlaybackSourceRef
import com.privatemovie.tv.modules.player.PlayerControlAction
import com.privatemovie.tv.modules.player.internal.PlaybackRenderer
import com.privatemovie.tv.modules.player.internal.PlayerExitGuard
import com.privatemovie.tv.modules.player.internal.PlayerFocusTarget
import com.privatemovie.tv.modules.player.internal.RemoteControlKey
import com.privatemovie.tv.modules.player.internal.VideoProgressBar
import com.privatemovie.tv.modules.player.internal.resolvePlayerFocusTarget
import com.privatemovie.tv.modules.player.internal.buildPlayerHandoff
import com.privatemovie.tv.modules.player.internal.calculateClampedSeekPosition
import com.privatemovie.tv.modules.player.internal.formatPlayerHeadline
import com.privatemovie.tv.modules.player.internal.formatPlayerSubtitle
import com.privatemovie.tv.modules.player.internal.handleRemoteKey
import com.privatemovie.tv.modules.player.internal.onPlaybackEnded
import com.privatemovie.tv.modules.player.internal.resolvePlayerHandoff
import com.privatemovie.tv.modules.player.internal.shouldAutoFullscreenOnEntry
import kotlinx.coroutines.delay

/**
 * Public seam for the dedicated Android TV player experience.
 *
 * Exclusively uses native Media3 ExoPlayer for playback. Controls navigation,
 * fullscreen behavior, playlist episode transitions, and TV remote key mappings.
 */
@Composable
fun PlayerScreen(
    episodeId: String,
    onExitPlayer: () -> Unit,
    modifier: Modifier = Modifier,
    hasPrevious: Boolean = false,
    hasNext: Boolean = false,
    onPlayPreviousEpisode: (() -> Unit)? = null,
    onPlayNextEpisode: (() -> Unit)? = null,
    playbackSourceTypeName: String? = null,
    playbackUrl: String? = null,
    seriesTitle: String? = null,
    seasonTitle: String? = null,
    seasonNumber: Int? = null,
    episodeOrder: Int? = null,
    episodeTitle: String? = null,
    backendBaseUrl: String? = null,
    playerNavArgs: PlayerNavArgs? = null,
    onPlayNavArgs: ((PlayerNavArgs) -> Unit)? = null
) {
    val effectiveSeriesTitle = playerNavArgs?.metadata?.seriesTitle ?: seriesTitle
    val effectiveSeasonTitle = playerNavArgs?.metadata?.seasonTitle ?: seasonTitle
    val effectiveSeasonNumber = playerNavArgs?.metadata?.seasonNumber ?: seasonNumber
    val effectiveEpisodeOrder = playerNavArgs?.metadata?.episodeOrder ?: episodeOrder
    val effectiveEpisodeTitle = playerNavArgs?.metadata?.episodeTitle ?: episodeTitle

    val headlineText = remember(effectiveSeriesTitle) { formatPlayerHeadline(effectiveSeriesTitle) }
    val subtitleText = remember(effectiveSeasonNumber, effectiveSeasonTitle, effectiveEpisodeOrder, effectiveEpisodeTitle) {
        formatPlayerSubtitle(
            seasonNumber = effectiveSeasonNumber,
            seasonTitle = effectiveSeasonTitle,
            episodeOrder = effectiveEpisodeOrder,
            episodeTitle = effectiveEpisodeTitle
        )
    }

    val handoffTarget = remember(playerNavArgs, playbackSourceTypeName, playbackUrl, episodeId) {
        val source = if (playerNavArgs?.source != null) {
            playerNavArgs.source
        } else if (!playbackUrl.isNullOrBlank() && !playbackSourceTypeName.isNullOrBlank()) {
            PlaybackSourceRef(type = playbackSourceTypeName, url = playbackUrl)
        } else if (!playbackUrl.isNullOrBlank()) {
            PlaybackSourceRef(type = "", url = playbackUrl)
        } else {
            null
        }
        resolvePlayerHandoff(
            handoff = buildPlayerHandoff(
                episodeId = playerNavArgs?.episodeId ?: episodeId,
                source = source,
                seriesTitle = effectiveSeriesTitle,
                seasonTitle = effectiveSeasonTitle,
                seasonNumber = effectiveSeasonNumber,
                episodeOrder = effectiveEpisodeOrder,
                episodeTitle = effectiveEpisodeTitle
            ),
            backendBaseUrl = backendBaseUrl
        )
    }
    val renderer: PlaybackRenderer = handoffTarget.renderer
    val resolvedUrl = handoffTarget.resolvedUrl
    val handoffFailure: String? = handoffTarget.failureMessage

    var isPlaying by remember { mutableStateOf(true) }
    var statusText by remember { mutableStateOf("Playing") }
    var isLoading by remember { mutableStateOf(true) }
    var errorMessage by remember { mutableStateOf<String?>(null) }
    var exoPlayer by remember { mutableStateOf<ExoPlayer?>(null) }

    var currentPositionMs by remember { mutableLongStateOf(0L) }
    var durationMs by remember { mutableLongStateOf(0L) }
    var bufferedPositionMs by remember { mutableLongStateOf(0L) }

    // Auto-hiding transport overlay state
    var controlsVisible by remember { mutableStateOf(true) }
    var userActivityNonce by remember { mutableLongStateOf(0L) }

    // Double-Back exit confirmation state (only armed while controls are hidden)
    var exitConfirmationVisible by remember { mutableStateOf(false) }
    var exitConfirmNonce by remember { mutableLongStateOf(0L) }

    // Exit guard: once exit is initiated, failure UI is suppressed so stale
    // route args / teardown callbacks during the pop transition cannot flash
    // "Playback unavailable", and onExitPlayer fires exactly once.
    val exitGuard = remember { PlayerExitGuard() }
    var isExiting by remember { mutableStateOf(false) }

    fun requestExit() {
        if (exitGuard.tryExit()) {
            isExiting = true
            onExitPlayer()
        }
    }

    val view = LocalView.current
    val playerFocus = remember { FocusRequester() }
    val playPauseFocus = remember { FocusRequester() }

    // Position polling loop when playing
    LaunchedEffect(exoPlayer, isPlaying) {
        val player = exoPlayer ?: return@LaunchedEffect
        while (true) {
            currentPositionMs = player.currentPosition
            durationMs = player.duration.coerceAtLeast(0L)
            bufferedPositionMs = player.bufferedPosition
            isPlaying = player.isPlaying
            delay(500L)
        }
    }

    // Auto-hide controls overlay after 3.5 seconds of inactivity while playing
    LaunchedEffect(controlsVisible, userActivityNonce, isPlaying) {
        if (controlsVisible && isPlaying) {
            delay(DEFAULT_CONTROLS_TIMEOUT_MS)
            controlsVisible = false
        }
    }

    // Auto-dismiss the exit confirmation prompt after the timeout window elapses
    LaunchedEffect(exitConfirmationVisible, exitConfirmNonce) {
        if (exitConfirmationVisible) {
            delay(DEFAULT_EXIT_CONFIRM_TIMEOUT_MS)
            exitConfirmationVisible = false
        }
    }

    // Focus placement & restoration: Play/Pause owns focus while the overlay is
    // visible (including during loading/buffering); the player container takes
    // over when controls auto-hide so remote keys keep being intercepted.
    // Resilient retries guard against dropped requests during composition.
    LaunchedEffect(controlsVisible) {
        when (resolvePlayerFocusTarget(controlsVisible)) {
            PlayerFocusTarget.PLAY_PAUSE_BUTTON -> requestFocusSafely(playPauseFocus)
            PlayerFocusTarget.PLAYER_CONTAINER -> requestFocusSafely(playerFocus)
        }
    }

    fun attemptFullscreen() {
        try {
            val window = (view.context as? Activity)?.window ?: return
            WindowCompat.setDecorFitsSystemWindows(window, false)
            WindowInsetsControllerCompat(window, view).let { controller ->
                controller.hide(WindowInsetsCompat.Type.systemBars())
                controller.systemBarsBehavior =
                    WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE
            }
        } catch (_: Exception) {
            // Best-effort: TV launcher variations must not crash playback.
        }
    }

    fun toggleNativePlayback() {
        exoPlayer?.let { player ->
            player.playWhenReady = !player.playWhenReady
            isPlaying = player.playWhenReady
            statusText = if (isPlaying) "Playing" else "Paused"
        }
    }

    fun seekNative(seconds: Int) {
        exoPlayer?.let { player ->
            val cur = player.currentPosition
            val dur = player.duration.coerceAtLeast(0L)
            val target = calculateClampedSeekPosition(cur, seconds, dur)
            player.seekTo(target)
            currentPositionMs = target
            statusText = if (seconds < 0) "Seeking ${seconds}s" else "Seeking +${seconds}s"
        }
    }

    fun applyAction(action: PlayerControlAction) {
        when (action) {
            is PlayerControlAction.TogglePlayPause -> {
                controlsVisible = true
                exitConfirmationVisible = false
                userActivityNonce++
                toggleNativePlayback()
            }
            is PlayerControlAction.ExitPlayer -> requestExit()
            is PlayerControlAction.HideControls -> {
                controlsVisible = false
            }
            is PlayerControlAction.ShowExitConfirmation -> {
                exitConfirmationVisible = true
                exitConfirmNonce++
            }
            is PlayerControlAction.DismissExitConfirmation -> {
                exitConfirmationVisible = false
            }
            is PlayerControlAction.SeekBackward -> {
                controlsVisible = true
                exitConfirmationVisible = false
                userActivityNonce++
                seekNative(-action.seconds)
            }
            is PlayerControlAction.SeekForward -> {
                controlsVisible = true
                exitConfirmationVisible = false
                userActivityNonce++
                seekNative(action.seconds)
            }
            is PlayerControlAction.RequestFullscreen -> attemptFullscreen()
            is PlayerControlAction.ShowControls -> {
                controlsVisible = true
                exitConfirmationVisible = false
                userActivityNonce++
            }
        }
    }

    fun onRemoteKey(key: RemoteControlKey): Boolean {
        val action = handleRemoteKey(
            key,
            renderer,
            controlsVisible = controlsVisible,
            exitConfirmationActive = exitConfirmationVisible
        )
        applyAction(action)
        return true
    }

    fun mapKeyEvent(event: KeyEvent): RemoteControlKey? {
        if (event.type != KeyEventType.KeyUp) return null
        return when (event.key.nativeKeyCode) {
            AndroidKeyEvent.KEYCODE_DPAD_CENTER,
            AndroidKeyEvent.KEYCODE_ENTER,
            AndroidKeyEvent.KEYCODE_NUMPAD_ENTER -> RemoteControlKey.CENTER_OK
            AndroidKeyEvent.KEYCODE_BACK,
            AndroidKeyEvent.KEYCODE_ESCAPE -> RemoteControlKey.BACK
            AndroidKeyEvent.KEYCODE_DPAD_LEFT -> RemoteControlKey.LEFT
            AndroidKeyEvent.KEYCODE_DPAD_RIGHT -> RemoteControlKey.RIGHT
            AndroidKeyEvent.KEYCODE_DPAD_UP -> RemoteControlKey.UP
            AndroidKeyEvent.KEYCODE_DPAD_DOWN -> RemoteControlKey.DOWN
            AndroidKeyEvent.KEYCODE_MEDIA_PLAY_PAUSE,
            AndroidKeyEvent.KEYCODE_MEDIA_PLAY,
            AndroidKeyEvent.KEYCODE_MEDIA_PAUSE -> RemoteControlKey.PLAY_PAUSE
            AndroidKeyEvent.KEYCODE_MEDIA_FAST_FORWARD -> RemoteControlKey.FAST_FORWARD
            AndroidKeyEvent.KEYCODE_MEDIA_REWIND -> RemoteControlKey.REWIND
            else -> null
        }
    }

    // Auto-attempt fullscreen on entry: TV-only dedicated playback flow.
    // Play/Pause acquires initial focus right away with safe retries so the
    // request survives layout attachment races, even while still loading.
    LaunchedEffect(Unit) {
        if (shouldAutoFullscreenOnEntry()) attemptFullscreen()
        requestFocusSafely(playPauseFocus)
    }

    Box(
        modifier = modifier
            .fillMaxSize()
            .background(Color.Black)
            .focusRequester(playerFocus)
            .focusable()
            .onPreviewKeyEvent { event ->
                val key = mapKeyEvent(event) ?: return@onPreviewKeyEvent false
                when (key) {
                    RemoteControlKey.BACK -> {
                        onRemoteKey(key)
                        true
                    }
                    RemoteControlKey.PLAY_PAUSE,
                    RemoteControlKey.FAST_FORWARD,
                    RemoteControlKey.REWIND -> {
                        onRemoteKey(key)
                        true
                    }
                    else -> {
                        if (!controlsVisible) {
                            onRemoteKey(key)
                            true
                        } else {
                            userActivityNonce++
                            false
                        }
                    }
                }
            },
        contentAlignment = Alignment.Center
    ) {
        val combinedFailure: String? = handoffFailure ?: errorMessage
        if (resolvedUrl != null) {
            NativePlayerView(
                streamUrl = resolvedUrl,
                onPlayerReady = { player -> exoPlayer = player },
                onFirstFrame = {
                    isLoading = false
                    isPlaying = true
                },
                onError = { message ->
                    isLoading = false
                    errorMessage = message
                },
                onPlaybackEnded = {
                    val computedDecision = onPlaybackEnded(hasNext = (hasPrevious || hasNext) || (playerNavArgs?.playlist?.isNotEmpty() == true && hasNext) || (onPlayNextEpisode != null))
                    when (computedDecision) {
                        PlaybackCompletionDecision.AdvanceToNext -> onPlayNextEpisode?.invoke()
                        PlaybackCompletionDecision.ExitPlayer -> requestExit()
                    }
                },
                modifier = Modifier.fillMaxSize()
            )
        } else if (!isExiting) {
            PlayerFailure(
                message = handoffFailure ?: "No playable source for this episode",
                onExitPlayer = { requestExit() }
            )
        }

        if (isLoading && combinedFailure == null && resolvedUrl != null) {
            Column(horizontalAlignment = Alignment.CenterHorizontally) {
                CircularProgressIndicator(color = MaterialTheme.colorScheme.primary)
                Spacer(modifier = Modifier.height(16.dp))
                Text(
                    text = "Loading playback…",
                    style = MaterialTheme.typography.titleMedium,
                    color = Color.White
                )
            }
        }

        errorMessage?.let { message ->
            if (handoffFailure == null && !isExiting) {
                PlayerFailure(
                    message = message,
                    onExitPlayer = { requestExit() }
                )
            }
        }

        // Overlay Transport Controls for TV D-Pad navigation.
        if (combinedFailure == null) {
            Column(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(24.dp),
                verticalArrangement = Arrangement.SpaceBetween
            ) {
                // Top Bar: Clean headline & subtitle without intrusive on-screen Exit button
                AnimatedVisibility(
                    visible = controlsVisible,
                    enter = fadeIn() + slideInVertically(initialOffsetY = { -it }),
                    exit = fadeOut() + slideOutVertically(targetOffsetY = { -it })
                ) {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.Start,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Column {
                            Text(
                                text = headlineText,
                                style = MaterialTheme.typography.titleLarge.copy(fontWeight = FontWeight.Bold),
                                color = Color.White
                            )
                            if (subtitleText.isNotBlank()) {
                                Text(
                                    text = subtitleText,
                                    style = MaterialTheme.typography.bodyMedium,
                                    color = Color.White.copy(alpha = 0.9f)
                                )
                            }
                            Text(
                                text = statusText,
                                style = MaterialTheme.typography.bodySmall,
                                color = Color.LightGray
                            )
                        }
                    }
                }

                if (!controlsVisible) {
                    Spacer(modifier = Modifier.weight(1f))
                }

                // Bottom Transport Control Bar & Progress Scrubber
                AnimatedVisibility(
                    visible = controlsVisible,
                    enter = fadeIn() + slideInVertically(initialOffsetY = { it }),
                    exit = fadeOut() + slideOutVertically(targetOffsetY = { it })
                ) {
                    Column(
                        modifier = Modifier
                            .fillMaxWidth()
                            .background(Color(0xAA000000), shape = RoundedCornerShape(16.dp))
                            .padding(horizontal = 24.dp, vertical = 16.dp),
                        horizontalAlignment = Alignment.CenterHorizontally
                    ) {
                        VideoProgressBar(
                            positionMs = currentPositionMs,
                            durationMs = durationMs,
                            bufferedPositionMs = bufferedPositionMs,
                            onSeek = { seconds -> applyAction(if (seconds < 0) PlayerControlAction.SeekBackward(-seconds) else PlayerControlAction.SeekForward(seconds)) },
                            onTogglePlayPause = { applyAction(PlayerControlAction.TogglePlayPause) },
                            modifier = Modifier.fillMaxWidth()
                        )

                        Spacer(modifier = Modifier.height(12.dp))

                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.Center,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            // Previous Episode button
                            TvPlayerIconButton(
                                icon = MediaPlaceholderIcons.SkipPrevious,
                                contentDescription = "Previous Episode",
                                enabled = hasPrevious && onPlayPreviousEpisode != null,
                                onClick = {
                                    userActivityNonce++
                                    onPlayPreviousEpisode?.invoke()
                                },
                                size = 48.dp
                            )

                            Spacer(modifier = Modifier.width(24.dp))

                            // Play/Pause button (prominent center)
                            TvPlayerIconButton(
                                icon = if (isPlaying) MediaPlaceholderIcons.Pause else MediaPlaceholderIcons.Play,
                                contentDescription = if (isPlaying) "Pause" else "Play",
                                enabled = true,
                                onClick = { applyAction(PlayerControlAction.TogglePlayPause) },
                                modifier = Modifier.focusRequester(playPauseFocus),
                                size = 56.dp,
                                iconSize = 32.dp
                            )

                            Spacer(modifier = Modifier.width(24.dp))

                            // Next Episode button
                            TvPlayerIconButton(
                                icon = MediaPlaceholderIcons.SkipNext,
                                contentDescription = "Next Episode",
                                enabled = hasNext && onPlayNextEpisode != null,
                                onClick = {
                                    userActivityNonce++
                                    onPlayNextEpisode?.invoke()
                                },
                                size = 48.dp
                            )
                        }
                    }
                }
            }
        }

        // Double-Back exit confirmation floating pill (bottom-center, non-focusable).
        if (combinedFailure == null) {
            Box(
                modifier = Modifier.fillMaxSize(),
                contentAlignment = Alignment.BottomCenter
            ) {
                AnimatedVisibility(
                    visible = exitConfirmationVisible && !controlsVisible,
                    enter = fadeIn(),
                    exit = fadeOut()
                ) {
                    ExitConfirmationPill()
                }
            }
        }
    }
}

/**
 * High-contrast floating pill prompting a second Back press to exit.
 * Deliberately non-focusable so D-pad navigation stays on transport controls.
 */
@Composable
private fun ExitConfirmationPill(modifier: Modifier = Modifier) {
    val pillShape = RoundedCornerShape(24.dp)
    Box(
        modifier = modifier
            .padding(bottom = 48.dp)
            .border(
                width = 2.dp,
                color = Color.White,
                shape = pillShape
            )
            .background(
                color = Color(0xFF000000),
                shape = pillShape
            )
            .padding(horizontal = 24.dp, vertical = 12.dp),
        contentAlignment = Alignment.Center
    ) {
        Text(
            text = "Press back again to exit",
            style = MaterialTheme.typography.bodyMedium.copy(fontWeight = FontWeight.Bold),
            color = Color.White
        )
    }
}

/**
 * TV-aware media control icon button with scale effect and high-contrast focus border ring.
 */
@Composable
private fun TvPlayerIconButton(
    icon: ImageVector,
    contentDescription: String,
    enabled: Boolean,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    size: androidx.compose.ui.unit.Dp = 48.dp,
    iconSize: androidx.compose.ui.unit.Dp = 24.dp,
    shape: Shape = CircleShape
) {
    Box(
        modifier = if (!enabled) modifier.alpha(0.4f) else modifier
    ) {
        TvButton(
            onClick = onClick,
            enabled = enabled,
            modifier = Modifier.size(size),
            shape = TvButtonDefaults.shape(
                shape = shape,
                focusedShape = shape
            ),
            scale = TvButtonDefaults.scale(
                scale = 1.0f,
                focusedScale = 1.15f
            ),
            border = TvButtonDefaults.border(
                border = Border.None,
                focusedBorder = Border(
                    border = BorderStroke(width = 2.dp, color = Color.White),
                    shape = shape
                )
            ),
            colors = TvButtonDefaults.colors(
                containerColor = Color(0xFF2C2C2C),
                focusedContainerColor = MaterialTheme.colorScheme.primary,
                contentColor = Color.White,
                focusedContentColor = MaterialTheme.colorScheme.onPrimary,
                disabledContainerColor = Color(0xFF1E1E1E),
                disabledContentColor = Color.Gray
            )
        ) {
            Box(
                modifier = Modifier.fillMaxSize(),
                contentAlignment = Alignment.Center
            ) {
                Icon(
                    imageVector = icon,
                    contentDescription = contentDescription,
                    modifier = Modifier.size(iconSize),
                    tint = Color.White
                )
            }
        }
    }
}

/**
 * TV-aware button for player transport controls and failure actions.
 */
@Composable
private fun TvPlayerButton(
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    content: @Composable () -> Unit
) {
    val buttonShape = RoundedCornerShape(8.dp)
    TvButton(
        onClick = onClick,
        modifier = modifier,
        shape = TvButtonDefaults.shape(
            shape = buttonShape,
            focusedShape = buttonShape
        ),
        scale = TvButtonDefaults.scale(
            scale = 1.0f,
            focusedScale = 1.1f
        ),
        border = TvButtonDefaults.border(
            border = Border.None,
            focusedBorder = Border(
                border = BorderStroke(width = 2.dp, color = Color.White),
                shape = buttonShape
            )
        ),
        colors = TvButtonDefaults.colors(
            containerColor = Color(0xFF2C2C2C),
            focusedContainerColor = MaterialTheme.colorScheme.primary,
            contentColor = Color.White,
            focusedContentColor = MaterialTheme.colorScheme.onPrimary
        )
    ) {
        content()
    }
}

@Composable
private fun PlayerFailure(
    message: String,
    onExitPlayer: () -> Unit,
    modifier: Modifier = Modifier
) {
    Box(
        modifier = modifier
            .fillMaxSize()
            .background(Color.Black),
        contentAlignment = Alignment.Center
    ) {
        Column(horizontalAlignment = Alignment.CenterHorizontally) {
            Text(
                text = "Playback unavailable",
                style = MaterialTheme.typography.titleLarge,
                color = Color.White
            )
            Spacer(modifier = Modifier.height(8.dp))
            Text(
                text = message,
                style = MaterialTheme.typography.bodyMedium,
                color = Color.LightGray
            )
            Spacer(modifier = Modifier.height(24.dp))
            TvPlayerButton(onClick = onExitPlayer) {
                Text("Exit Player (Back)")
            }
        }
    }
}

