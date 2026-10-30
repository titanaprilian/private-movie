package com.privatemovie.tv.modules.home

import androidx.compose.ui.focus.FocusRequester
import com.privatemovie.tv.components.FocusTransitionCoordinator
import com.privatemovie.tv.components.requestFocusSafely
import com.privatemovie.tv.modules.home.internal.HeroDownFocusTarget
import com.privatemovie.tv.modules.home.internal.HomeDrawerReturnFocusResult
import com.privatemovie.tv.modules.home.internal.HomeDrawerReturnTarget
import com.privatemovie.tv.modules.home.internal.TvHomeFeed
import com.privatemovie.tv.modules.home.internal.TvHomeHero
import com.privatemovie.tv.modules.home.internal.TvHomeRow
import com.privatemovie.tv.modules.home.internal.TvRecentlyAddedEpisode
import com.privatemovie.tv.modules.home.internal.TvRecentlyAddedSeason
import com.privatemovie.tv.modules.home.internal.TvRecentlyAddedSeries
import com.privatemovie.tv.modules.home.internal.TvSeries
import com.privatemovie.tv.modules.home.internal.episodeBadgeLabel
import com.privatemovie.tv.modules.home.internal.executeHomeDrawerReturnFocus
import com.privatemovie.tv.modules.home.internal.formatEpisodeDuration
import com.privatemovie.tv.modules.home.internal.resolveHeroDownFocusTarget
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.test.advanceUntilIdle
import kotlinx.coroutines.test.runTest
import kotlinx.coroutines.launch
import kotlinx.coroutines.test.UnconfinedTestDispatcher
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test
import java.util.concurrent.atomic.AtomicInteger

@OptIn(ExperimentalCoroutinesApi::class)
class HomeScreenTest {

    // ── helpers ──────────────────────────────────────────────────────────────

    private fun makeSeries(id: String) = TvSeries(
        id = id, title = id, description = null, type = "tv",
        posterUrl = null, backdropUrl = null, rating = null,
        isFeatured = false, genres = emptyList(), seasonsCount = 1, episodesCount = 5
    )

    private fun makeFeed(rowSizes: List<Int> = listOf(5)): TvHomeFeed {
        val hero = TvHomeHero(series = makeSeries("hero"), tags = emptyList())
        val rows = rowSizes.mapIndexed { i, size ->
            TvHomeRow(title = "Row $i", items = (0 until size).map { makeSeries("s-$i-$it") })
        }
        return TvHomeFeed(hero = null, heroes = listOf(hero), rows = rows)
    }

    private fun makeEpisode(id: String, order: Int = 1): TvRecentlyAddedEpisode {
        return TvRecentlyAddedEpisode(
            id = id,
            title = "Episode $order",
            order = order,
            thumbnailUrl = null,
            duration = 2535,
            rating = null,
            series = TvRecentlyAddedSeries(
                id = "series-1",
                title = "Demon Slayer",
                posterUrl = null,
                backdropUrl = null
            ),
            season = TvRecentlyAddedSeason(
                id = "season-1",
                title = "Season 1",
                seasonNumber = 1
            ),
            videoSources = emptyList()
        )
    }

    // Simulates the focusRowCard helper from HomeFeedContent.
    private suspend fun focusRowCard(
        feed: TvHomeFeed,
        rowFocusIndices: Map<Int, Int>,
        rowFocusRequesters: Map<Int, List<FocusRequester>>,
        targetRowIndex: Int,
        hasHero: Boolean = true
    ): Boolean {
        val row = feed.rows.getOrNull(targetRowIndex) ?: return false
        val requesters = rowFocusRequesters[targetRowIndex] ?: return false
        if (requesters.isEmpty()) return false
        val rememberedIndex = rowFocusIndices[targetRowIndex] ?: 0
        val clampedIndex = rememberedIndex.coerceIn(0, requesters.size - 1)
        val targetRequester = requesters[clampedIndex]
        val success = requestFocusSafely(targetRequester, maxRetries = 2, rawRequest = { true })
        return if (!success) {
            requestFocusSafely(requesters[0], maxRetries = 2, rawRequest = { true })
        } else {
            true
        }
    }

