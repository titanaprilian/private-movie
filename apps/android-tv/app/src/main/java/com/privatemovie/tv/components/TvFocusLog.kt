package com.privatemovie.tv.components

import android.util.Log
import androidx.annotation.VisibleForTesting
import com.privatemovie.tv.BuildConfig

/**
 * Dedicated debug-gated focus logger for the Android TV application.
 *
 * Emits logs under the tag prefix "TvFocus/<subtag>".
 * All logging is gated by [BuildConfig.DEBUG] so calls compile down to zero-overhead no-ops
 * in release builds.
 */
object TvFocusLog {

    @PublishedApi
    internal const val PREFIX = "TvFocus/"

    interface Logger {
        fun d(tag: String, message: String)
        fun i(tag: String, message: String)
        fun w(tag: String, message: String, throwable: Throwable? = null)
    }

    private val defaultLogger = object : Logger {
        override fun d(tag: String, message: String) {
            Log.d(tag, message)
        }

        override fun i(tag: String, message: String) {
            Log.i(tag, message)
        }

        override fun w(tag: String, message: String, throwable: Throwable?) {
            if (throwable != null) {
                Log.w(tag, message, throwable)
            } else {
                Log.w(tag, message)
            }
        }
    }

    @VisibleForTesting
    var logger: Logger = defaultLogger

    @VisibleForTesting
    var debugOverride: Boolean? = null

    @PublishedApi
    internal fun isDebugEnabled(): Boolean = debugOverride ?: BuildConfig.DEBUG

    inline fun d(subtag: String, message: () -> String) {
        if (isDebugEnabled()) {
            logger.d("$PREFIX$subtag", message())
        }
    }

    inline fun i(subtag: String, message: () -> String) {
        if (isDebugEnabled()) {
            logger.i("$PREFIX$subtag", message())
        }
    }

    inline fun w(subtag: String, throwable: Throwable? = null, message: () -> String) {
        if (isDebugEnabled()) {
            logger.w("$PREFIX$subtag", message(), throwable)
        }
    }

    inline fun w(subtag: String, message: () -> String) {
        w(subtag, null, message)
    }
}
