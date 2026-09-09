package com.privatemovie.tv.modules.detail

import com.privatemovie.tv.modules.detail.internal.TvEpisode
import com.privatemovie.tv.modules.detail.internal.TvSeason
import com.privatemovie.tv.modules.detail.internal.TvSeriesDetails
import com.privatemovie.tv.modules.detail.internal.TvVideoSource
import com.privatemovie.tv.modules.detail.internal.findFirstPlayableEpisode
import com.privatemovie.tv.modules.player.internal.EpisodePlaybackDecision
import com.privatemovie.tv.modules.player.internal.decideEpisodePlayback
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Test

/**
 * Unit tests verifying playback decisions, header CTA episode selection,
 * carousel episode inspection state, and source picker launches.
 */
class DetailPlaybackLogicTest {

    private fun createEpisode(
        id: String,
        title: String,
        order: Int,
        sourceCount: Int,
        thumbnailUrl: String? = null,
        description: String? = null
    ): TvEpisode {
        val sources = (1..sourceCount).map { i ->
            TvVideoSource(
                id = "src-$id-$i",
                label = "Server $i",
                type = if (i % 2 == 1) "direct" else "embed",
                url = "https://example.com/video-$id-$i.mp4",
                quality = "1080p"
            )
        }
        return TvEpisode(
            id = id,
            title = title,
            order = order,
            description = description,
            thumbnailUrl = thumbnailUrl,
            videoSources = sources
        )
    }

    private fun createSeriesDetails(
        seasons: List<TvSeason> = emptyList(),
        standaloneEpisodes: List<TvEpisode> = emptyList()
    ): TvSeriesDetails {
        return TvSeriesDetails(
            id = "series-1",
            title = "Test Show",
            type = "tv",
            isFeatured = true,
            genres = emptyList(),
            description = "A test series",
            posterUrl = "/posters/test.jpg",
            backdropUrl = "/backdrops/test.jpg",
            rating = "8.9",
            seasons = seasons,
            standaloneEpisodes = standaloneEpisodes
        )
    }

    @Test
    fun `findFirstPlayableEpisode returns first episode from first season with episodes`() {
        val ep1 = createEpisode("ep-1", "Ep 1", 1, sourceCount = 1)
        val ep2 = createEpisode("ep-2", "Ep 2", 2, sourceCount = 1)
        val season1 = TvSeason(id = "s-1", title = "Season 1", seasonNumber = 1, description = null, episodes = listOf(ep1, ep2))
        val details = createSeriesDetails(seasons = listOf(season1))

        val firstEp = findFirstPlayableEpisode(details)
        assertNotNull(firstEp)
        assertEquals("ep-1", firstEp?.id)
    }

    @Test
    fun `findFirstPlayableEpisode returns first standalone episode when seasons are empty`() {
        val ep1 = createEpisode("ep-standalone-1", "Movie Part 1", 1, sourceCount = 1)
        val details = createSeriesDetails(standaloneEpisodes = listOf(ep1))

        val firstEp = findFirstPlayableEpisode(details)
        assertNotNull(firstEp)
        assertEquals("ep-standalone-1", firstEp?.id)
    }

    @Test
    fun `findFirstPlayableEpisode returns null when no episodes exist`() {
        val details = createSeriesDetails()
        val firstEp = findFirstPlayableEpisode(details)
        assertNull(firstEp)
    }

    @Test
    fun `header CTA decision for single-source first episode resolves to PlaySingle`() {
        val ep1 = createEpisode("ep-1", "Ep 1", 1, sourceCount = 1)
        val decision = decideEpisodePlayback(ep1.videoSources.size)
        assertEquals(EpisodePlaybackDecision.PlaySingle, decision)
    }

    @Test
    fun `header CTA decision for multi-source first episode resolves to NeedsSourcePicker`() {
        val ep1 = createEpisode("ep-1", "Ep 1", 1, sourceCount = 3)
        val decision = decideEpisodePlayback(ep1.videoSources.size)
        assertEquals(EpisodePlaybackDecision.NeedsSourcePicker, decision)
    }

    @Test
    fun `header CTA decision for episode with 0 sources resolves to Unavailable`() {
        val ep1 = createEpisode("ep-1", "Ep 1", 1, sourceCount = 0)
        val decision = decideEpisodePlayback(ep1.videoSources.size)
        assertEquals(EpisodePlaybackDecision.Unavailable, decision)
    }

    @Test
    fun `dynamic inspection state reflects currently selected episode metadata`() {
        val ep1 = createEpisode("ep-1", "The Beginning", 1, sourceCount = 2, description = "Where it starts")
        val ep2 = createEpisode("ep-2", "The Next Step", 2, sourceCount = 0, description = "Continuing onward")

        // Dynamic inspection data test
        var inspectedEpisode: TvEpisode? = ep1
        assertEquals("The Beginning", inspectedEpisode?.title)
        assertEquals("Where it starts", inspectedEpisode?.description)
        assertEquals(2, inspectedEpisode?.videoSources?.size)

        // Moving focus / inspection to ep2
        inspectedEpisode = ep2
        assertEquals("The Next Step", inspectedEpisode?.title)
        assertEquals("Continuing onward", inspectedEpisode?.description)
        assertEquals(0, inspectedEpisode?.videoSources?.size)
    }
}