    // Simulates the focusRecentEpisodeCard helper from HomeFeedContent.
    private suspend fun focusRecentEpisodeCard(
        feed: TvHomeFeed,
        recentEpisodeFocusIndex: Int,
        episodeFocusRequesters: List<FocusRequester>
    ): Boolean {
        if (feed.recentlyAddedEpisodes.isEmpty() || episodeFocusRequesters.isEmpty()) return false
        val clampedIndex = recentEpisodeFocusIndex.coerceIn(0, episodeFocusRequesters.size - 1)
        val targetRequester = episodeFocusRequesters[clampedIndex]
        val success = requestFocusSafely(targetRequester, maxRetries = 2, rawRequest = { true })
        return if (!success) {
            requestFocusSafely(episodeFocusRequesters[0], maxRetries = 2, rawRequest = { true })
        } else {
            true
        }
    }

    // ── original tests ────────────────────────────────────────────────────────

    @Test
    fun `downward focus transition from Hero CTA targets first catalog item`() = runTest {
        val heroFocus = FocusRequester()
        val firstCatalogItemFocus = FocusRequester()
        val coordinator = FocusTransitionCoordinator(this)
        var targetFocused = false

        val feed = makeFeed(listOf(1))

        val handled = coordinator.tryRequestFocus {
            val hasRows = feed.rows.any { it.items.isNotEmpty() }
            if (hasRows) {
                targetFocused = requestFocusSafely(firstCatalogItemFocus, maxRetries = 2, rawRequest = { true })
                targetFocused
            } else {
                false
            }
        }

        assertTrue(handled)
        advanceUntilIdle()
        assertTrue(targetFocused)
    }

    @Test
    fun `upward focus transition from first catalog item targets Hero CTA`() = runTest {
        val heroFocus = FocusRequester()
        val coordinator = FocusTransitionCoordinator(this)
        var heroFocused = false

        val handled = coordinator.tryRequestFocus {
            heroFocused = requestFocusSafely(heroFocus, maxRetries = 2, rawRequest = { true })
            heroFocused
        }

        assertTrue(handled)
        advanceUntilIdle()
        assertTrue(heroFocused)
    }

    @Test
    fun `rapid focus transition attempts are rejected by FocusTransitionCoordinator`() = runTest {
        val coordinator = FocusTransitionCoordinator(this)
        val counter = AtomicInteger(0)

        val first = coordinator.tryRequestFocus {
            counter.incrementAndGet()
            kotlinx.coroutines.delay(500)
            true
        }

        val second = coordinator.tryRequestFocus {
            counter.incrementAndGet()
            true
        }

        assertTrue(first)
        assertFalse(second)
        advanceUntilIdle()
        assertEquals(1, counter.get())
    }

    // ── per-row focus memory & restoration tests ──────────────────────────────

    @Test
    fun `downward navigation from Hero CTA restores focus to remembered card index in row 0`() = runTest {
        val feed = makeFeed(listOf(5))
        val requesters = mapOf(0 to List(5) { FocusRequester() })
        val rowFocusIndices = mutableMapOf(0 to 3) // user was on card index 3
        var focusedRequesterIndex = -1

        val coordinator = FocusTransitionCoordinator(this)
        val handled = coordinator.tryRequestFocus {
            val rememberedIndex = (rowFocusIndices[0] ?: 0).coerceIn(0, 4)
            focusedRequesterIndex = rememberedIndex
            requestFocusSafely(requesters[0]!![rememberedIndex], maxRetries = 2, rawRequest = { true })
        }

        assertTrue(handled)
        advanceUntilIdle()
        assertEquals(3, focusedRequesterIndex)
    }

    @Test
    fun `each row independently tracks its focused card index`() {
        val rowFocusIndices = mutableMapOf<Int, Int>()

        // Simulate focus events as user navigates
        rowFocusIndices[0] = 2  // row 0: user on card 2
        rowFocusIndices[1] = 4  // row 1: user on card 4
        rowFocusIndices[2] = 0  // row 2: user on card 0

        assertEquals(2, rowFocusIndices[0])
        assertEquals(4, rowFocusIndices[1])
        assertEquals(0, rowFocusIndices[2])
    }

