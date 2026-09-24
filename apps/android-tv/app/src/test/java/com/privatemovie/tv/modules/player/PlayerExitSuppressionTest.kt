package com.privatemovie.tv.modules.player

import com.privatemovie.tv.modules.player.internal.PlayerExitGuard
import com.privatemovie.tv.modules.player.internal.PlayerTeardownGuard
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class PlayerExitSuppressionTest {

    @Test
    fun `exit guard starts idle with failure UI allowed`() {
        val guard = PlayerExitGuard()
        assertFalse(guard.isExiting)
        assertTrue(guard.shouldShowFailure())
    }

    @Test
    fun `first exit request proceeds and suppresses failure UI`() {
        val guard = PlayerExitGuard()
        assertTrue(guard.tryExit())
        assertTrue(guard.isExiting)
        assertFalse(guard.shouldShowFailure())
    }

    @Test
    fun `repeated exit requests are suppressed so exit fires once`() {
        val guard = PlayerExitGuard()
        assertTrue(guard.tryExit())
        assertFalse(guard.tryExit())
        assertFalse(guard.tryExit())
        assertTrue(guard.isExiting)
        assertFalse(guard.shouldShowFailure())
    }

    @Test
    fun `teardown guard dispatches errors before disposal`() {
        val guard = PlayerTeardownGuard()
        assertFalse(guard.isDisposing)
        assertTrue(guard.shouldDispatchError())
    }

    @Test
    fun `teardown guard suppresses errors once disposal starts`() {
        val guard = PlayerTeardownGuard()
        guard.markDisposing()
        assertTrue(guard.isDisposing)
        assertFalse(guard.shouldDispatchError())
    }

    @Test
    fun `teardown guard disposal marking is idempotent`() {
        val guard = PlayerTeardownGuard()
        guard.markDisposing()
        guard.markDisposing()
        assertTrue(guard.isDisposing)
        assertFalse(guard.shouldDispatchError())
    }
}
