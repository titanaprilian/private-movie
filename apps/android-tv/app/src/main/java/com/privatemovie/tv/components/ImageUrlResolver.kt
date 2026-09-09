package com.privatemovie.tv.components

object ImageUrlResolver {
    /**
     * Resolves a raw image URL string into a fully-qualified URL.
     *
     * - Returns null if rawUrl is null, empty, or blank.
     * - Returns rawUrl (trimmed) if it is already an absolute URL (starts with http:// or https://).
     * - If rawUrl is a relative path, prepends [baseUrl] (trimmed, without trailing slash).
     * - If baseUrl is null or blank, relative paths starting with "/" are preserved.
     */
    fun resolve(rawUrl: String?, baseUrl: String? = null): String? {
        val trimmedRaw = rawUrl?.trim()
        if (trimmedRaw.isNullOrEmpty()) {
            return null
        }

        if (trimmedRaw.startsWith("http://", ignoreCase = true) ||
            trimmedRaw.startsWith("https://", ignoreCase = true)
        ) {
            return trimmedRaw
        }

        val sanitizedBaseUrl = baseUrl?.trim()?.trimEnd('/')
        val relativePath = if (trimmedRaw.startsWith("/")) trimmedRaw else "/$trimmedRaw"

        if (sanitizedBaseUrl.isNullOrEmpty()) {
            return relativePath
        }

        return "$sanitizedBaseUrl$relativePath"
    }
}