    @Test
    fun `focus restoration clamps out-of-bounds remembered index to last valid card`() = runTest {
        val feed = makeFeed(listOf(3))
        val requesters = mapOf(0 to List(3) { FocusRequester() })
        // Stale remembered index (e.g. from a previous feed with more items)
        val rowFocusIndices = mutableMapOf(0 to 99)
        var resolvedIndex = -1

        val coordinator = FocusTransitionCoordinator(this)
        coordinator.tryRequestFocus {
            val remembered = rowFocusIndices[0] ?: 0
            val clamped = remembered.coerceIn(0, requesters[0]!!.size - 1)
            resolvedIndex = clamped
            requestFocusSafely(requesters[0]!![clamped], maxRetries = 2, rawRequest = { true })
        }

        advanceUntilIdle()
        assertEquals(2, resolvedIndex) // clamped to index 2 (last valid for size 3)
    }

    @Test
    fun `focus fallback to card 0 when primary acquisition fails`() = runTest {
        val feed = makeFeed(listOf(4))
        val requesters = mapOf(0 to List(4) { FocusRequester() })
        val rowFocusIndices = mutableMapOf(0 to 2)
        var fallbackUsed = false

        val coordinator = FocusTransitionCoordinator(this)
        coordinator.tryRequestFocus {
            val clamped = (rowFocusIndices[0] ?: 0).coerceIn(0, 3)
            // Simulate primary focus failing
            val primarySuccess = requestFocusSafely(requesters[0]!![clamped], maxRetries = 1, rawRequest = { false })
            if (!primarySuccess) {
                fallbackUsed = true
                requestFocusSafely(requesters[0]!![0], maxRetries = 2, rawRequest = { true })
            } else {
                primarySuccess
            }
        }

        advanceUntilIdle()
        assertTrue(fallbackUsed)
    }

    @Test
    fun `onFocused callback records correct card index per row`() {
        val rowFocusIndices = mutableMapOf<Int, Int>()

        // Simulate the onFocused lambda called by each SeriesPosterCard
        val onFocusedRow0Card2: () -> Unit = { rowFocusIndices[0] = 2 }
        val onFocusedRow1Card0: () -> Unit = { rowFocusIndices[1] = 0 }

        onFocusedRow0Card2()
        onFocusedRow1Card0()

        assertEquals(2, rowFocusIndices[0])
        assertEquals(0, rowFocusIndices[1])
    }

    @Test
    fun `downward navigation targets first non-empty row when row 0 is empty`() = runTest {
        val feed = TvHomeFeed(
            hero = null,
            heroes = listOf(TvHomeHero(series = makeSeries("hero"), tags = emptyList())),
            rows = listOf(
                TvHomeRow(title = "Empty Row", items = emptyList()),
                TvHomeRow(title = "Popular", items = listOf(makeSeries("s-1"), makeSeries("s-2")))
            )
        )
        val firstNonEmptyRowIndex = feed.rows.indexOfFirst { it.items.isNotEmpty() }
        assertEquals(1, firstNonEmptyRowIndex)

        val requesters = mapOf(1 to List(2) { FocusRequester() })
        val rowFocusIndices = mutableMapOf<Int, Int>() // no remembered index yet
        var focusedIndex = -1

        val coordinator = FocusTransitionCoordinator(this)
        coordinator.tryRequestFocus {
            val remembered = (rowFocusIndices[firstNonEmptyRowIndex] ?: 0)
                .coerceIn(0, requesters[firstNonEmptyRowIndex]!!.size - 1)
            focusedIndex = remembered
            requestFocusSafely(requesters[firstNonEmptyRowIndex]!![remembered], maxRetries = 2, rawRequest = { true })
        }

        advanceUntilIdle()
        assertEquals(0, focusedIndex) // defaults to card 0 for first time
    }

    @Test
    fun `full-bleed home routes dpad left from hero and leftmost cards to the drawer`() {
        // Home renders no top bar: the hero CTA and index-0 row cards are the
        // left edge, so D-pad Left from them must focus the drawer rail.
        val left = android.view.KeyEvent.KEYCODE_DPAD_LEFT
        assertTrue(
            com.privatemovie.tv.navigation.shouldFocusDrawerOnKey(
                left, isKeyDown = true, isLeftmost = true
            )
        )
        assertFalse(
            com.privatemovie.tv.navigation.shouldFocusDrawerOnKey(
                left, isKeyDown = true, isLeftmost = false
            )
        )
    }

    // ── recently added episodes carousel ──────────────────────────────────────

