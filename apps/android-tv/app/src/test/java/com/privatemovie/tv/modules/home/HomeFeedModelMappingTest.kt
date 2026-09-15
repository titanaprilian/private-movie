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
        assertEquals("https://example.com/poster.jpg", tvHomeFeed.hero?.series?.posterUrl)
        assertEquals("https://example.com/backdrop.jpg", tvHomeFeed.hero?.series?.backdropUrl)
        assertEquals("8.5", tvHomeFeed.hero?.series?.rating)
        assertEquals("Hero Description", tvHomeFeed.hero?.series?.description)

        assertEquals(1, tvHomeFeed.rows.size)
        assertEquals("Ongoing", tvHomeFeed.rows[0].title)
        assertEquals("series-1", tvHomeFeed.rows[0].items[0].id)
        assertEquals("Series 1 Title", tvHomeFeed.rows[0].items[0].title)
        assertEquals("tv", tvHomeFeed.rows[0].items[0].type)
        assertNull(tvHomeFeed.rows[0].items[0].posterUrl)
        assertNull(tvHomeFeed.rows[0].items[0].backdropUrl)
        assertNull(tvHomeFeed.rows[0].items[0].rating)
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
        assertEquals(emptyList<Any>(), tvHomeFeed.heroes)
    }

    @Test
    fun mapsHeroFeedWithHeroesList() {
        val hero1 = HomeFeedHero(
            id = "hero-1",
            title = "Hero 1",
            type = "series",
            isFeatured = true,
            createdAt = "2026-01-01T00:00:00.000Z",
            updatedAt = "2026-01-01T00:00:00.000Z",
            genres = listOf(Genre(id = "g-1", name = "Action", slug = "action")),
            seasonsCount = 1,
            episodesCount = 10,
            tags = listOf("Action"),
            logoUrl = "https://example.com/logo1.png"
        )
        val hero2 = HomeFeedHero(
            id = "hero-2",
            title = "Hero 2",
            type = "series",
            isFeatured = false,
            createdAt = "2026-01-01T00:00:00.000Z",
            updatedAt = "2026-01-01T00:00:00.000Z",
            genres = listOf(Genre(id = "g-2", name = "Drama", slug = "drama")),
            seasonsCount = 2,
            episodesCount = 20,
            tags = listOf("Drama"),
            logoUrl = null
        )

        val homeFeedDto = HomeFeed(
            hero = hero1,
            heroes = listOf(hero1, hero2),
            rows = emptyList()
        )

        val tvHomeFeed = homeFeedDto.toTvHomeFeed()

        assertEquals(2, tvHomeFeed.heroes.size)
        assertEquals("hero-1", tvHomeFeed.heroes[0].series.id)
        assertEquals("Hero 1", tvHomeFeed.heroes[0].series.title)
        assertEquals("https://example.com/logo1.png", tvHomeFeed.heroes[0].series.logoUrl)
        assertEquals("hero-2", tvHomeFeed.heroes[1].series.id)
        assertEquals("Hero 2", tvHomeFeed.heroes[1].series.title)
        assertNull(tvHomeFeed.heroes[1].series.logoUrl)
    }

    @Test
    fun preservesLogoUrlThroughMapping() {
        val heroDto = HomeFeedHero(
            id = "hero-logo",
            title = "Logo Show",
            type = "series",
            isFeatured = true,
            createdAt = "2026-01-01T00:00:00.000Z",
            updatedAt = "2026-01-01T00:00:00.000Z",
            genres = emptyList(),
            seasonsCount = 1,
            episodesCount = 10,
            tags = emptyList(),
            logoUrl = "https://example.com/logo.png"
        )

        val seriesDto = SeriesMetadata(
            id = "series-logo",
            title = "Series Logo Show",
            type = "series",
            isFeatured = false,
            createdAt = "2026-01-01T00:00:00.000Z",
            updatedAt = "2026-01-01T00:00:00.000Z",
            genres = emptyList(),
            seasonsCount = 1,
            episodesCount = 10,
            logoUrl = "https://example.com/series-logo.png"
        )

        val homeFeedDto = HomeFeed(
            hero = heroDto,
            rows = listOf(HomeFeedRow(title = "Test", items = listOf(seriesDto)))
        )

        val tvHomeFeed = homeFeedDto.toTvHomeFeed()

        assertEquals("https://example.com/logo.png", tvHomeFeed.hero?.series?.logoUrl)
        assertEquals("https://example.com/series-logo.png", tvHomeFeed.rows[0].items[0].logoUrl)
    }

    @Test
    fun fallbackWhenHeroesAbsentButHeroPresent() {
        val heroDto = HomeFeedHero(
            id = "hero-only",
            title = "Only Hero",
            type = "series",
            isFeatured = true,
            createdAt = "2026-01-01T00:00:00.000Z",
            updatedAt = "2026-01-01T00:00:00.000Z",
            genres = emptyList(),
            seasonsCount = 1,
            episodesCount = 10,
            tags = emptyList()
        )

        val homeFeedDto = HomeFeed(
            hero = heroDto,
            heroes = null,
            rows = emptyList()
        )

        val tvHomeFeed = homeFeedDto.toTvHomeFeed()

        assertNotNull(tvHomeFeed.hero)
        assertEquals("hero-only", tvHomeFeed.hero?.series?.id)
        assertEquals(0, tvHomeFeed.heroes.size)
    }

    @Test
    fun mapsSingleHeroCorrectly() {
        val heroDto = HomeFeedHero(
            id = "single-hero",
            title = "Single Hero",
            type = "series",
            isFeatured = true,
            createdAt = "2026-01-01T00:00:00.000Z",
            updatedAt = "2026-01-01T00:00:00.000Z",
            genres = listOf(Genre(id = "g-1", name = "Sci-Fi", slug = "sci-fi")),
            seasonsCount = 3,
            episodesCount = 30,
            tags = listOf("Sci-Fi", "Action"),
            description = "Single Hero Description",
            posterUrl = "https://example.com/single-poster.jpg",
            backdropUrl = "https://example.com/single-backdrop.jpg",
            logoUrl = "https://example.com/single-logo.png",
            rating = "TV-14"
        )

        val homeFeedDto = HomeFeed(
            hero = heroDto,
            heroes = listOf(heroDto),
            rows = emptyList()
        )

        val tvHomeFeed = homeFeedDto.toTvHomeFeed()

        assertEquals(1, tvHomeFeed.heroes.size)
        val mappedHero = tvHomeFeed.heroes[0]
        assertEquals("single-hero", mappedHero.series.id)
        assertEquals("Single Hero", mappedHero.series.title)
        assertEquals("Single Hero Description", mappedHero.series.description)
        assertEquals("series", mappedHero.series.type)
        assertEquals("https://example.com/single-poster.jpg", mappedHero.series.posterUrl)
        assertEquals("https://example.com/single-backdrop.jpg", mappedHero.series.backdropUrl)
        assertEquals("https://example.com/single-logo.png", mappedHero.series.logoUrl)
        assertEquals("TV-14", mappedHero.series.rating)
        assertEquals(true, mappedHero.series.isFeatured)
        assertEquals(1, mappedHero.series.genres.size)
        assertEquals("Sci-Fi", mappedHero.series.genres[0].name)
        assertEquals(3, mappedHero.series.seasonsCount)
        assertEquals(30, mappedHero.series.episodesCount)
        assertEquals(listOf("Sci-Fi", "Action"), mappedHero.tags)
    }
}
