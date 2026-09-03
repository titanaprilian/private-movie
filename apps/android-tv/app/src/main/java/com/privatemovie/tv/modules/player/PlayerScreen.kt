package com.privatemovie.tv.modules.player

import android.app.Activity
import android.webkit.WebView
import android.view.KeyEvent as AndroidKeyEvent
import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.slideInVertically
import androidx.compose.animation.slideOutVertically
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
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
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.CircularProgressIndicator
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
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.input.key.KeyEvent
import androidx.compose.ui.input.key.KeyEventType
import androidx.compose.ui.input.key.key
import androidx.compose.ui.input.key.nativeKeyCode
import androidx.compose.ui.input.key.onKeyEvent
import androidx.compose.ui.input.key.onPreviewKeyEvent
import androidx.compose.ui.input.key.type
import androidx.compose.ui.platform.LocalView
import androidx.compose.ui.unit.dp
import androidx.core.view.WindowCompat
import androidx.core.view.WindowInsetsCompat
import androidx.core.view.WindowInsetsControllerCompat
import androidx.media3.exoplayer.ExoPlayer
import androidx.tv.material3.Border
import androidx.tv.material3.Button as TvButton
import androidx.tv.material3.ButtonDefaults as TvButtonDefaults
import com.privatemovie.tv.modules.player.internal.DEFAULT_CONTROLS_TIMEOUT_MS
import com.privatemovie.tv.modules.player.internal.PlaybackRenderer
import com.privatemovie.tv.modules.player.internal.PlayerControlAction
import com.privatemovie.tv.modules.player.internal.RemoteControlKey
import com.privatemovie.tv.modules.player.internal.buildPlayerHandoff
import com.privatemovie.tv.modules.player.internal.PlaybackSourceRef
import com.privatemovie.tv.modules.player.internal.handleRemoteKey
import com.privatemovie.tv.modules.player.internal.resolvePlayerHandoff
import com.privatemovie.tv.modules.player.internal.shouldAutoFullscreenOnEntry
import kotlinx.coroutines.delay

/**
 * Public seam for the dedicated Android TV player experience.
 *
 * Separate from the watch/detail screen: owns fullscreen behavior, renderer
 * selection (native Media3 surface vs WebView shell), and the MVP
 * remote-control contract at the app boundary. Control-intent decisions live
 * in `modules/player/internal/PlayerShell.kt` so they stay unit-testable
 * without third-party embed DOM details.
 */
