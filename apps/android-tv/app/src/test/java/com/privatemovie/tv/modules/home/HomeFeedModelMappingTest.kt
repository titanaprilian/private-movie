package com.privatemovie.tv.modules.home

import com.privatemovie.tv.dto.models.Genre
import com.privatemovie.tv.dto.models.HomeFeed
import com.privatemovie.tv.dto.models.HomeFeedHero
import com.privatemovie.tv.dto.models.HomeFeedRow
import com.privatemovie.tv.dto.models.SeriesMetadata
import com.privatemovie.tv.modules.home.internal.toTvHomeFeed
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Test

class HomeFeedModelMappingTest {

    @Test
    fun mapsHomeFeedDtoToTvHomeFeedModel() {
        val heroDto = HomeFeedHero(
            id = "hero-1",
            title = "Hero Title",
            type = "tv",
            isFeatured = true,
            createdAt = "2026-01-01T00:00:00.000Z",
            updatedAt = "2026-01-01T00:00:00.000Z",
            genres = listOf(Genre(id = "g-1", name = "Action", slug = "action")),
            seasonsCount = 2,
            episodesCount = 24,
            tags = listOf("TV Series", "Action"),
            description = "Hero Description",
            posterUrl = "https://example.com/poster.jpg",
            backdropUrl = "https://example.com/backdrop.jpg",
            rating = "8.5"
        )

        val seriesDto = SeriesMetadata(
            id = "series-1",
            title = "Series 1 Title",
            type = "tv",
            isFeatured = false,
            createdAt = "2026-01-01T00:00:00.000Z",
            updatedAt = "2026-01-01T00:00:00.000Z",
            genres = emptyList(),
            seasonsCount = 1,
            episodesCount = 12
        )

        val homeFeedDto = HomeFeed(
            hero = heroDto,
            rows = listOf(
                HomeFeedRow(
                    title = "Ongoing",
                    items = listOf(seriesDto)
                )
            )
        )

        val tvHomeFeed = homeFeedDto.toTvHomeFeed()

        assertNotNull(tvHomeFeed.hero)
        assertEquals("hero-1", tvHomeFeed.hero?.series?.id)
        assertEquals("Hero Title", tvHomeFeed.hero?.series?.title)
        assertEquals(listOf("TV Series", "Action"), tvHomeFeed.hero?.tags)
        assertEquals("Action", tvHomeFeed.hero?.series?.genres?.first()?.name)

        assertEquals(1, tvHomeFeed.rows.size)
        assertEquals("Ongoing", tvHomeFeed.rows[0].title)
        assertEquals("series-1", tvHomeFeed.rows[0].items[0].id)
    }

    @Test
    fun mapsNullHeroFeedToTvHomeFeedModel() {
        val homeFeedDto = HomeFeed(
            hero = null,
            rows = listOf(
                HomeFeedRow(title = "Recently Added", items = emptyList())
            )
        )

        val tvHomeFeed = homeFeedDto.toTvHomeFeed()

        assertNull(tvHomeFeed.hero)
        assertEquals(1, tvHomeFeed.rows.size)
        assertEquals("Recently Added", tvHomeFeed.rows[0].title)
    }
}
