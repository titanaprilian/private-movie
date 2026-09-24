package com.privatemovie.tv.navigation

import androidx.lifecycle.SavedStateHandle
import com.privatemovie.tv.modules.player.PLAYER_NAV_ARGS_KEY
import com.privatemovie.tv.modules.player.PlaybackMetadataHandoff
import com.privatemovie.tv.modules.player.PlaybackSourceRef
import com.privatemovie.tv.modules.player.PlayerNavArgs
import com.privatemovie.tv.modules.player.PlaylistEpisodeItem
import org.junit.Assert.assertEquals
import org.junit.Test

class PlayerNavArgsNavigationTest {

    @Test
    fun `Detail to Player handoff survives SavedStateHandle round-trip with source metadata and playlist`() {
        // Simulates AppNavigation onPlayNavArgs: Detail writes to its
        // savedStateHandle, Player reads from previousBackStackEntry.
        val previousEntryHandle = SavedStateHandle()
        val args = PlayerNavArgs(
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
                PlaylistEpisodeItem(episodeId = "episode-107", episodeTitle = "Episode 7"),
                PlaylistEpisodeItem(episodeId = "episode-108", episodeTitle = "Episode 8")
            )
        )

        previousEntryHandle.set(PLAYER_NAV_ARGS_KEY, args)

        val restored: PlayerNavArgs? = previousEntryHandle.get(PLAYER_NAV_ARGS_KEY)
        assertEquals(args, restored)
        assertEquals("episode-108", restored?.episodeId)
        assertEquals("embed", restored?.source?.type)
        assertEquals("Demon Slayer", restored?.metadata?.seriesTitle)
        assertEquals(2, restored?.playlist?.size)
    }
}