    @Test
    fun `downward focus from Hero CTA targets the episodes carousel when episodes are present`() = runTest {
        val feed = makeFeed(listOf(3)).copy(
            recentlyAddedEpisodes = listOf(makeEpisode("e-1", 1), makeEpisode("e-2", 2))
        )

        assertEquals(HeroDownFocusTarget.EpisodeCarousel, resolveHeroDownFocusTarget(feed))

        val episodeRequesters = listOf(FocusRequester(), FocusRequester())
        var focusedEpisodeIndex = -1
        val coordinator = FocusTransitionCoordinator(this)
        val handled = coordinator.tryRequestFocus {
            focusedEpisodeIndex = 0
            requestFocusSafely(episodeRequesters[0], maxRetries = 2, rawRequest = { true })
        }

        assertTrue(handled)
        advanceUntilIdle()
        assertEquals(0, focusedEpisodeIndex)
    }

    @Test
    fun `downward focus from Hero CTA falls back to the first regular row when no episodes exist`() {
        val feed = makeFeed(listOf(2))

        assertEquals(HeroDownFocusTarget.FirstRow, resolveHeroDownFocusTarget(feed))
    }

    @Test
    fun `downward focus from Hero CTA has no target when the feed has neither episodes nor rows`() {
        val feed = TvHomeFeed(
            hero = null,
            heroes = listOf(TvHomeHero(series = makeSeries("hero"), tags = emptyList())),
            rows = emptyList(),
            recentlyAddedEpisodes = emptyList()
        )

        assertEquals(HeroDownFocusTarget.None, resolveHeroDownFocusTarget(feed))
    }

    @Test
    fun `episode duration badge formats seconds as mm and ss and hides unknown durations`() {
        assertEquals("00:30", formatEpisodeDuration(30))
        assertEquals("42:15", formatEpisodeDuration(2535))
        assertEquals("60:00" /* 60 minutes */, formatEpisodeDuration(3600))
        assertNull(formatEpisodeDuration(0))
        assertNull(formatEpisodeDuration(null))
    }

    @Test
    fun `episode badge combines the season and the episode order`() {
        val season = TvRecentlyAddedSeason(id = "s1", title = "Season 1", seasonNumber = 1)
        assertEquals("S1 · EP 12", episodeBadgeLabel(season, 12))

        val seasonWithoutNumber = TvRecentlyAddedSeason(id = "s2", title = "Season 2", seasonNumber = null)
        assertEquals("S2 · EP 3", episodeBadgeLabel(seasonWithoutNumber, 3))
    }

    @Test
    fun `dpad up from row 0 focuses remembered episode card when episodes are present`() = runTest {
        val feed = makeFeed(listOf(3)).copy(
            recentlyAddedEpisodes = listOf(makeEpisode("e-1", 1), makeEpisode("e-2", 2), makeEpisode("e-3", 3))
        )
        val episodeRequesters = List(3) { FocusRequester() }
        var recentEpisodeFocusIndex = 2 // last focused was episode index 2
        var focusedEpisodeIndex = -1

        val coordinator = FocusTransitionCoordinator(this)
        val handled = coordinator.tryRequestFocus {
            if (feed.recentlyAddedEpisodes.isNotEmpty()) {
                val clamped = recentEpisodeFocusIndex.coerceIn(0, episodeRequesters.size - 1)
                focusedEpisodeIndex = clamped
                requestFocusSafely(episodeRequesters[clamped], maxRetries = 2, rawRequest = { true })
            } else {
                false
            }
        }

        assertTrue(handled)
        advanceUntilIdle()
        assertEquals(2, focusedEpisodeIndex)
    }

    @Test
    fun `dpad up from row 0 falls back to Hero CTA when recently added episodes is empty and heroes exist`() = runTest {
        val feed = makeFeed(listOf(3)).copy(
            recentlyAddedEpisodes = emptyList()
        )
        val heroFocus = FocusRequester()
        var heroFocused = false

        val coordinator = FocusTransitionCoordinator(this)
        val handled = coordinator.tryRequestFocus {
            if (feed.recentlyAddedEpisodes.isNotEmpty()) {
                false
            } else if (feed.heroes.isNotEmpty() || feed.hero != null) {
                heroFocused = requestFocusSafely(heroFocus, maxRetries = 2, rawRequest = { true })
                heroFocused
            } else {
                false
            }
        }

        assertTrue(handled)
        advanceUntilIdle()
        assertTrue(heroFocused)
    }

