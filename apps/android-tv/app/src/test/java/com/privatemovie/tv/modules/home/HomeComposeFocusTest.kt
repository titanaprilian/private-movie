package com.privatemovie.tv.modules.home

import androidx.compose.ui.test.assertIsFocused
import androidx.compose.ui.test.hasClickAction
import androidx.compose.ui.test.hasText
import androidx.compose.ui.test.junit4.createComposeRule
import com.privatemovie.tv.data.repository.MediaRepository
import com.privatemovie.tv.dto.models.HomeFeed
import com.privatemovie.tv.dto.models.HomeFeedHero
import com.privatemovie.tv.dto.models.HomeFeedRow
import com.privatemovie.tv.dto.models.RecentlyAddedEpisodeDto
import com.privatemovie.tv.dto.models.RecentlyAddedSeasonDto
import com.privatemovie.tv.dto.models.RecentlyAddedSeriesDto
import com.privatemovie.tv.dto.models.SeriesDetails
import com.privatemovie.tv.dto.models.SeriesMetadata
import com.privatemovie.tv.modules.home.internal.HomeDrawerReturnTarget
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config

@RunWith(RobolectricTestRunner::class)
@Config(sdk = [34])
class HomeComposeFocusTest {

    @get:Rule
    val composeTestRule = createComposeRule()

    private fun makeSeriesMetadata(id: String, title: String) = SeriesMetadata(
        id = id,
        title = title,
        type = "tv",
        isFeatured = false,
        createdAt = "2024-01-01T00:00:00Z",
        updatedAt = "2024-01-01T00:00:00Z",
        genres = emptyList(),
        seasonsCount = 1,
        episodesCount = 1
    )

    private fun makeHero(id: String, title: String) = HomeFeedHero(
        id = id,
        title = title,
        type = "tv",
        isFeatured = true,
        createdAt = "2024-01-01T00:00:00Z",
        updatedAt = "2024-01-01T00:00:00Z",
        genres = emptyList(),
        seasonsCount = 1,
        episodesCount = 1,
        tags = emptyList()
    )

    private fun makeFakeRepository(feed: HomeFeed): MediaRepository = object : MediaRepository {
        override suspend fun getHomeFeed(): Result<HomeFeed> = Result.success(feed)
        override suspend fun getSeriesById(id: String): Result<SeriesDetails> =
            Result.failure(NotImplementedError())
    }

    @Test
    fun `drawer return event restores focus to Row Card in real Compose tree`() {
        val seriesA = makeSeriesMetadata("s-0-0", "Series Row 0 Card 0")
        val feed = HomeFeed(
            hero = makeHero("hero-1", "Hero Series"),
            heroes = listOf(makeHero("hero-1", "Hero Series")),
            recentlyAddedEpisodes = emptyList(),
            rows = listOf(
                HomeFeedRow(title = "Trending Now", items = listOf(seriesA))
            )
        )
        val repository = makeFakeRepository(feed)

        val viewModel = HomeViewModel(mediaRepository = repository)

        composeTestRule.setContent {
            HomeScreen(
                activeBackendUrl = "https://example.com",
                mediaRepository = repository,
                viewModel = viewModel,
                onSelectSeries = {}
            )
        }

        composeTestRule.waitForIdle()

        // Record drawer origin for Row 0
        viewModel.recordDrawerOrigin(HomeDrawerReturnTarget.Row(rowIndex = 0))

        // Restore drawer return focus
        val restored = viewModel.restoreDrawerReturnFocus()
        assertTrue(restored)

        composeTestRule.waitForIdle()

        // Verify that the Series Poster Card (the clickable card) acquired real Compose focus
        composeTestRule.onNode(hasText("Series Row 0 Card 0") and hasClickAction()).assertIsFocused()
    }

    @Test
    fun `drawer return event restores focus to Hero CTA in real Compose tree`() {
        val feed = HomeFeed(
            hero = makeHero("hero-1", "Hero Series"),
            heroes = listOf(makeHero("hero-1", "Hero Series")),
            recentlyAddedEpisodes = emptyList(),
            rows = emptyList()
        )
        val repository = makeFakeRepository(feed)

        val viewModel = HomeViewModel(mediaRepository = repository)

        composeTestRule.setContent {
            HomeScreen(
                activeBackendUrl = "https://example.com",
                mediaRepository = repository,
                viewModel = viewModel,
                onSelectSeries = {}
            )
        }

        composeTestRule.waitForIdle()

        // Record drawer origin for Hero
        viewModel.recordDrawerOrigin(HomeDrawerReturnTarget.Hero)

        // Restore drawer return focus
        val restored = viewModel.restoreDrawerReturnFocus()
        assertTrue(restored)

        composeTestRule.waitForIdle()

        // Verify that the Hero CTA acquired real Compose focus
        composeTestRule.onNode(hasText("View Series") and hasClickAction()).assertIsFocused()
    }

    @Test
    fun `drawer return event restores focus to Row Card 1 in multi-row catalog`() {
        val seriesRow0 = makeSeriesMetadata("s-0-0", "Row 0 Item 0")
        val seriesRow1 = makeSeriesMetadata("s-1-0", "Row 1 Item 0")
        val feed = HomeFeed(
            hero = makeHero("hero-1", "Hero Series"),
            heroes = listOf(makeHero("hero-1", "Hero Series")),
            recentlyAddedEpisodes = emptyList(),
            rows = listOf(
                HomeFeedRow(title = "Row 0", items = listOf(seriesRow0)),
                HomeFeedRow(title = "Row 1", items = listOf(seriesRow1))
            )
        )
        val repository = makeFakeRepository(feed)

        val viewModel = HomeViewModel(mediaRepository = repository)

        composeTestRule.setContent {
            HomeScreen(
                activeBackendUrl = "https://example.com",
                mediaRepository = repository,
                viewModel = viewModel,
                onSelectSeries = {}
            )
        }

        composeTestRule.waitForIdle()

        // Record drawer origin for Row 1
        viewModel.recordDrawerOrigin(HomeDrawerReturnTarget.Row(rowIndex = 1))

        // Restore drawer return focus
        val restored = viewModel.restoreDrawerReturnFocus()
        assertTrue(restored)

        composeTestRule.waitForIdle()

        // Verify that Row 1 Card 0 acquired real Compose focus
        composeTestRule.onNode(hasText("Row 1 Item 0") and hasClickAction()).assertIsFocused()
    }
}
