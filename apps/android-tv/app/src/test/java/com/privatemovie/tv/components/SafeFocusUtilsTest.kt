package com.privatemovie.tv.components

import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.input.key.KeyEvent
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.test.advanceUntilIdle
import kotlinx.coroutines.test.runTest
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test
import java.util.concurrent.atomic.AtomicInteger

@OptIn(ExperimentalCoroutinesApi::class)
class SafeFocusUtilsTest {

    @Test
    fun `isRepeatKeyEvent returns true when repeatCount is greater than zero`() {
        val eventWithRepeat = android.view.KeyEvent(
            100L, 200L, android.view.KeyEvent.ACTION_DOWN,
            android.view.KeyEvent.KEYCODE_DPAD_CENTER, 1
        )
        val composeKeyEvent = KeyEvent(eventWithRepeat)

        assertTrue(isRepeatKeyEvent(composeKeyEvent, overrideRepeatCount = 1))
    }

    @Test
    fun `isRepeatKeyEvent returns false when repeatCount is zero`() {
        val eventNoRepeat = androidx.compose.ui.input.key.KeyEvent(
            android.view.KeyEvent(
                0L, 0L, android.view.KeyEvent.ACTION_DOWN,
                android.view.KeyEvent.KEYCODE_DPAD_CENTER, 0
            )
        )

        assertFalse(isRepeatKeyEvent(eventNoRepeat))
    }

    @Test
    fun `requestFocusSafely succeeds immediately when node is initialized`() = runTest {
        var attempts = 0
        val focusRequester = FocusRequester()
        val success = requestFocusSafely(
            focusRequester = focusRequester,
            maxRetries = 5,
            rawRequest = {
                attempts++
                true
            }
        )

        assertTrue(success)
        assertEquals(1, attempts)
    }

    @Test
    fun `requestFocusSafely retries across frames and succeeds when node attaches later`() = runTest {
        var attempts = 0
        val focusRequester = FocusRequester()

        val job = requestFocusSafelyAsync(
            focusRequester = focusRequester,
            maxRetries = 3,
            rawRequest = {
                attempts++
                attempts >= 3
            }
        )

        advanceUntilIdle()
        val result = job.getCompleted()

        assertTrue(result)
        assertEquals(3, attempts)
    }

    @Test
    fun `requestFocusSafely handles exception from unattached node and retries`() = runTest {
        var attempts = 0
        val focusRequester = FocusRequester()

        val job = requestFocusSafelyAsync(
            focusRequester = focusRequester,
            maxRetries = 3,
            rawRequest = {
                attempts++
                if (attempts < 2) {
                    throw IllegalStateException("FocusRequester is not initialized")
                }
                true
            }
        )

        advanceUntilIdle()
        val result = job.getCompleted()

        assertTrue(result)
        assertEquals(2, attempts)
    }

    @Test
    fun `requestFocusSafely exhausts retries without crashing and returns false`() = runTest {
        var attempts = 0
        val focusRequester = FocusRequester()

        val job = requestFocusSafelyAsync(
            focusRequester = focusRequester,
            maxRetries = 4,
            rawRequest = {
                attempts++
                throw IllegalStateException("FocusRequester is not initialized")
            }
        )

        advanceUntilIdle()
        val result = job.getCompleted()

        assertFalse(result)
        assertEquals(4, attempts)
    }

    @Test
    fun `FocusTransitionCoordinator rejects new requests while transition is in flight`() = runTest {
        val coordinator = FocusTransitionCoordinator(this)
        val executionCount = AtomicInteger(0)

        var firstStarted = false
        var secondStarted = false

        firstStarted = coordinator.tryRequestFocus {
            executionCount.incrementAndGet()
            kotlinx.coroutines.delay(1000)
            true
        }

        secondStarted = coordinator.tryRequestFocus {
            executionCount.incrementAndGet()
            true
        }

        assertTrue(firstStarted)
        assertFalse(secondStarted)

        advanceUntilIdle()
        assertEquals(1, executionCount.get())
        assertFalse(coordinator.isInFlight)
    }
}
