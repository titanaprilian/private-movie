package com.privatemovie.tv.modules.player

import com.privatemovie.tv.modules.player.PlaybackCompletionDecision
import com.privatemovie.tv.modules.player.PlaylistEpisodeItem
import com.privatemovie.tv.modules.player.internal.onPlaybackEnded
import com.privatemovie.tv.modules.player.internal.resolvePlaylistNeighbors
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class PlaylistNavigationTest {

    private val testPlaylist = listOf(
        PlaylistEpisodeItem(
            episodeId = "ep-1",
            seriesTitle = "Demon Slayer",
            seasonTitle = "Season 1",
            seasonNumber = 1,
            episodeOrder = 1,
            episodeTitle = "Cruelty",
            sourceTypeName = "direct",
            sourceUrl = "https://cdn.example.com/ep1.mp4"
        ),
        PlaylistEpisodeItem(
            episodeId = "ep-2",
            seriesTitle = "Demon Slayer",
            seasonTitle = "Season 1",
            seasonNumber = 1,
            episodeOrder = 2,
            episodeTitle = "Trainer Sakonji Urokodaki",
            sourceTypeName = "direct",
            sourceUrl = "https://cdn.example.com/ep2.mp4"
        ),
        PlaylistEpisodeItem(
            episodeId = "ep-3",
            seriesTitle = "Demon Slayer",
            seasonTitle = "Season 1",
            seasonNumber = 1,
            episodeOrder = 3,
            episodeTitle = "Sabito and Makomo",
            sourceTypeName = "direct",
            sourceUrl = "https://cdn.example.com/ep3.mp4"
        )
    )

    @Test
    fun `first episode has no previous but has next`() {
        val neighbors = resolvePlaylistNeighbors(testPlaylist, "ep-1")
        assertFalse(neighbors.hasPrevious)
        assertNull(neighbors.previousEpisode)
        assertEquals("ep-1", neighbors.currentEpisode?.episodeId)
        assertTrue(neighbors.hasNext)
        assertEquals("ep-2", neighbors.nextEpisode?.episodeId)
    }

    @Test
    fun `middle episode has both previous and next`() {
        val neighbors = resolvePlaylistNeighbors(testPlaylist, "ep-2")
        assertTrue(neighbors.hasPrevious)
        assertEquals("ep-1", neighbors.previousEpisode?.episodeId)
        assertEquals("ep-2", neighbors.currentEpisode?.episodeId)
        assertTrue(neighbors.hasNext)
        assertEquals("ep-3", neighbors.nextEpisode?.episodeId)
    }

    @Test
    fun `last episode has previous but no next`() {
        val neighbors = resolvePlaylistNeighbors(testPlaylist, "ep-3")
        assertTrue(neighbors.hasPrevious)
        assertEquals("ep-2", neighbors.previousEpisode?.episodeId)
        assertEquals("ep-3", neighbors.currentEpisode?.episodeId)
        assertFalse(neighbors.hasNext)
        assertNull(neighbors.nextEpisode)
    }

    @Test
    fun `unknown episode returns empty neighbors`() {
        val neighbors = resolvePlaylistNeighbors(testPlaylist, "unknown-id")
        assertFalse(neighbors.hasPrevious)
        assertFalse(neighbors.hasNext)
        assertNull(neighbors.currentEpisode)
    }

    @Test
    fun `end of stream advances when next is available and exits when terminal`() {
        val middleNeighbors = resolvePlaylistNeighbors(testPlaylist, "ep-2")
        assertEquals(PlaybackCompletionDecision.AdvanceToNext, onPlaybackEnded(middleNeighbors.hasNext))

        val lastNeighbors = resolvePlaylistNeighbors(testPlaylist, "ep-3")
        assertEquals(PlaybackCompletionDecision.ExitPlayer, onPlaybackEnded(lastNeighbors.hasNext))
    }
}