@Composable
fun PlayerScreen(
    episodeId: String,
    onExitPlayer: () -> Unit,
    modifier: Modifier = Modifier,
    playbackSourceTypeName: String? = null,
    playbackUrl: String? = null,
    backendBaseUrl: String? = null
) {
    // End-to-end handoff resolution: the source picker (or direct play) hands
    // a normalized playback target (type + url) to the player, which resolves
    // the renderer and loadable URL or a clear failure for unavailable sources.
    val handoffTarget = remember(playbackSourceTypeName, playbackUrl, episodeId) {
        val source = if (!playbackUrl.isNullOrBlank() && !playbackSourceTypeName.isNullOrBlank()) {
            PlaybackSourceRef(type = playbackSourceTypeName, url = playbackUrl)
        } else if (!playbackUrl.isNullOrBlank()) {
            // Type missing (e.g. legacy handoff): keep the URL, fall back to
            // the WebView shell via renderer resolution.
            PlaybackSourceRef(type = "", url = playbackUrl)
        } else {
            null
        }
        resolvePlayerHandoff(
            handoff = buildPlayerHandoff(episodeId = episodeId, source = source),
            backendBaseUrl = backendBaseUrl
        )
    }
    val renderer: PlaybackRenderer = handoffTarget.renderer
    val resolvedUrl = handoffTarget.resolvedUrl
    val handoffFailure: String? = handoffTarget.failureMessage

    var isPlaying by remember { mutableStateOf(true) }
    var statusText by remember { mutableStateOf("Playing Episode $episodeId") }
    var isLoading by remember { mutableStateOf(true) }
    var errorMessage by remember { mutableStateOf<String?>(null) }
    var exoPlayer by remember { mutableStateOf<ExoPlayer?>(null) }
    var embedWebView by remember { mutableStateOf<WebView?>(null) }

    // Auto-hiding transport overlay state
    var controlsVisible by remember { mutableStateOf(true) }
    var userActivityNonce by remember { mutableLongStateOf(0L) }

    val view = LocalView.current
    val playerFocus = remember { FocusRequester() }
    val playPauseFocus = remember { FocusRequester() }

    // Auto-hide controls overlay after 3 seconds of inactivity
    LaunchedEffect(controlsVisible, userActivityNonce) {
        if (controlsVisible) {
            delay(DEFAULT_CONTROLS_TIMEOUT_MS)
            controlsVisible = false
        }
    }

    // Programmatically focus Play/Pause button when overlay becomes visible
    LaunchedEffect(controlsVisible) {
        if (controlsVisible) {
            try {
                playPauseFocus.requestFocus()
            } catch (_: Exception) {
                // Best-effort in case view isn't yet attached
            }
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
            // Best-effort: TV launcher / embed variations must not crash playback.
        }
    }

    fun toggleNativePlayback() {
        exoPlayer?.let { player ->
            player.playWhenReady = !player.playWhenReady
            isPlaying = player.playWhenReady
            statusText = if (isPlaying) "Playing Episode $episodeId" else "Paused"
        }
    }

    fun seekNative(seconds: Int) {
        exoPlayer?.let { player ->
            val target = (player.currentPosition + seconds * 1000L).coerceAtLeast(0L)
            player.seekTo(target)
            statusText = if (seconds < 0) "Seeking ${seconds}s" else "Seeking +${seconds}s"
        }
    }

    fun applyAction(action: PlayerControlAction) {
        when (action) {
            is PlayerControlAction.TogglePlayPause -> {
                controlsVisible = true
                userActivityNonce++
                when (renderer) {
                    PlaybackRenderer.NATIVE -> toggleNativePlayback()
                    PlaybackRenderer.WEBVIEW -> {
                        embedWebView?.toggleHtml5Video()
                        isPlaying = !isPlaying
                        statusText = if (isPlaying) "Playing Episode $episodeId" else "Paused"
                    }
                }
            }
            is PlayerControlAction.ExitPlayer -> onExitPlayer()
            is PlayerControlAction.SeekBackward -> {
                controlsVisible = true
                userActivityNonce++
                when (renderer) {
                    PlaybackRenderer.NATIVE -> seekNative(-action.seconds)
                    PlaybackRenderer.WEBVIEW -> {
                        embedWebView?.sendDpadKey(AndroidKeyEvent.KEYCODE_DPAD_LEFT)
                        statusText = "Seeking -${action.seconds}s"
                    }
                }
            }
            is PlayerControlAction.SeekForward -> {
                controlsVisible = true
                userActivityNonce++
                when (renderer) {
                    PlaybackRenderer.NATIVE -> seekNative(action.seconds)
                    PlaybackRenderer.WEBVIEW -> {
                        embedWebView?.sendDpadKey(AndroidKeyEvent.KEYCODE_DPAD_RIGHT)
                        statusText = "Seeking +${action.seconds}s"
                    }
                }
            }
            is PlayerControlAction.RequestFullscreen -> attemptFullscreen()
            is PlayerControlAction.ShowControls -> {
                controlsVisible = true
                userActivityNonce++
            }
        }
    }

    fun onRemoteKey(key: RemoteControlKey): Boolean {
        val action = handleRemoteKey(key, renderer, controlsVisible = controlsVisible)
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
            else -> null
        }
    }

    // Auto-attempt fullscreen on entry: TV-only dedicated playback flow.
    LaunchedEffect(Unit) {
        playerFocus.requestFocus()
        if (shouldAutoFullscreenOnEntry()) attemptFullscreen()
    }

    Box(
        modifier = modifier
            .fillMaxSize()
            .background(Color.Black)
            .focusRequester(playerFocus)
            .focusable()
            // Capture phase: back always exits and media keys always toggle,
            // even when the WebView surface holds focus. When controls are hidden,
            // any remote key interception reveals controls.
            .onPreviewKeyEvent { event ->
                val key = mapKeyEvent(event) ?: return@onPreviewKeyEvent false
                when (key) {
                    RemoteControlKey.BACK,
                    RemoteControlKey.PLAY_PAUSE -> onRemoteKey(key)
                    else -> {
                        if (!controlsVisible) {
                            onRemoteKey(key)
                            true
                        } else {
                            false
                        }
                    }
                }
            }
            // Bubble phase: shell-owned surface behavior when the shell has focus.
            // A focused WebView consumes directionals/center itself (page-native
            // primary activation and seek where the provider supports it).
            .onKeyEvent { event ->
                val key = mapKeyEvent(event) ?: return@onKeyEvent false
                if (key == RemoteControlKey.BACK || key == RemoteControlKey.PLAY_PAUSE) {
                    return@onKeyEvent false
                }
                if (renderer == PlaybackRenderer.WEBVIEW && key == RemoteControlKey.CENTER_OK && controlsVisible) {
                    embedWebView?.requestFocus()
                    return@onKeyEvent true
                }
                onRemoteKey(key)
            },
        contentAlignment = Alignment.Center
    ) {
        // Real renderer surface for the playback target. Unavailable targets
        // (missing/blank normalized URL) show a clear failure with an exit
        // path instead of a blank surface or overlapping transport controls.
        val combinedFailure: String? = handoffFailure ?: errorMessage
        when (renderer) {
            PlaybackRenderer.NATIVE -> if (resolvedUrl != null) {
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
                    modifier = Modifier.fillMaxSize()
                )
            } else {
                PlayerFailure(
                    message = handoffFailure ?: "No playable source for this episode",
                    onExitPlayer = onExitPlayer
                )
            }
            PlaybackRenderer.WEBVIEW -> if (resolvedUrl != null) {
                EmbedPlayerView(
                    embedUrl = playbackUrl,
                    backendBaseUrl = backendBaseUrl,
                    onWebViewReady = { webView -> embedWebView = webView },
                    onPageFinished = { isLoading = false },
                    onError = { message ->
                        isLoading = false
                        errorMessage = message
                    },
                    modifier = Modifier.fillMaxSize()
                )
            } else {
                PlayerFailure(
                    message = handoffFailure ?: "No playable source for this episode",
                    onExitPlayer = onExitPlayer
                )
            }
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
            // Runtime renderer errors (native decode, embed load) surface here;
            // handoff-level unavailability is already rendered above.
            if (handoffFailure == null) {
                PlayerFailure(
                    message = message,
                    onExitPlayer = onExitPlayer
                )
            }
        }

        // Overlay Transport Controls for TV D-Pad navigation.
        // Hidden whenever playback cannot start so the failure state stays
        // unambiguous instead of overlapping with transport buttons.
        // Top and bottom bars auto-hide during playback and reappear on user interaction.
        if (combinedFailure == null) {
            Column(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(24.dp),
                verticalArrangement = Arrangement.SpaceBetween
            ) {
                // Top Bar
                AnimatedVisibility(
                    visible = controlsVisible,
                    enter = fadeIn() + slideInVertically(initialOffsetY = { -it }),
                    exit = fadeOut() + slideOutVertically(targetOffsetY = { -it })
                ) {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Column {
                            Text(
                                text = "Episode: $episodeId",
                                style = MaterialTheme.typography.titleLarge,
                                color = Color.White
                            )
                            Text(
                                text = statusText,
                                style = MaterialTheme.typography.bodySmall,
                                color = Color.LightGray
                            )
                        }

                        TvPlayerButton(
                            onClick = { onRemoteKey(RemoteControlKey.BACK) }
                        ) {
                            Text("Exit Player (Back)")
                        }
                    }
                }

                // Spacer when top bar is hidden to ensure bottom bar stays at bottom
                if (!controlsVisible) {
                    Spacer(modifier = Modifier.weight(1f))
                }

                // Bottom Transport Control Bar
                AnimatedVisibility(
                    visible = controlsVisible,
                    enter = fadeIn() + slideInVertically(initialOffsetY = { it }),
                    exit = fadeOut() + slideOutVertically(targetOffsetY = { it })
                ) {
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .background(Color(0xAA000000), shape = RoundedCornerShape(12.dp))
                            .padding(16.dp),
                        horizontalArrangement = Arrangement.Center,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        TvPlayerButton(
                            onClick = { onRemoteKey(RemoteControlKey.LEFT) }
                        ) {
                            Text("<< Seek -10s")
                        }

                        Spacer(modifier = Modifier.width(16.dp))

                        TvPlayerButton(
                            onClick = { onRemoteKey(RemoteControlKey.CENTER_OK) },
                            modifier = Modifier.focusRequester(playPauseFocus)
                        ) {
                            Text(if (isPlaying) "Pause" else "Play")
                        }

                        Spacer(modifier = Modifier.width(16.dp))

                        TvPlayerButton(
                            onClick = { onRemoteKey(RemoteControlKey.RIGHT) }
                        ) {
                            Text("Seek +10s >>")
                        }
                    }
                }
            }
        }
    }
}

/**
 * TV-aware button for player transport controls.
 * Provides a 1.1x scale factor and a bright, visible white border ring on focus.
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
