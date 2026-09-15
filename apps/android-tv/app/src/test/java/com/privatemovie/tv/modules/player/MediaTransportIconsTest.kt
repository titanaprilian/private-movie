package com.privatemovie.tv.modules.player

import com.privatemovie.tv.components.MediaPlaceholderIcons
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Test

class MediaTransportIconsTest {

    @Test
    fun `media playback icons are initialized and valid`() {
        assertNotNull(MediaPlaceholderIcons.Play)
        assertEquals("PlayIcon", MediaPlaceholderIcons.Play.name)

        assertNotNull(MediaPlaceholderIcons.Pause)
        assertEquals("PauseIcon", MediaPlaceholderIcons.Pause.name)

        assertNotNull(MediaPlaceholderIcons.SkipPrevious)
        assertEquals("SkipPreviousIcon", MediaPlaceholderIcons.SkipPrevious.name)

        assertNotNull(MediaPlaceholderIcons.SkipNext)
        assertEquals("SkipNextIcon", MediaPlaceholderIcons.SkipNext.name)
    }
}
