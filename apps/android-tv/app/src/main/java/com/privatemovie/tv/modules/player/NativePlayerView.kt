package com.privatemovie.tv.modules.player

import android.util.Log
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
import androidx.media3.datasource.DefaultHttpDataSource
import androidx.media3.exoplayer.DefaultRenderersFactory
import androidx.media3.exoplayer.ExoPlayer
import androidx.media3.exoplayer.mediacodec.MediaCodecSelector
import androidx.media3.exoplayer.source.DefaultMediaSourceFactory
import androidx.media3.exoplayer.util.EventLogger
import androidx.media3.ui.PlayerView
import com.privatemovie.tv.data.network.MediaTlsConfig
import com.privatemovie.tv.modules.player.internal.PlayerTeardownGuard

private const val TAG = "NativePlayerView"
private const val TV_BROWSER_USER_AGENT =
    "Mozilla/5.0 (Linux; Android 11; Android TV) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"

/**
 * Native playback surface for direct stream targets.
 *
 * Hosts a Media3 [ExoPlayer] inside a controller-less [PlayerView]; transport
 * stays in the TV player shell overlay so D-pad behavior is uniform. The
 * ready [ExoPlayer] instance is handed out via [onPlayerReady] so the shell
 * can apply play/pause and seek intents directly.
 */
@androidx.annotation.OptIn(androidx.media3.common.util.UnstableApi::class)
@Composable
fun NativePlayerView(
    streamUrl: String,
    onPlayerReady: (ExoPlayer) -> Unit,
    onFirstFrame: () -> Unit,
    onError: (String) -> Unit,
    modifier: Modifier = Modifier,
    onPlaybackEnded: (() -> Unit)? = null
) {
    val context = LocalContext.current
    val teardownGuard = remember { PlayerTeardownGuard() }

    val playbackListener = remember {
        object : Player.Listener {
            override fun onPlaybackStateChanged(playbackState: Int) {
                val stateName = when (playbackState) {
                    Player.STATE_IDLE -> "STATE_IDLE"
                    Player.STATE_BUFFERING -> "STATE_BUFFERING"
                    Player.STATE_READY -> "STATE_READY"
                    Player.STATE_ENDED -> "STATE_ENDED"
                    else -> "UNKNOWN($playbackState)"
                }
                Log.i(TAG, "onPlaybackStateChanged: $stateName")

                if (playbackState == Player.STATE_READY) onFirstFrame()
                if (playbackState == Player.STATE_ENDED) onPlaybackEnded?.invoke()
            }

            override fun onIsLoadingChanged(isLoading: Boolean) {
                Log.d(TAG, "onIsLoadingChanged: isLoading=$isLoading")
            }

            override fun onPlayerError(error: PlaybackException) {
                if (!teardownGuard.shouldDispatchError()) {
                    Log.i(TAG, "Suppressing player error during disposal: ${error.errorCodeName}(${error.errorCode})")
                    return
                }
                Log.e(TAG, "onPlayerError: errorCode=${error.errorCodeName}(${error.errorCode}), message=${error.message}", error)
                onError(error.message ?: "Native playback failed")
            }
        }
    }

    val player = remember {
        MediaTlsConfig.configure()

        val httpDataSourceFactory = DefaultHttpDataSource.Factory()
            .setUserAgent(TV_BROWSER_USER_AGENT)
            .setAllowCrossProtocolRedirects(true)
            .setConnectTimeoutMs(15000)
            .setReadTimeoutMs(15000)

        val mediaSourceFactory = DefaultMediaSourceFactory(httpDataSourceFactory)

        val renderersFactory = DefaultRenderersFactory(context).apply {
            setEnableDecoderFallback(true)
            setMediaCodecSelector { mimeType, requiresSecure, requiresTunneling ->
                val decoders = MediaCodecSelector.DEFAULT.getDecoderInfos(mimeType, requiresSecure, requiresTunneling)
                if (mimeType.equals("video/avc", ignoreCase = true) || mimeType.equals("video/mp4v-es", ignoreCase = true)) {
                    // Deprioritize buggy vendor hardware decoders (e.g. OMX.MS.* on MStar/MediaTek TV chipsets)
                    // that fail with DynamicANWBuffer / Level 5.0+ profile mismatches, preferring stable software decoders (c2.android.*)
                    decoders.sortedWith { a, b ->
                        val aBuggy = a.name.startsWith("OMX.MS.", ignoreCase = true)
                        val bBuggy = b.name.startsWith("OMX.MS.", ignoreCase = true)
                        when {
                            aBuggy && !bBuggy -> 1
                            !aBuggy && bBuggy -> -1
                            else -> 0
                        }
                    }
                } else {
                    decoders
                }
            }
        }

        ExoPlayer.Builder(context, renderersFactory)
            .setMediaSourceFactory(mediaSourceFactory)
            .build()
            .apply {
                // Detailed ExoPlayer internal event logging (filters under tag "EventLogger")
                addAnalyticsListener(EventLogger())

                addListener(playbackListener)
            }
    }

    LaunchedEffect(streamUrl) {
        Log.i(TAG, "Preparing streamUrl: $streamUrl")
        player.setMediaItem(MediaItem.fromUri(streamUrl))
        player.prepare()
        player.playWhenReady = true
        onPlayerReady(player)
    }

    DisposableEffect(Unit) {
        onDispose {
            // Detach listeners before release so teardown errors are never
            // dispatched to onError (which would flash "Playback unavailable").
            teardownGuard.markDisposing()
            player.removeListener(playbackListener)
            player.release()
        }
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
