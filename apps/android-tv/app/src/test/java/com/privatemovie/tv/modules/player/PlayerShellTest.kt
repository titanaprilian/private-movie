package com.privatemovie.tv.modules.player

import com.privatemovie.tv.dto.models.VideoSource
import com.privatemovie.tv.modules.player.internal.DEFAULT_CONTROLS_TIMEOUT_MS
import com.privatemovie.tv.modules.player.internal.DEFAULT_SEEK_SECONDS
import com.privatemovie.tv.modules.player.internal.PlaybackRenderer
import com.privatemovie.tv.modules.player.internal.PlayerControlAction
import com.privatemovie.tv.modules.player.internal.RemoteControlKey
import com.privatemovie.tv.modules.player.internal.handleRemoteKey
import com.privatemovie.tv.modules.player.internal.initialActionsOnEntry
import com.privatemovie.tv.modules.player.internal.nextControlsVisibility
import com.privatemovie.tv.modules.player.internal.resolveRenderer
import com.privatemovie.tv.modules.player.internal.resolveRendererForTypeName
import com.privatemovie.tv.modules.player.internal.shouldAutoFullscreenOnEntry
import com.privatemovie.tv.modules.player.internal.supportsSeek
import com.privatemovie.tv.modules.player.internal.resolvePlaybackUrl
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class PlayerShellTest {

    @Test
    fun `direct source resolves to native renderer`() {
        assertEquals(PlaybackRenderer.NATIVE, resolveRenderer(VideoSource.Type.DIRECT))
    }

    @Test
    fun `embed source resolves to webview renderer`() {
        assertEquals(PlaybackRenderer.WEBVIEW, resolveRenderer(VideoSource.Type.EMBED))
    }

    @Test
    fun `type name resolution is case-insensitive and defaults to webview`() {
        assertEquals(PlaybackRenderer.NATIVE, resolveRendererForTypeName("direct"))
        assertEquals(PlaybackRenderer.NATIVE, resolveRendererForTypeName("DIRECT"))
        assertEquals(PlaybackRenderer.WEBVIEW, resolveRendererForTypeName("embed"))
        assertEquals(PlaybackRenderer.WEBVIEW, resolveRendererForTypeName("EMBED"))
        assertEquals(PlaybackRenderer.WEBVIEW, resolveRendererForTypeName("unknown-provider"))
        assertEquals(PlaybackRenderer.WEBVIEW, resolveRendererForTypeName(null))
    }

    @Test
    fun `player auto-attempts fullscreen on entry for both renderers`() {
        assertTrue(shouldAutoFullscreenOnEntry())
        assertEquals(
            listOf(PlayerControlAction.RequestFullscreen),
            initialActionsOnEntry(PlaybackRenderer.NATIVE)
        )
        assertEquals(
            listOf(PlayerControlAction.RequestFullscreen),
            initialActionsOnEntry(PlaybackRenderer.WEBVIEW)
        )
    }

    @Test
    fun `center OK triggers primary playback interaction`() {
        assertEquals(
            PlayerControlAction.TogglePlayPause,
            handleRemoteKey(RemoteControlKey.CENTER_OK, PlaybackRenderer.NATIVE)
        )
        assertEquals(
            PlayerControlAction.TogglePlayPause,
            handleRemoteKey(RemoteControlKey.CENTER_OK, PlaybackRenderer.WEBVIEW)
        )
    }

    @Test
    fun `back exits playback for both renderers`() {
        assertEquals(
            PlayerControlAction.ExitPlayer,
            handleRemoteKey(RemoteControlKey.BACK, PlaybackRenderer.NATIVE)
        )
        assertEquals(
            PlayerControlAction.ExitPlayer,
            handleRemoteKey(RemoteControlKey.BACK, PlaybackRenderer.WEBVIEW)
        )
    }

    @Test
    fun `left and right attempt seek where supported`() {
        assertTrue(supportsSeek(PlaybackRenderer.NATIVE))
        assertTrue(supportsSeek(PlaybackRenderer.WEBVIEW))
        assertEquals(
            PlayerControlAction.SeekBackward(DEFAULT_SEEK_SECONDS),
            handleRemoteKey(RemoteControlKey.LEFT, PlaybackRenderer.NATIVE)
        )
        assertEquals(
            PlayerControlAction.SeekForward(DEFAULT_SEEK_SECONDS),
            handleRemoteKey(RemoteControlKey.RIGHT, PlaybackRenderer.NATIVE)
        )
        assertEquals(
            PlayerControlAction.SeekBackward(DEFAULT_SEEK_SECONDS),
            handleRemoteKey(RemoteControlKey.LEFT, PlaybackRenderer.WEBVIEW)
        )
        assertEquals(
            PlayerControlAction.SeekForward(DEFAULT_SEEK_SECONDS),
            handleRemoteKey(RemoteControlKey.RIGHT, PlaybackRenderer.WEBVIEW)
        )
    }

    @Test
    fun `play pause media key toggles playback`() {
        assertEquals(
            PlayerControlAction.TogglePlayPause,
            handleRemoteKey(RemoteControlKey.PLAY_PAUSE, PlaybackRenderer.NATIVE)
        )
        assertEquals(
            PlayerControlAction.TogglePlayPause,
            handleRemoteKey(RemoteControlKey.PLAY_PAUSE, PlaybackRenderer.WEBVIEW)
        )
    }

    @Test
    fun `interactions while controls are hidden signal the UI to show controls without triggering underlying action`() {
        val keysRevealingControls = listOf(
            RemoteControlKey.CENTER_OK,
            RemoteControlKey.LEFT,
            RemoteControlKey.RIGHT,
            RemoteControlKey.PLAY_PAUSE,
            RemoteControlKey.UP,
            RemoteControlKey.DOWN
        )

        for (renderer in PlaybackRenderer.entries) {
            for (key in keysRevealingControls) {
                assertEquals(
                    "Key $key should reveal controls on renderer $renderer when controls are hidden",
                    PlayerControlAction.ShowControls,
                    handleRemoteKey(key, renderer, controlsVisible = false)
                )
            }
        }
    }

    @Test
    fun `back key exits playback even when controls are hidden`() {
        for (renderer in PlaybackRenderer.entries) {
            assertEquals(
                PlayerControlAction.ExitPlayer,
                handleRemoteKey(RemoteControlKey.BACK, renderer, controlsVisible = false)
            )
        }
    }

    @Test
    fun `up and down keys when controls are visible signal ShowControls to refresh inactivity timeout`() {
        for (renderer in PlaybackRenderer.entries) {
            assertEquals(
                PlayerControlAction.ShowControls,
                handleRemoteKey(RemoteControlKey.UP, renderer, controlsVisible = true)
            )
            assertEquals(
                PlayerControlAction.ShowControls,
                handleRemoteKey(RemoteControlKey.DOWN, renderer, controlsVisible = true)
            )
        }
    }

    @Test
    fun `default controls timeout constant is 3000ms`() {
        assertEquals(3000L, DEFAULT_CONTROLS_TIMEOUT_MS)
    }

    @Test
    fun `next controls visibility updates state correctly`() {
        // Any ShowControls action transitions hidden overlay to visible
        assertTrue(nextControlsVisibility(currentVisible = false, action = PlayerControlAction.ShowControls))
        assertTrue(nextControlsVisibility(currentVisible = true, action = PlayerControlAction.ShowControls))

        // Actions like TogglePlayPause keep controls visible and reset timeout in UI
        assertTrue(nextControlsVisibility(currentVisible = true, action = PlayerControlAction.TogglePlayPause))
        assertTrue(nextControlsVisibility(currentVisible = true, action = PlayerControlAction.SeekForward()))
        assertTrue(nextControlsVisibility(currentVisible = true, action = PlayerControlAction.SeekBackward()))

        // Exit or RequestFullscreen don't force controls visible if hidden
        assertFalse(nextControlsVisibility(currentVisible = false, action = PlayerControlAction.RequestFullscreen))
        assertFalse(nextControlsVisibility(currentVisible = false, action = PlayerControlAction.ExitPlayer))
    }

    @Test
    fun `absolute playback urls pass through untouched`() {
        assertEquals(
            "https://cdn.example.com/stream/1.mp4",
            resolvePlaybackUrl("https://cdn.example.com/stream/1.mp4", "http://10.0.2.2:3000")
        )
        assertEquals(
            "http://10.0.2.2:3000/embed/abc",
            resolvePlaybackUrl("http://10.0.2.2:3000/embed/abc", "http://10.0.2.2:3000")
        )
    }

    @Test
    fun `relative embed targets resolve against the backend base url`() {
        assertEquals(
            "http://10.0.2.2:3000/embed/abc123",
            resolvePlaybackUrl("/embed/abc123", "http://10.0.2.2:3000")
        )
        assertEquals(
            "http://10.0.2.2:3000/embed/abc123",
            resolvePlaybackUrl("/embed/abc123", "http://10.0.2.2:3000/")
        )
    }

    @Test
    fun `relative targets without a backend base url pass through`() {
        assertEquals(
            "/embed/abc123",
            resolvePlaybackUrl("/embed/abc123", null)
        )
    }

    @Test
    fun `missing playback urls resolve to null`() {
        assertNull(resolvePlaybackUrl(null, "http://10.0.2.2:3000"))
        assertNull(resolvePlaybackUrl("   ", "http://10.0.2.2:3000"))
    }
}
