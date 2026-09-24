package com.privatemovie.tv.modules.player

import androidx.lifecycle.SavedStateHandle
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test
import java.io.Serializable

class PlayerNavArgsSavedStateTest {

    private fun fullPayload() = PlayerNavArgs(
        episodeId = "episode-108",
        source = PlaybackSourceRef(type = "embed", url = "/embed/abc123"),
        metadata = PlaybackMetadataHandoff(
            seriesTitle = "Demon Slayer",
            seasonTitle = "Season 1",
            seasonNumber = 1,
            episodeOrder = 8,
            episodeTitle = "Episode 8"
        ),
        playlist = listOf(
            PlaylistEpisodeItem(
                episodeId = "episode-107",
                seriesTitle = "Demon Slayer",
                seasonTitle = "Season 1",
                seasonNumber = 1,
                episodeOrder = 7,
                episodeTitle = "Episode 7",
                sourceTypeName = "embed",
                sourceUrl = "/embed/aaa111"
            ),
            PlaylistEpisodeItem(
                episodeId = "episode-108",
                seriesTitle = "Demon Slayer",
                seasonTitle = "Season 1",
                seasonNumber = 1,
                episodeOrder = 8,
                episodeTitle = "Episode 8",
                sourceTypeName = "embed",
                sourceUrl = "/embed/abc123"
            )
        )
    )

    @Test
    fun `nav arg types implement java io Serializable`() {
        assertTrue(fullPayload() is Serializable)
        assertTrue(PlaybackSourceRef("embed", "/embed/x") is Serializable)
        assertTrue(PlaybackMetadataHandoff(seriesTitle = "S") is Serializable)
        assertTrue(PlaylistEpisodeItem(episodeId = "ep1") is Serializable)
    }

    @Test
    fun `SavedStateHandle stores and retrieves complete PlayerNavArgs payload`() {
        val handle = SavedStateHandle()
        val args = fullPayload()

        // Regression: must not throw
        // IllegalArgumentException: Can't put value with type class PlayerNavArgs
        // into saved state.
        handle.set(PLAYER_NAV_ARGS_KEY, args)

        val restored: PlayerNavArgs? = handle.get(PLAYER_NAV_ARGS_KEY)
        assertEquals(args, restored)
        assertEquals("episode-108", restored?.episodeId)
        assertEquals("embed", restored?.source?.type)
        assertEquals("/embed/abc123", restored?.source?.url)
        assertEquals("Demon Slayer", restored?.metadata?.seriesTitle)
        assertEquals(2, restored?.playlist?.size)
        assertEquals("episode-107", restored?.playlist?.get(0)?.episodeId)
    }

    @Test
    fun `SavedStateHandle round-trips minimal PlayerNavArgs with nulls and empty playlist`() {
        val handle = SavedStateHandle()
        val args = PlayerNavArgs(episodeId = "episode-109")

        handle.set(PLAYER_NAV_ARGS_KEY, args)

        val restored: PlayerNavArgs? = handle.get(PLAYER_NAV_ARGS_KEY)
        assertEquals(args, restored)
        assertEquals("episode-109", restored?.episodeId)
        assertEquals(null, restored?.source)
        assertEquals(null, restored?.metadata)
        assertEquals(emptyList<PlaylistEpisodeItem>(), restored?.playlist)
    }
}
