package com.privatemovie.tv.components

import com.privatemovie.tv.BuildConfig
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test

class TvFocusLogTest {

    private val loggedEntries = mutableListOf<LogEntry>()

    private data class LogEntry(
        val priority: String,
        val tag: String,
        val message: String,
        val throwable: Throwable? = null
    )

    @Before
    fun setUp() {
        loggedEntries.clear()
        TvFocusLog.logger = object : TvFocusLog.Logger {
            override fun d(tag: String, message: String) {
                loggedEntries.add(LogEntry("d", tag, message))
            }

            override fun i(tag: String, message: String) {
                loggedEntries.add(LogEntry("i", tag, message))
            }

            override fun w(tag: String, message: String, throwable: Throwable?) {
                loggedEntries.add(LogEntry("w", tag, message, throwable))
            }
        }
    }

    @Test
    fun `tag format strictly follows TvFocus slash subtag`() {
        TvFocusLog.debugOverride = true

        TvFocusLog.d("Acquisition") { "Debug message" }
        TvFocusLog.i("Navigation") { "Info message" }
        val testException = RuntimeException("Boom")
        TvFocusLog.w("Fallback", testException) { "Warning message" }
        TvFocusLog.w("Retries") { "Warning without throwable" }

        assertEquals(4, loggedEntries.size)
        assertEquals("TvFocus/Acquisition", loggedEntries[0].tag)
        assertEquals("Debug message", loggedEntries[0].message)
        assertEquals("d", loggedEntries[0].priority)

        assertEquals("TvFocus/Navigation", loggedEntries[1].tag)
        assertEquals("Info message", loggedEntries[1].message)
        assertEquals("i", loggedEntries[1].priority)

        assertEquals("TvFocus/Fallback", loggedEntries[2].tag)
        assertEquals("Warning message", loggedEntries[2].message)
        assertEquals("w", loggedEntries[2].priority)
        assertEquals(testException, loggedEntries[2].throwable)

        assertEquals("TvFocus/Retries", loggedEntries[3].tag)
        assertEquals("Warning without throwable", loggedEntries[3].message)
        assertEquals("w", loggedEntries[3].priority)
        assertEquals(null, loggedEntries[3].throwable)
    }

    @Test
    fun `logging is suppressed when debug is false and lambda is not evaluated`() {
        TvFocusLog.debugOverride = false
        var lambdaEvaluated = false

        TvFocusLog.d("Test") {
            lambdaEvaluated = true
            "Evaluated"
        }
        TvFocusLog.i("Test") {
            lambdaEvaluated = true
            "Evaluated"
        }
        val testException = RuntimeException("Boom")
        TvFocusLog.w("Test", testException) {
            lambdaEvaluated = true
            "Evaluated"
        }
        TvFocusLog.w("Test") {
            lambdaEvaluated = true
            "Evaluated"
        }

        assertFalse(lambdaEvaluated)
        assertTrue(loggedEntries.isEmpty())
    }

    @Test
    fun `default debug gate reflects BuildConfig DEBUG`() {
        TvFocusLog.debugOverride = null
        assertEquals(BuildConfig.DEBUG, TvFocusLog.isDebugEnabled())
    }
}
