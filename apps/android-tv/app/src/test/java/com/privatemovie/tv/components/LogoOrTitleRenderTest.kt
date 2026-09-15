package com.privatemovie.tv.components

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

class LogoOrTitleRenderTest {

    @Test
    fun resolvesValidLogoUrlWithBaseUrl() {
        val resolved = ImageUrlResolver.resolve("/uploads/logo.png", "https://api.example.com")
        assertEquals("https://api.example.com/uploads/logo.png", resolved)
    }

    @Test
    fun resolvesAbsoluteLogoUrlUnchanged() {
        val resolved = ImageUrlResolver.resolve("https://cdn.example.com/logo.png", "https://api.example.com")
        assertEquals("https://cdn.example.com/logo.png", resolved)
    }

    @Test
    fun returnsNullForNullOrBlankLogoUrl() {
        assertNull(ImageUrlResolver.resolve(null, "https://api.example.com"))
        assertNull(ImageUrlResolver.resolve("", "https://api.example.com"))
        assertNull(ImageUrlResolver.resolve("   ", "https://api.example.com"))
    }
}
