package com.privatemovie.tv.modules.player

import android.annotation.SuppressLint
import android.view.KeyEvent
import android.view.View
import android.webkit.WebChromeClient
import android.webkit.WebResourceError
import android.webkit.WebResourceRequest
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.viewinterop.AndroidView
import com.privatemovie.tv.modules.player.internal.resolvePlaybackUrl

/**
 * WebView playback surface for embed targets.
 *
 * TV-safe shell: JavaScript + DOM storage on, media autoplay allowed without a
 * user gesture, and provider fullscreen requests ([WebChromeClient.onShowCustomView])
 * are hosted in a fullscreen overlay. The created [WebView] is handed out via
 * [onWebViewReady] so the shell can forward seek-oriented D-pad keys and issue
 * best-effort play/pause toggles without depending on provider DOM structure.
 */
@Composable
fun EmbedPlayerView(
    embedUrl: String?,
    backendBaseUrl: String?,
    onWebViewReady: (WebView) -> Unit,
    onPageFinished: () -> Unit,
    onError: (String) -> Unit,
    modifier: Modifier = Modifier
) {
    val resolvedUrl = remember(embedUrl, backendBaseUrl) {
        resolvePlaybackUrl(embedUrl, backendBaseUrl)
    }
    var fullscreenView by remember { mutableStateOf<View?>(null) }
    var fullscreenCallback by remember {
        mutableStateOf<WebChromeClient.CustomViewCallback?>(null)
    }

    if (resolvedUrl == null) {
        Box(
            modifier = modifier
                .fillMaxSize()
                .background(Color.Black),
            contentAlignment = Alignment.Center
        ) {
            Text(
                text = "No playable source for this episode",
                style = MaterialTheme.typography.titleMedium,
                color = Color.White
            )
        }
        return
    }

    Box(modifier = modifier.fillMaxSize()) {
        AndroidView(
            factory = { ctx ->
                createTvWebView(
                    ctx = ctx,
                    url = resolvedUrl,
                    onWebViewReady = onWebViewReady,
                    onPageFinished = onPageFinished,
                    onError = onError,
                    onShowFullscreen = { view, callback ->
                        fullscreenView = view
                        fullscreenCallback = callback
                    },
                    onHideFullscreen = {
                        fullscreenCallback?.onCustomViewHidden()
                        fullscreenView = null
                        fullscreenCallback = null
                    }
                )
            },
            update = { webView ->
                if (webView.url != resolvedUrl) webView.loadUrl(resolvedUrl)
            },
            onRelease = { webView ->
                webView.stopLoading()
                webView.destroy()
            },
            modifier = Modifier.fillMaxSize()
        )

        // Provider fullscreen surface (e.g. embed fullscreen button / JS API).
        fullscreenView?.let { customView ->
            AndroidView(
                factory = { customView },
                modifier = Modifier
                    .fillMaxSize()
                    .background(Color.Black)
            )
        }
    }
}

@SuppressLint("SetJavaScriptEnabled")
private fun createTvWebView(
    ctx: android.content.Context,
    url: String,
    onWebViewReady: (WebView) -> Unit,
    onPageFinished: () -> Unit,
    onError: (String) -> Unit,
    onShowFullscreen: (View, WebChromeClient.CustomViewCallback) -> Unit,
    onHideFullscreen: () -> Unit
): WebView {
    return WebView(ctx).apply {
        settings.javaScriptEnabled = true
        settings.domStorageEnabled = true
        settings.mediaPlaybackRequiresUserGesture = false
        settings.loadWithOverviewMode = true
        settings.useWideViewPort = true
        isFocusable = true
        isFocusableInTouchMode = false

        webViewClient = object : WebViewClient() {
            override fun onPageFinished(view: WebView, url: String) {
                onPageFinished()
            }

            override fun onReceivedError(
                view: WebView,
                request: WebResourceRequest,
                error: WebResourceError
            ) {
                if (request.isForMainFrame) {
                    onError("Embed failed to load (${error.errorCode})")
                }
            }
        }

        webChromeClient = object : WebChromeClient() {
            override fun onShowCustomView(
                view: View,
                callback: CustomViewCallback
            ) {
                onShowFullscreen(view, callback)
            }

            override fun onHideCustomView() {
                onHideFullscreen()
            }
        }

        loadUrl(url)
        onWebViewReady(this)
    }
}

/**
 * Best-effort HTML5 play/pause toggle for embed pages. Never throws: provider
 * DOM differences are explicitly out of contract, so a missing `<video>`
 * element is a silent no-op.
 */
fun WebView.toggleHtml5Video() {
    try {
        evaluateJavascript(
            "(function(){var v=document.querySelector('video');" +
                "if(!v)return false;" +
                "if(v.paused){v.play();}else{v.pause();}" +
                "return true;})();",
            null
        )
    } catch (_: Exception) {
        // Best-effort only.
    }
}

/** Forwards a D-pad key press to the embed page (seek/arrows where supported). */
fun WebView.sendDpadKey(keyCode: Int) {
    try {
        dispatchKeyEvent(KeyEvent(KeyEvent.ACTION_DOWN, keyCode))
        dispatchKeyEvent(KeyEvent(KeyEvent.ACTION_UP, keyCode))
    } catch (_: Exception) {
        // Best-effort only.
    }
}
