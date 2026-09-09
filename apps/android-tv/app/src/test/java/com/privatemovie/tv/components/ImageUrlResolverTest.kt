package com.privatemovie.tv.components

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

class ImageUrlResolverTest {

    @Test
    fun `resolve returns null for null or blank input`() {
        assertNull(ImageUrlResolver.resolve(null, "http://localhost:3000"))
        assertNull(ImageUrlResolver.resolve("", "http://localhost:3000"))
        assertNull(ImageUrlResolver.resolve("   ", "http://localhost:3000"))
    }

    @Test
    fun `resolve returns rawUrl directly if absolute http or https`() {
        assertEquals(
            "https://example.com/poster.jpg",
            ImageUrlResolver.resolve("https://example.com/poster.jpg", "http://localhost:3000")
        )
        assertEquals(
            "http://cdn.example.com/images/banner.png",
            ImageUrlResolver.resolve("http://cdn.example.com/images/banner.png", "http://localhost:3000")
        )
        assertEquals(
            "HTTPS://CAPS.EXAMPLE.COM/IMG.PNG",
            ImageUrlResolver.resolve("HTTPS://CAPS.EXAMPLE.COM/IMG.PNG", null)
        )
    }

    @Test
    fun `resolve prepends active backend URL for relative paths`() {
        assertEquals(
            "http://10.0.2.2:3000/storage/posters/series1.jpg",
            ImageUrlResolver.resolve("/storage/posters/series1.jpg", "http://10.0.2.2:3000")
        )
        assertEquals(
            "http://10.0.2.2:3000/storage/posters/series1.jpg",
            ImageUrlResolver.resolve("/storage/posters/series1.jpg", "http://10.0.2.2:3000/")
        )
        assertEquals(
            "http://10.0.2.2:3000/storage/posters/series1.jpg",
            ImageUrlResolver.resolve("storage/posters/series1.jpg", "http://10.0.2.2:3000")
        )
    }

    @Test
    fun `resolve handles whitespace in inputs gracefully`() {
        assertEquals(
            "http://10.0.2.2:3000/media/thumb.png",
            ImageUrlResolver.resolve("  /media/thumb.png  ", "  http://10.0.2.2:3000/  ")
        )
    }

    @Test
    fun `resolve handles missing baseUrl for relative path`() {
        assertEquals(
            "/storage/posters/series1.jpg",
            ImageUrlResolver.resolve("/storage/posters/series1.jpg", null)
        )
        assertEquals(
            "/storage/posters/series1.jpg",
            ImageUrlResolver.resolve("storage/posters/series1.jpg", "")
        )
    }
}
