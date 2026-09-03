package com.privatemovie.tv.modules.player

import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.remember
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.viewinterop.AndroidView
import androidx.media3.common.MediaItem
import androidx.media3.common.PlaybackException
import androidx.media3.common.Player
import androidx.media3.exoplayer.ExoPlayer
import androidx.media3.ui.PlayerView

/**
 * Native playback surface for direct stream targets.
 *
 * Hosts a Media3 [ExoPlayer] inside a controller-less [PlayerView]; transport
 * stays in the TV player shell overlay so D-pad behavior is uniform. The
 * ready [ExoPlayer] instance is handed out via [onPlayerReady] so the shell
 * can apply play/pause and seek intents directly.
 */
@Composable
fun NativePlayerView(
    streamUrl: String,
    onPlayerReady: (ExoPlayer) -> Unit,
    onFirstFrame: () -> Unit,
    onError: (String) -> Unit,
    modifier: Modifier = Modifier
) {
    val context = LocalContext.current

    val player = remember {
        ExoPlayer.Builder(context).build().apply {
            addListener(object : Player.Listener {
                override fun onPlaybackStateChanged(playbackState: Int) {
                    if (playbackState == Player.STATE_READY) onFirstFrame()
                }

                override fun onPlayerError(error: PlaybackException) {
                    onError(error.message ?: "Native playback failed")
                }
            })
        }
    }

    LaunchedEffect(streamUrl) {
        player.setMediaItem(MediaItem.fromUri(streamUrl))
        player.prepare()
        player.playWhenReady = true
        onPlayerReady(player)
    }

    DisposableEffect(Unit) {
        onDispose { player.release() }
    }

    AndroidView(
        factory = { ctx ->
            PlayerView(ctx).apply {
                this.player = player
                // Shell overlay owns transport; no touch-oriented controller.
                useController = false
            }
        },
        modifier = modifier
    )
}
