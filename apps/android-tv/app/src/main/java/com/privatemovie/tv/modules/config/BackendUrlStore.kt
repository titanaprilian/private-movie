package com.privatemovie.tv.modules.config

import android.content.Context
import android.content.SharedPreferences
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow

interface BackendUrlStore {
    val activeUrl: StateFlow<String>
    fun setUrl(url: String): Boolean
    fun resetToDefault()
    fun getUrl(): String
}

class SharedPreferencesBackendUrlStore(
    context: Context,
    private val defaultUrl: String = DEFAULT_URL
) : BackendUrlStore {

    private val prefs: SharedPreferences = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
    private val _activeUrl = MutableStateFlow(fetchCurrentUrl())
    override val activeUrl: StateFlow<String> = _activeUrl.asStateFlow()

    private fun fetchCurrentUrl(): String {
        return prefs.getString(KEY_BACKEND_URL, defaultUrl) ?: defaultUrl
    }

    override fun setUrl(url: String): Boolean {
        val trimmed = url.trim()
        if (trimmed.isEmpty() || !isValidUrl(trimmed)) {
            return false
        }
        prefs.edit().putString(KEY_BACKEND_URL, trimmed).apply()
        _activeUrl.value = trimmed
        return true
    }

    override fun resetToDefault() {
        prefs.edit().remove(KEY_BACKEND_URL).apply()
        _activeUrl.value = defaultUrl
    }

    override fun getUrl(): String {
        return _activeUrl.value
    }

    companion object {
        const val DEFAULT_URL = "http://10.0.2.2:3000"
        private const val PREFS_NAME = "dev_backend_config"
        private const val KEY_BACKEND_URL = "backend_api_url"

        fun isValidUrl(url: String): Boolean {
            return url.startsWith("http://") || url.startsWith("https://")
        }
    }
}

class InMemoryBackendUrlStore(
    private val defaultUrl: String = SharedPreferencesBackendUrlStore.DEFAULT_URL
) : BackendUrlStore {
    private val _activeUrl = MutableStateFlow(defaultUrl)
    override val activeUrl: StateFlow<String> = _activeUrl.asStateFlow()

    override fun setUrl(url: String): Boolean {
        val trimmed = url.trim()
        if (trimmed.isEmpty() || !SharedPreferencesBackendUrlStore.isValidUrl(trimmed)) {
            return false
        }
        _activeUrl.value = trimmed
        return true
    }

    override fun resetToDefault() {
        _activeUrl.value = defaultUrl
    }

    override fun getUrl(): String {
        return _activeUrl.value
    }
}