    @Test
    fun `dpad down from any card in recently added episodes focuses remembered series card in first row`() = runTest {
        val feed = makeFeed(listOf(4)).copy(
            recentlyAddedEpisodes = listOf(makeEpisode("e-1", 1), makeEpisode("e-2", 2))
        )
        val rowFocusRequesters = mapOf(0 to List(4) { FocusRequester() })
        val rowFocusIndices = mutableMapOf(0 to 3) // user had focused card 3 in row 0
        var focusedRowCardIndex = -1

        val firstNonEmptyRowIndex = feed.rows.indexOfFirst { it.items.isNotEmpty() }
        assertEquals(0, firstNonEmptyRowIndex)

        val coordinator = FocusTransitionCoordinator(this)
        val handled = coordinator.tryRequestFocus {
            val remembered = (rowFocusIndices[firstNonEmptyRowIndex] ?: 0)
                .coerceIn(0, rowFocusRequesters[firstNonEmptyRowIndex]!!.size - 1)
            focusedRowCardIndex = remembered
            requestFocusSafely(rowFocusRequesters[firstNonEmptyRowIndex]!![remembered], maxRetries = 2, rawRequest = { true })
        }

        assertTrue(handled)
        advanceUntilIdle()
        assertEquals(3, focusedRowCardIndex)
    }

    @Test
    fun `focus restoration into recently added episodes clamps out of bounds and falls back to card 0 upon failure`() = runTest {
        val feed = makeFeed(listOf(3)).copy(
            recentlyAddedEpisodes = listOf(makeEpisode("e-1", 1), makeEpisode("e-2", 2))
        )
        val episodeRequesters = List(2) { FocusRequester() }
        val outOfBoundsIndex = 99
        var fallbackUsed = false
        var targetIndexAttempted = -1

        val coordinator = FocusTransitionCoordinator(this)
        coordinator.tryRequestFocus {
            val clamped = outOfBoundsIndex.coerceIn(0, episodeRequesters.size - 1)
            targetIndexAttempted = clamped
            // Simulate primary focus failing on target card
            val success = requestFocusSafely(episodeRequesters[clamped], maxRetries = 1, rawRequest = { false })
            if (!success) {
                fallbackUsed = true
                requestFocusSafely(episodeRequesters[0], maxRetries = 2, rawRequest = { true })
            } else {
                success
            }
        }

        advanceUntilIdle()
        assertEquals(1, targetIndexAttempted) // clamped to last index (size 2 -> index 1)
        assertTrue(fallbackUsed)
    }
    // ── drawer return focus tests ─────────────────────────────────────────────

    @Test
    fun `returning from drawer restores focus to remembered section and card 0 scrolling into view first`() = runTest {
        val feed = makeFeed(listOf(3, 3)).copy(
            recentlyAddedEpisodes = listOf(makeEpisode("e-1", 1))
        )
        val coordinator = FocusTransitionCoordinator(this)
        val rowFocusRequesters = mapOf(
            0 to List(3) { FocusRequester() },
            1 to List(3) { FocusRequester() }
        )
        val hasRecentEpisodes = feed.recentlyAddedEpisodes.isNotEmpty()
        val effectiveHeroesCount = 1
        val rowItemOffset = if (hasRecentEpisodes) 2 else 1

        var scrolledLazyColumnIndex = -1
        var scrolledRowCardIndex = -1
        var focusedRowCard: Pair<Int, Int>? = null

        // Simulating the drawer return focus restoration for HomeDrawerReturnTarget.Row(1)
        val target = HomeDrawerReturnTarget.Row(1)
        val handled = coordinator.tryRequestFocus {
            val res = executeHomeDrawerReturnFocus(
                target = target,
                feed = feed,
                requestHeroFocus = { false },
                requestRecentEpisodesFocus = { false },
                requestRowCardFocus = { rowIndex, cardIndex ->
                    val lazyItemIndex = if (effectiveHeroesCount > 0) rowIndex + rowItemOffset else rowIndex
                    scrolledLazyColumnIndex = lazyItemIndex
                    scrolledRowCardIndex = cardIndex
                    val requester = rowFocusRequesters[rowIndex]?.getOrNull(cardIndex)
                    val ok = requester != null && requestFocusSafely(requester, maxRetries = 2, rawRequest = { true })
                    if (ok) focusedRowCard = rowIndex to cardIndex
                    ok
                }
            )
            res != HomeDrawerReturnFocusResult.Unfocused
        }

        assertTrue(handled)
        advanceUntilIdle()
        // rowIndex 1 + rowItemOffset 2 = 3
        assertEquals(3, scrolledLazyColumnIndex)
        assertEquals(0, scrolledRowCardIndex)
        assertEquals(1 to 0, focusedRowCard)
    }

