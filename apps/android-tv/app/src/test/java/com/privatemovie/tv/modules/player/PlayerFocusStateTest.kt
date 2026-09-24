package com.privatemovie.tv.modules.player

import com.privatemovie.tv.modules.player.internal.PlayerFocusState
import com.privatemovie.tv.modules.player.internal.PlayerFocusTarget
import com.privatemovie.tv.modules.player.internal.resolvePlayerFocusTarget
import org.junit.Assert.assertEquals
import org.junit.Test

class PlayerFocusStateTest {

    @Test
    fun `visible controls resolve focus to play pause button`() {
        assertEquals(
            PlayerFocusTarget.PLAY_PAUSE_BUTTON,
            resolvePlayerFocusTarget(controlsVisible = true)
        )
    }

    @Test
    fun `hidden controls resolve focus to player container`() {
        assertEquals(
            PlayerFocusTarget.PLAYER_CONTAINER,
            resolvePlayerFocusTarget(controlsVisible = false)
        )
    }

    @Test
    fun `initial focus state targets play pause button`() {
        val state = PlayerFocusState()
        assertEquals(PlayerFocusTarget.PLAY_PAUSE_BUTTON, state.currentTarget)
        assertEquals(0L, state.focusRequestNonce)
    }

    @Test
    fun `entry with visible controls places initial focus on play pause`() {
        val state = PlayerFocusState()
        assertEquals(
            PlayerFocusTarget.PLAY_PAUSE_BUTTON,
            state.onEntry(controlsVisible = true)
        )
        assertEquals(PlayerFocusTarget.PLAY_PAUSE_BUTTON, state.currentTarget)
        assertEquals(1L, state.focusRequestNonce)
    }

    @Test
    fun `entry with hidden controls places initial focus on container`() {
        val state = PlayerFocusState()
        assertEquals(
            PlayerFocusTarget.PLAYER_CONTAINER,
            state.onEntry(controlsVisible = false)
        )
        assertEquals(PlayerFocusTarget.PLAYER_CONTAINER, state.currentTarget)
    }

    @Test
    fun `hiding controls transfers focus to container for key interception`() {
        val state = PlayerFocusState()
        state.onEntry(controlsVisible = true)

        assertEquals(
            PlayerFocusTarget.PLAYER_CONTAINER,
            state.onControlsVisibilityChanged(controlsVisible = false)
        )
        assertEquals(PlayerFocusTarget.PLAYER_CONTAINER, state.currentTarget)
    }

    @Test
    fun `reopened controls restore focus to play pause button`() {
        val state = PlayerFocusState()
        state.onEntry(controlsVisible = true)
        state.onControlsVisibilityChanged(controlsVisible = false)

        assertEquals(
            PlayerFocusTarget.PLAY_PAUSE_BUTTON,
            state.onControlsVisibilityChanged(controlsVisible = true)
        )
        assertEquals(PlayerFocusTarget.PLAY_PAUSE_BUTTON, state.currentTarget)
    }

    @Test
    fun `every transition bumps the focus request nonce`() {
        val state = PlayerFocusState()
        state.onEntry(controlsVisible = true)
        state.onControlsVisibilityChanged(controlsVisible = false)
        state.onControlsVisibilityChanged(controlsVisible = true)
        assertEquals(3L, state.focusRequestNonce)
    }
}
