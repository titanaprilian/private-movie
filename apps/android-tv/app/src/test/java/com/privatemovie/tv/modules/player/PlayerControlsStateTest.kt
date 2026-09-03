package com.privatemovie.tv.modules.player

import com.privatemovie.tv.modules.player.internal.DEFAULT_CONTROLS_TIMEOUT_MS
import com.privatemovie.tv.modules.player.internal.PlayerControlAction
import com.privatemovie.tv.modules.player.internal.PlayerControlsState
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class PlayerControlsStateTest {

    @Test
    fun `initial state is visible and timeout constant matches MVP spec`() {
        val state = PlayerControlsState()
        assertTrue(state.isVisible)
        assertEquals(DEFAULT_CONTROLS_TIMEOUT_MS, state.timeoutMs)
        assertEquals(3000L, state.timeoutMs)
        assertEquals(0L, state.activityNonce)
    }

    @Test
    fun `hide sets visibility to false`() {
        val state = PlayerControlsState(initialVisible = true)
        state.hide()
        assertFalse(state.isVisible)
    }

    @Test
    fun `show sets visibility to true and increments activity nonce`() {
        val state = PlayerControlsState(initialVisible = false)
        state.show()
        assertTrue(state.isVisible)
        assertEquals(1L, state.activityNonce)
    }

    @Test
    fun `resetTimeout increments activity nonce without changing visibility`() {
        val state = PlayerControlsState(initialVisible = true)
        state.resetTimeout()
        assertEquals(1L, state.activityNonce)
        assertTrue(state.isVisible)

        state.resetTimeout()
        assertEquals(2L, state.activityNonce)
    }

    @Test
    fun `onAction with ShowControls shows controls and increments nonce`() {
        val state = PlayerControlsState(initialVisible = false)
        state.onAction(PlayerControlAction.ShowControls)
        assertTrue(state.isVisible)
        assertEquals(1L, state.activityNonce)
    }

    @Test
    fun `onAction with transport actions resets timeout`() {
        val state = PlayerControlsState(initialVisible = true)
        state.onAction(PlayerControlAction.TogglePlayPause)
        assertTrue(state.isVisible)
        assertEquals(1L, state.activityNonce)

        state.onAction(PlayerControlAction.SeekForward())
        assertTrue(state.isVisible)
        assertEquals(2L, state.activityNonce)

        state.onAction(PlayerControlAction.SeekBackward())
        assertTrue(state.isVisible)
        assertEquals(3L, state.activityNonce)
    }

    @Test
    fun `onAction with non-revealing actions maintains hidden visibility`() {
        val state = PlayerControlsState(initialVisible = false)
        state.onAction(PlayerControlAction.RequestFullscreen)
        assertFalse(state.isVisible)
        assertEquals(0L, state.activityNonce)

        state.onAction(PlayerControlAction.ExitPlayer)
        assertFalse(state.isVisible)
        assertEquals(0L, state.activityNonce)
    }
}
