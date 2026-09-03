package com.privatemovie.tv.modules.detail

import com.privatemovie.tv.dto.models.EpisodeWithSources
import com.privatemovie.tv.dto.models.Genre
import com.privatemovie.tv.dto.models.SeasonWithEpisodes
import com.privatemovie.tv.dto.models.SeriesDetails
import com.privatemovie.tv.dto.models.VideoSource
import com.privatemovie.tv.modules.detail.internal.toTvSeriesDetails
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertTrue
import org.junit.Test

class DetailModelMappingTest {

    @Test
    fun `maps SeriesDetails with seasons and episodes correctly`() {
        val source1 = VideoSource(
            id = "src-1",
            episodeId = "ep-1",
            type = VideoSource.Type.EMBED,
            url = "https://example.com/embed/1",
            label = "Server 1",
            createdAt = "2026-01-01T00:00:00Z",
            updatedAt = "2026-01-01T00:00:00Z",
            quality = "1080p"
        )
        val source2 = VideoSource(
            id = "src-2",
            episodeId = "ep-1",
            type = VideoSource.Type.DIRECT,
            url = "https://example.com/direct/1.mp4",
            label = "Server 2",
            createdAt = "2026-01-01T00:00:00Z",
            updatedAt = "2026-01-01T00:00:00Z",
            quality = "720p"
        )

        val episode1 = EpisodeWithSources(
            id = "ep-1",
            title = "Episode 1: Dawn",
            order = 1,
            createdAt = "2026-01-01T00:00:00Z",
            updatedAt = "2026-01-01T00:00:00Z",
            videoSources = listOf(source1, source2),
            description = "First episode"
        )

        val season1 = SeasonWithEpisodes(
            id = "season-1",
            seriesId = "series-101",
            title = "Season 1",
            status = "published",
            createdAt = "2026-01-01T00:00:00Z",
            updatedAt = "2026-01-01T00:00:00Z",
            episodes = listOf(episode1),
            seasonNumber = 1
        )

        val seriesDetailsDto = SeriesDetails(
            id = "series-101",
            title = "Test Anime Series",
            type = "tv",
            isFeatured = true,
            createdAt = "2026-01-01T00:00:00Z",
            updatedAt = "2026-01-01T00:00:00Z",
            seasons = listOf(season1),
            episodes = emptyList(),
            relations = emptyList(),
            genres = listOf(Genre(id = "g1", name = "Action", slug = "action")),
            description = "An exciting series.",
            rating = "9.0"
        )

        val tvDetails = seriesDetailsDto.toTvSeriesDetails()

        assertEquals("series-101", tvDetails.id)
        assertEquals("Test Anime Series", tvDetails.title)
        assertEquals("tv", tvDetails.type)
        assertTrue(tvDetails.isFeatured)
        assertEquals("An exciting series.", tvDetails.description)
        assertEquals("9.0", tvDetails.rating)
        assertEquals(1, tvDetails.genres.size)
        assertEquals("Action", tvDetails.genres[0].name)

        assertEquals(1, tvDetails.seasons.size)
        val tvSeason = tvDetails.seasons[0]
        assertEquals("season-1", tvSeason.id)
        assertEquals("Season 1", tvSeason.title)
        assertEquals(1, tvSeason.seasonNumber)

        assertEquals(1, tvSeason.episodes.size)
        val tvEpisode = tvSeason.episodes[0]
        assertEquals("ep-1", tvEpisode.id)
        assertEquals("Episode 1: Dawn", tvEpisode.title)
        assertEquals(2, tvEpisode.videoSources.size)

        assertEquals("src-1", tvEpisode.videoSources[0].id)
        assertEquals("Server 1", tvEpisode.videoSources[0].label)
        assertEquals("embed", tvEpisode.videoSources[0].type)
        assertEquals("1080p", tvEpisode.videoSources[0].quality)

        assertEquals("src-2", tvEpisode.videoSources[1].id)
        assertEquals("Server 2", tvEpisode.videoSources[1].label)
        assertEquals("direct", tvEpisode.videoSources[1].type)
        assertEquals("720p", tvEpisode.videoSources[1].quality)
    }

    @Test
    fun `maps SeriesDetails with standalone episodes when seasons are empty`() {
        val episode = EpisodeWithSources(
            id = "ep-standalone",
            title = "Movie / OVA Episode",
            order = 1,
            createdAt = "2026-01-01T00:00:00Z",
            updatedAt = "2026-01-01T00:00:00Z",
            videoSources = emptyList()
        )

        val seriesDetailsDto = SeriesDetails(
            id = "series-movie",
            title = "Standalone Movie",
            type = "movie",
            isFeatured = false,
            createdAt = "2026-01-01T00:00:00Z",
            updatedAt = "2026-01-01T00:00:00Z",
            seasons = emptyList(),
            episodes = listOf(episode),
            relations = emptyList(),
            genres = emptyList()
        )

        val tvDetails = seriesDetailsDto.toTvSeriesDetails()

        assertTrue(tvDetails.seasons.isEmpty())
        assertEquals(1, tvDetails.standaloneEpisodes.size)
        assertEquals("ep-standalone", tvDetails.standaloneEpisodes[0].id)
    }
}