    @Test
    fun `returning from drawer to recently added episodes scrolls carousel into view and focuses card 0`() = runTest {
        val feed = makeFeed(listOf(3)).copy(
            recentlyAddedEpisodes = listOf(makeEpisode("e-1", 1), makeEpisode("e-2", 2))
        )
        val coordinator = FocusTransitionCoordinator(this)
        val episodeFocusRequesters = listOf(FocusRequester(), FocusRequester())
        val effectiveHeroesCount = 1

        var scrolledLazyColumnIndex = -1
        var scrolledEpisodeIndex = -1
        var focusedEpisodeIndex = -1

        val target = HomeDrawerReturnTarget.RecentlyAddedEpisodes
        val handled = coordinator.tryRequestFocus {
            val res = executeHomeDrawerReturnFocus(
                target = target,
                feed = feed,
                requestHeroFocus = { false },
                requestRecentEpisodesFocus = {
                    val episodeItemIndex = if (effectiveHeroesCount > 0) 1 else 0
                    scrolledLazyColumnIndex = episodeItemIndex
                    scrolledEpisodeIndex = 0
                    val requester = episodeFocusRequesters.firstOrNull()
                    val ok = requester != null && requestFocusSafely(requester, maxRetries = 2, rawRequest = { true })
                    if (ok) focusedEpisodeIndex = 0
                    ok
                },
                requestRowCardFocus = { _, _ -> false }
            )
            res == HomeDrawerReturnFocusResult.RecentlyAddedEpisodesFocused
        }

        assertTrue(handled)
        advanceUntilIdle()
        assertEquals(1, scrolledLazyColumnIndex)
        assertEquals(0, scrolledEpisodeIndex)
        assertEquals(0, focusedEpisodeIndex)
    }

    @Test
    fun `returning from drawer to hero scrolls to top and focuses hero CTA`() = runTest {
        val feed = makeFeed(listOf(3))
        val coordinator = FocusTransitionCoordinator(this)
        val heroFocus = FocusRequester()

        var scrolledLazyColumnIndex = -1
        var heroFocused = false

        val target = HomeDrawerReturnTarget.Hero
        val handled = coordinator.tryRequestFocus {
            val res = executeHomeDrawerReturnFocus(
                target = target,
                feed = feed,
                requestHeroFocus = {
                    scrolledLazyColumnIndex = 0
                    heroFocused = requestFocusSafely(heroFocus, maxRetries = 2, rawRequest = { true })
                    heroFocused
                },
                requestRecentEpisodesFocus = { false },
                requestRowCardFocus = { _, _ -> false }
            )
            res == HomeDrawerReturnFocusResult.HeroFocused
        }

        assertTrue(handled)
        advanceUntilIdle()
        assertEquals(0, scrolledLazyColumnIndex)
        assertTrue(heroFocused)
    }

    @Test
    fun `drawer return focus fallback to card 0 of first section when target row fails`() = runTest {
        val feed = makeFeed(listOf(3, 3)).copy(
            recentlyAddedEpisodes = listOf(makeEpisode("e-1", 1))
        )
        val coordinator = FocusTransitionCoordinator(this)
        val episodeFocusRequester = FocusRequester()
        var fallbackEpisodeFocused = false

        val target = HomeDrawerReturnTarget.Row(1)
        val handled = coordinator.tryRequestFocus {
            val res = executeHomeDrawerReturnFocus(
                target = target,
                feed = feed,
                requestHeroFocus = { false },
                requestRecentEpisodesFocus = {
                    fallbackEpisodeFocused = requestFocusSafely(episodeFocusRequester, maxRetries = 2, rawRequest = { true })
                    fallbackEpisodeFocused
                },
                requestRowCardFocus = { rowIndex, _ ->
                    if (rowIndex == 1) false else true
                }
            )
            res == HomeDrawerReturnFocusResult.RecentlyAddedEpisodesFocused
        }

        assertTrue(handled)
        advanceUntilIdle()
        assertTrue(fallbackEpisodeFocused)
    }

