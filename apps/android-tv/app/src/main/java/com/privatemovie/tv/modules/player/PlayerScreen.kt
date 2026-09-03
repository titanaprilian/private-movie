package com.privatemovie.tv.modules.player

import android.app.Activity
import android.webkit.WebView
import android.view.KeyEvent as AndroidKeyEvent
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
import androidx.compose.material3.Button
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
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
import com.privatemovie.tv.modules.player.internal.PlaybackRenderer
import com.privatemovie.tv.modules.player.internal.PlayerControlAction
import com.privatemovie.tv.modules.player.internal.RemoteControlKey
import com.privatemovie.tv.modules.player.internal.handleRemoteKey
import com.privatemovie.tv.modules.player.internal.resolvePlaybackUrl
import com.privatemovie.tv.modules.player.internal.resolveRendererForTypeName
import com.privatemovie.tv.modules.player.internal.shouldAutoFullscreenOnEntry

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
    val renderer: PlaybackRenderer = remember(playbackSourceTypeName) {
        resolveRendererForTypeName(playbackSourceTypeName)
    }
    val resolvedUrl = remember(playbackUrl, backendBaseUrl) {
        resolvePlaybackUrl(playbackUrl, backendBaseUrl)
    }

    var isPlaying by remember { mutableStateOf(true) }
    var statusText by remember { mutableStateOf("Playing Episode $episodeId") }
    var isLoading by remember { mutableStateOf(true) }
    var errorMessage by remember { mutableStateOf<String?>(null) }
    var exoPlayer by remember { mutableStateOf<ExoPlayer?>(null) }
    var embedWebView by remember { mutableStateOf<WebView?>(null) }

    val view = LocalView.current
    val playerFocus = remember { FocusRequester() }

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
            is PlayerControlAction.TogglePlayPause -> when (renderer) {
                PlaybackRenderer.NATIVE -> toggleNativePlayback()
                PlaybackRenderer.WEBVIEW -> {
                    embedWebView?.toggleHtml5Video()
                    isPlaying = !isPlaying
                    statusText = if (isPlaying) "Playing Episode $episodeId" else "Paused"
                }
            }
            is PlayerControlAction.ExitPlayer -> onExitPlayer()
            is PlayerControlAction.SeekBackward -> when (renderer) {
                PlaybackRenderer.NATIVE -> seekNative(-action.seconds)
                PlaybackRenderer.WEBVIEW -> {
                    embedWebView?.sendDpadKey(AndroidKeyEvent.KEYCODE_DPAD_LEFT)
                    statusText = "Seeking -${action.seconds}s"
                }
            }
            is PlayerControlAction.SeekForward -> when (renderer) {
                PlaybackRenderer.NATIVE -> seekNative(action.seconds)
                PlaybackRenderer.WEBVIEW -> {
                    embedWebView?.sendDpadKey(AndroidKeyEvent.KEYCODE_DPAD_RIGHT)
                    statusText = "Seeking +${action.seconds}s"
                }
            }
            is PlayerControlAction.RequestFullscreen -> attemptFullscreen()
        }
    }

    fun onRemoteKey(key: RemoteControlKey): Boolean {
        applyAction(handleRemoteKey(key, renderer))
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
            // even when the WebView surface holds focus.
            .onPreviewKeyEvent { event ->
                when (mapKeyEvent(event)) {
                    RemoteControlKey.BACK,
                    RemoteControlKey.PLAY_PAUSE -> onRemoteKey(
                        mapKeyEvent(event) ?: return@onPreviewKeyEvent false
                    )
                    else -> false
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
                if (renderer == PlaybackRenderer.WEBVIEW && key == RemoteControlKey.CENTER_OK) {
                    embedWebView?.requestFocus()
                    return@onKeyEvent true
                }
                onRemoteKey(key)
            },
        contentAlignment = Alignment.Center
    ) {
        // Real renderer surface for the playback target.
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
                    message = "No playable source for this episode",
                    onExitPlayer = onExitPlayer
                )
            }
            PlaybackRenderer.WEBVIEW -> EmbedPlayerView(
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
        }

        if (isLoading && errorMessage == null && resolvedUrl != null) {
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
            PlayerFailure(
                message = message,
                onExitPlayer = onExitPlayer
            )
        }

        // Overlay Transport Controls for TV D-Pad navigation
        if (errorMessage == null) {
            Column(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(24.dp),
                verticalArrangement = Arrangement.SpaceBetween
            ) {
                // Top Bar
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

                    Button(onClick = { onRemoteKey(RemoteControlKey.BACK) }) {
                        Text("Exit Player (Back)")
                    }
                }

                // Bottom Transport Control Bar
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .background(Color(0xAA000000))
                        .padding(16.dp),
                    horizontalArrangement = Arrangement.Center,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Button(onClick = { onRemoteKey(RemoteControlKey.LEFT) }) {
                        Text("<< Seek -10s")
                    }

                    Spacer(modifier = Modifier.width(16.dp))

                    Button(onClick = { onRemoteKey(RemoteControlKey.CENTER_OK) }) {
                        Text(if (isPlaying) "Pause" else "Play")
                    }

                    Spacer(modifier = Modifier.width(16.dp))

                    Button(onClick = { onRemoteKey(RemoteControlKey.RIGHT) }) {
                        Text("Seek +10s >>")
                    }
                }
            }
        }
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
            Button(onClick = onExitPlayer) {
                Text("Exit Player (Back)")
            }
        }
    }
}
