package com.privatemovie.tv.modules.player

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

class PlayerContractsTest {

    @Test
    fun `PlayerNavArgs creates expected payload defaults`() {
        val navArgs = PlayerNavArgs(episodeId = "ep123")

        assertEquals("ep123", navArgs.episodeId)
        assertNull(navArgs.source)
        assertNull(navArgs.metadata)
        assertEquals(emptyList<PlaylistEpisodeItem>(), navArgs.playlist)
    }

    @Test
    fun `PlaybackMetadataHandoff retains values`() {
        val metadata = PlaybackMetadataHandoff(
            seriesTitle = "Attack on Titan",
            seasonTitle = "Season 1",
            seasonNumber = 1,
            episodeOrder = 1,
            episodeTitle = "To You, 2000 Years Later"
        )

        assertEquals("Attack on Titan", metadata.seriesTitle)
        assertEquals("Season 1", metadata.seasonTitle)
        assertEquals(1, metadata.seasonNumber)
        assertEquals(1, metadata.episodeOrder)
        assertEquals("To You, 2000 Years Later", metadata.episodeTitle)
    }

    @Test
    fun `PlaybackSourceRef retains type and url`() {
        val source = PlaybackSourceRef(type = "s3", url = "https://s3.amazonaws.com/bucket/ep1.mp4")

        assertEquals("s3", source.type)
        assertEquals("https://s3.amazonaws.com/bucket/ep1.mp4", source.url)
    }
}
