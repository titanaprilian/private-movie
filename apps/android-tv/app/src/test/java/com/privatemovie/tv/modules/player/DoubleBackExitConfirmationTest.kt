package com.privatemovie.tv.modules.player

import com.privatemovie.tv.modules.player.internal.DEFAULT_EXIT_CONFIRM_TIMEOUT_MS
import com.privatemovie.tv.modules.player.internal.DoubleBackExitState
import com.privatemovie.tv.modules.player.internal.PlaybackRenderer
import com.privatemovie.tv.modules.player.internal.RemoteControlKey
import com.privatemovie.tv.modules.player.internal.handleRemoteKey
import com.privatemovie.tv.modules.player.internal.nextControlsVisibility
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class DoubleBackExitConfirmationTest {

    @Test
    fun `exit confirmation timeout constant is 2500ms`() {
        assertEquals(2500L, DEFAULT_EXIT_CONFIRM_TIMEOUT_MS)
        assertEquals(2500L, DEFAULT_EXIT_CONFIRM_TIMEOUT_MS)
    }

    @Test
    fun `initial confirmation state is inactive with no prompt`() {
        val state = DoubleBackExitState()
        assertFalse(state.isConfirmationActive)
        assertFalse(state.showPrompt)
        assertEquals(0L, state.confirmationNonce)
    }

    @Test
    fun `back press while controls visible hides overlay without arming confirmation`() {
        val state = DoubleBackExitState()
        assertEquals(
            PlayerControlAction.HideControls,
            state.onBackPressed(controlsVisible = true)
        )
        assertFalse(state.isConfirmationActive)
        assertFalse(state.showPrompt)
        assertEquals(0L, state.confirmationNonce)
    }

    @Test
    fun `first back press while hidden arms confirmation and shows prompt`() {
        val state = DoubleBackExitState()
        assertEquals(
            PlayerControlAction.ShowExitConfirmation,
            state.onBackPressed(controlsVisible = false)
        )
        assertTrue(state.isConfirmationActive)
        assertTrue(state.showPrompt)
        assertEquals(1L, state.confirmationNonce)
    }

    @Test
    fun `second back press within window exits the player`() {
        val state = DoubleBackExitState()
        state.onBackPressed(controlsVisible = false)
        assertEquals(
            PlayerControlAction.ExitPlayer,
            state.onBackPressed(controlsVisible = false)
        )
    }

    @Test
    fun `timeout elapse dismisses prompt and resets confirmation state`() {
        val state = DoubleBackExitState()
        state.onBackPressed(controlsVisible = false)
        assertTrue(state.showPrompt)

        state.onTimeoutElapsed()

        assertFalse(state.isConfirmationActive)
        assertFalse(state.showPrompt)

        // Next Back press re-arms instead of exiting (state fully reset)
        assertEquals(
            PlayerControlAction.ShowExitConfirmation,
            state.onBackPressed(controlsVisible = false)
        )
    }

    @Test
    fun `dismiss resets confirmation state`() {
        val state = DoubleBackExitState()
        state.onBackPressed(controlsVisible = false)
        state.dismiss()
        assertFalse(state.showPrompt)
    }

    @Test
    fun `exit or hide actions clear armed confirmation`() {
        val state = DoubleBackExitState()
        state.onAction(PlayerControlAction.ShowExitConfirmation)
        assertTrue(state.isConfirmationActive)

        state.onAction(PlayerControlAction.HideControls)
        assertFalse(state.isConfirmationActive)

        state.onAction(PlayerControlAction.ShowExitConfirmation)
        state.onAction(PlayerControlAction.ExitPlayer)
        assertFalse(state.isConfirmationActive)

        state.onAction(PlayerControlAction.ShowExitConfirmation)
        state.onAction(PlayerControlAction.DismissExitConfirmation)
        assertFalse(state.isConfirmationActive)
    }

    @Test
    fun `handleRemoteKey maps double-back flow via confirmation flag`() {
        // Controls visible: Back always hides, never prompts or exits
        assertEquals(
            PlayerControlAction.HideControls,
            handleRemoteKey(RemoteControlKey.BACK, PlaybackRenderer.NATIVE, controlsVisible = true)
        )
        assertEquals(
            PlayerControlAction.HideControls,
            handleRemoteKey(
                RemoteControlKey.BACK,
                PlaybackRenderer.NATIVE,
                controlsVisible = true,
                exitConfirmationActive = true
            )
        )
        // Hidden, first press: prompt
        assertEquals(
            PlayerControlAction.ShowExitConfirmation,
            handleRemoteKey(RemoteControlKey.BACK, PlaybackRenderer.NATIVE, controlsVisible = false)
        )
        // Hidden, second press: exit executes
        assertEquals(
            PlayerControlAction.ExitPlayer,
            handleRemoteKey(
                RemoteControlKey.BACK,
                PlaybackRenderer.NATIVE,
                controlsVisible = false,
                exitConfirmationActive = true
            )
        )
    }

    @Test
    fun `exit confirmation actions leave controls visibility unchanged`() {
        assertFalse(
            nextControlsVisibility(currentVisible = false, action = PlayerControlAction.ShowExitConfirmation)
        )
        assertTrue(
            nextControlsVisibility(currentVisible = true, action = PlayerControlAction.ShowExitConfirmation)
        )
        assertFalse(
            nextControlsVisibility(currentVisible = false, action = PlayerControlAction.DismissExitConfirmation)
        )
    }
}