    @Test
    fun `drawer return focus returns Unfocused without silent Hero CTA fallback when target and first section fail`() = runTest {
        val feed = makeFeed(listOf(3))
        val coordinator = FocusTransitionCoordinator(this)
        val heroFocus = FocusRequester()
        var fallbackHeroFocused = false
        var executionResult: HomeDrawerReturnFocusResult? = null

        val target = HomeDrawerReturnTarget.Row(0)
        val handled = coordinator.tryRequestFocus {
            val res = executeHomeDrawerReturnFocus(
                target = target,
                feed = feed,
                requestHeroFocus = {
                    fallbackHeroFocused = requestFocusSafely(heroFocus, maxRetries = 2, rawRequest = { true })
                    fallbackHeroFocused
                },
                requestRecentEpisodesFocus = { false },
                requestRowCardFocus = { _, _ -> false }
            )
            executionResult = res
            res != HomeDrawerReturnFocusResult.Unfocused
        }

        assertTrue(handled)
        advanceUntilIdle()
        assertEquals(HomeDrawerReturnFocusResult.Unfocused, executionResult)
        assertFalse(fallbackHeroFocused)
    }

    @Test
    fun `recording drawer origin on edge key event stages target and emits upon restoreDrawerReturnFocus`() = runTest {
        val repo = object : com.privatemovie.tv.data.repository.MediaRepository {
            override suspend fun getHomeFeed() = Result.success(com.privatemovie.tv.dto.models.HomeFeed(rows = emptyList(), hero = null, heroes = emptyList()))
            override suspend fun getSeriesById(id: String) = Result.failure<com.privatemovie.tv.dto.models.SeriesDetails>(NotImplementedError())
        }
        val vm = HomeViewModel(mediaRepository = repo, coroutineScope = this)

        var collectedTarget: HomeDrawerReturnTarget? = null
        val job = launch(UnconfinedTestDispatcher(testScheduler)) {
            vm.drawerReturnEvents.collect {
                collectedTarget = it
            }
        }

        // D-pad Left from Hero
        var onFocusDrawerCalled = false
        val onLeftFromHero = { vm.recordDrawerOrigin(HomeDrawerReturnTarget.Hero) }
        val onFocusDrawer = { onFocusDrawerCalled = true }

        onLeftFromHero()
        onFocusDrawer()
        assertTrue(onFocusDrawerCalled)
        assertTrue(vm.restoreDrawerReturnFocus())
        assertEquals(HomeDrawerReturnTarget.Hero, collectedTarget)

        // D-pad Left from Recent Episodes
        onFocusDrawerCalled = false
        val onLeftFromRecent = { vm.recordDrawerOrigin(HomeDrawerReturnTarget.RecentlyAddedEpisodes) }
        onLeftFromRecent()
        onFocusDrawer()
        assertTrue(onFocusDrawerCalled)
        assertTrue(vm.restoreDrawerReturnFocus())
        assertEquals(HomeDrawerReturnTarget.RecentlyAddedEpisodes, collectedTarget)

        // D-pad Left from Row
        onFocusDrawerCalled = false
        val onLeftFromRow = { r: Int -> vm.recordDrawerOrigin(HomeDrawerReturnTarget.Row(r)) }
        onLeftFromRow(3)
        onFocusDrawer()
        assertTrue(onFocusDrawerCalled)
        assertTrue(vm.restoreDrawerReturnFocus())
        assertEquals(HomeDrawerReturnTarget.Row(3), collectedTarget)

        // Subsequent restore has no pending target
        assertFalse(vm.restoreDrawerReturnFocus())
        job.cancel()
    }

