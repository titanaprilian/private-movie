package com.privatemovie.tv.components

import android.util.Log
import androidx.compose.runtime.withFrameNanos
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.input.key.KeyEvent
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Deferred
import kotlinx.coroutines.Job
import kotlinx.coroutines.async
import kotlinx.coroutines.launch

private const val TAG = "SafeFocusUtils"

/**
 * Checks if the given Compose [KeyEvent] is a hardware key repeat (repeatCount > 0).
 */
fun isRepeatKeyEvent(keyEvent: KeyEvent, overrideRepeatCount: Int? = null): Boolean {
    val count = overrideRepeatCount ?: keyEvent.nativeKeyEvent.repeatCount
    return count > 0
}

/**
 * Attempts focus acquisition without throwing unhandled exceptions if the target focus node
 * is unattached/uninitialized, retrying across consecutive frames up to [maxRetries].
 *
 * @param focusRequester Target focus requester to focus.
 * @param maxRetries Maximum number of frame retries allowed. Default is 5 frames (~83ms at 60fps).
 * @param rawRequest Lambda performing the raw focus request. Defaults to `focusRequester.requestFocus()`.
 * @return True if focus was successfully requested, false if retries were exhausted.
 */
suspend fun requestFocusSafely(
    focusRequester: FocusRequester,
    maxRetries: Int = 5,
    rawRequest: () -> Boolean = {
        try {
            focusRequester.requestFocus()
            true
        } catch (e: IllegalStateException) {
            false
        } catch (e: Exception) {
            Log.w(TAG, "Unexpected exception during focus request", e)
            false
        }
    }
): Boolean {
    var retries = 0
    while (retries < maxRetries) {
        try {
            val success = rawRequest()
            if (success) {
                return true
            }
        } catch (e: Exception) {
            Log.d(TAG, "Focus request attempt $retries failed: ${e.message}")
        }
        retries++
        if (retries < maxRetries) {
            try {
                withFrameNanos { }
            } catch (e: IllegalStateException) {
                // MonotonicFrameClock not available in current CoroutineContext (e.g. standard unit test environment)
                kotlinx.coroutines.yield()
            }
        }
    }

    Log.w(TAG, "Focus request retries exhausted after $maxRetries frames; target focus node was not attached.")
    return false
}

/**
 * Asynchronous helper for [requestFocusSafely] launching in a scope and returning a [Deferred<Boolean>].
 */
fun CoroutineScope.requestFocusSafelyAsync(
    focusRequester: FocusRequester,
    maxRetries: Int = 5,
    rawRequest: () -> Boolean = {
        try {
            focusRequester.requestFocus()
            true
        } catch (e: IllegalStateException) {
            false
        } catch (e: Exception) {
            Log.w(TAG, "Unexpected exception during focus request", e)
            false
        }
    }
): Deferred<Boolean> = async {
    requestFocusSafely(focusRequester, maxRetries, rawRequest)
}

/**
 * Focus transition coordinator that guards against concurrent in-flight transition requests.
 */
class FocusTransitionCoordinator(
    private val scope: CoroutineScope
) {
    private var activeJob: Job? = null

    val isInFlight: Boolean
        get() = activeJob?.isActive == true

    /**
     * Attempts to execute a focus transition request. Rejects the request if a transition is already in flight.
     *
     * @param block Transition block to run.
     * @return True if the transition was initiated, false if ignored due to an active transition in flight.
     */
    fun tryRequestFocus(block: suspend () -> Boolean): Boolean {
        if (isInFlight) {
            Log.d(TAG, "Ignoring focus transition request: transition already in flight.")
            return false
        }

        activeJob = scope.launch {
            try {
                block()
            } catch (e: Exception) {
                Log.w(TAG, "Exception during focus transition block", e)
            }
        }

        return true
    }
}
