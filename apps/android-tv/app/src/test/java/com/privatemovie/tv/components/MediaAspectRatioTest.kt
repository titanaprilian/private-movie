package com.privatemovie.tv.components

import org.junit.Assert.assertEquals
import org.junit.Test

class MediaAspectRatioTest {

    @Test
    fun `aspect ratio values match expected specifications`() {
        assertEquals(2f / 3f, MediaAspectRatio.POSTER.ratio, 0.0001f)
        assertEquals(16f / 9f, MediaAspectRatio.THUMBNAIL.ratio, 0.0001f)
        assertEquals(16f / 9f, MediaAspectRatio.BACKDROP.ratio, 0.0001f)
    }
}