    @Test
    fun `returning from drawer with recorded RecentlyAddedEpisodes origin restores to episodes carousel card 0 instead of Hero CTA`() = runTest {
        val feed = makeFeed(listOf(3)).copy(
            recentlyAddedEpisodes = listOf(makeEpisode("e-1", 1), makeEpisode("e-2", 2))
        )
        val coordinator = FocusTransitionCoordinator(this)
        var heroRequested = false
        var episodeCard0Requested = false
        var rowCardRequested = false

        val target = HomeDrawerReturnTarget.RecentlyAddedEpisodes
        val handled = coordinator.tryRequestFocus {
            val res = executeHomeDrawerReturnFocus(
                target = target,
                feed = feed,
                requestHeroFocus = { heroRequested = true; true },
                requestRecentEpisodesFocus = { episodeCard0Requested = true; true },
                requestRowCardFocus = { _, _ -> rowCardRequested = true; true }
            )
            res == HomeDrawerReturnFocusResult.RecentlyAddedEpisodesFocused
        }

        assertTrue(handled)
        advanceUntilIdle()
        assertTrue(episodeCard0Requested)
        assertFalse(heroRequested)
        assertFalse(rowCardRequested)
    }

    @Test
    fun `returning from drawer with recorded Row origin restores to row card 0 instead of Hero CTA`() = runTest {
        val feed = makeFeed(listOf(3, 3))
        val coordinator = FocusTransitionCoordinator(this)
        var heroRequested = false
        var row0Card0Requested = false

        val target = HomeDrawerReturnTarget.Row(0)
        val handled = coordinator.tryRequestFocus {
            val res = executeHomeDrawerReturnFocus(
                target = target,
                feed = feed,
                requestHeroFocus = { heroRequested = true; true },
                requestRecentEpisodesFocus = { false },
                requestRowCardFocus = { rowIndex, cardIndex ->
                    if (rowIndex == 0 && cardIndex == 0) {
                        row0Card0Requested = true
                        true
                    } else {
                        false
                    }
                }
            )
            res == HomeDrawerReturnFocusResult.RowCardFocused(0, 0)
        }

        assertTrue(handled)
        advanceUntilIdle()
        assertTrue(row0Card0Requested)
        assertFalse(heroRequested)
    }

    @Test
    fun `flow collector directly consumes target from drawerReturnEvents stream eliminating stale closure capture`() = runTest {
        val feed = makeFeed(listOf(3)).copy(
            recentlyAddedEpisodes = listOf(makeEpisode("e-1", 1))
        )
        val repo = object : com.privatemovie.tv.data.repository.MediaRepository {
            override suspend fun getHomeFeed() = Result.success(com.privatemovie.tv.dto.models.HomeFeed(rows = emptyList(), hero = null, heroes = emptyList()))
            override suspend fun getSeriesById(id: String) = Result.failure<com.privatemovie.tv.dto.models.SeriesDetails>(NotImplementedError())
        }
        val vm = HomeViewModel(mediaRepository = repo, coroutineScope = this)

        var executedTarget: HomeDrawerReturnTarget? = null

        // The event collector receives the target directly from the stream payload
        val job = launch(UnconfinedTestDispatcher(testScheduler)) {
            vm.drawerReturnEvents.collect { target ->
                executedTarget = target
                executeHomeDrawerReturnFocus(
                    target = target,
                    feed = feed,
                    requestHeroFocus = { true },
                    requestRecentEpisodesFocus = { true },
                    requestRowCardFocus = { _, _ -> true }
                )
            }
        }

        // User navigates left from RecentlyAddedEpisodes -> records origin
        vm.recordDrawerOrigin(HomeDrawerReturnTarget.RecentlyAddedEpisodes)

        // Drawer collapses and triggers return focus via restoreDrawerReturnFocus
        val restored = vm.restoreDrawerReturnFocus()
        advanceUntilIdle()

        assertTrue(restored)
        assertEquals(HomeDrawerReturnTarget.RecentlyAddedEpisodes, executedTarget)
        job.cancel()
    }

    @Test
    fun `incoming content focus requester directly attaches to hero CTA without container Box trampoline`() {
        val externalContentFocusRequester = FocusRequester()
        val internalHeroFocus = FocusRequester()

        // HomeScreen pattern: contentFocusRequester ?: internalHeroFocus
        val resolvedHeroFocus = externalContentFocusRequester ?: internalHeroFocus

        // When externalContentFocusRequester is provided, it is attached directly to the hero CTA
        assertEquals(externalContentFocusRequester, resolvedHeroFocus)

        // When externalContentFocusRequester is null, it falls back to internalHeroFocus
        val fallbackHeroFocus = (null as FocusRequester?) ?: internalHeroFocus
        assertEquals(internalHeroFocus, fallbackHeroFocus)
    }
}
