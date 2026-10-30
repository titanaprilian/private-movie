package com.privatemovie.tv.modules.home

import com.privatemovie.tv.components.TvFocusLog

import com.privatemovie.tv.components.FocusTransitionCoordinator
import com.privatemovie.tv.data.repository.MediaRepository
import com.privatemovie.tv.dto.models.HomeFeed
import com.privatemovie.tv.dto.models.SeriesDetails
import com.privatemovie.tv.modules.home.internal.HomeDrawerReturnFocusResult
import com.privatemovie.tv.modules.home.internal.HomeDrawerReturnTarget
import com.privatemovie.tv.modules.home.internal.HomeReturnFocusResult
import com.privatemovie.tv.modules.home.internal.HomeReturnFocusTarget
import com.privatemovie.tv.modules.home.internal.ResolvedHomeReturnFocus
import com.privatemovie.tv.modules.home.internal.TvHomeFeed
import com.privatemovie.tv.modules.home.internal.TvHomeHero
import com.privatemovie.tv.modules.home.internal.TvHomeRow
import com.privatemovie.tv.modules.home.internal.TvRecentlyAddedEpisode
import com.privatemovie.tv.modules.home.internal.TvRecentlyAddedSeason
import com.privatemovie.tv.modules.home.internal.TvRecentlyAddedSeries
import com.privatemovie.tv.modules.home.internal.TvSeries
import com.privatemovie.tv.modules.home.internal.executeHomeDrawerReturnFocus
import com.privatemovie.tv.modules.home.internal.executeHomeReturnFocus
import com.privatemovie.tv.modules.home.internal.heroSelectionTarget
import com.privatemovie.tv.modules.home.internal.resolveHomeReturnFocus
import com.privatemovie.tv.modules.home.internal.rowCardSelectionTarget
import com.privatemovie.tv.modules.home.internal.shouldRestoreHomeFocus
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.launch
import kotlinx.coroutines.test.TestScope
import kotlinx.coroutines.test.UnconfinedTestDispatcher
import kotlinx.coroutines.test.advanceUntilIdle
import kotlinx.coroutines.test.runTest
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test
import java.util.concurrent.atomic.AtomicInteger

@OptIn(ExperimentalCoroutinesApi::class)
class HomeReturnFocusTest {

    private val testDispatcher = UnconfinedTestDispatcher()
    private val testScope = TestScope(testDispatcher)

    private fun makeSeries(id: String) = TvSeries(
        id = id, title = id, description = null, type = "tv",
        posterUrl = null, backdropUrl = null, rating = null,
        isFeatured = false, genres = emptyList(), seasonsCount = 1, episodesCount = 5
    )

    private fun makeFeed(): TvHomeFeed {
        val hero = TvHomeHero(series = makeSeries("hero-1"), tags = emptyList())
        return TvHomeFeed(
            hero = null,
            heroes = listOf(hero),
            rows = listOf(
                TvHomeRow(title = "Row 0", items = listOf(makeSeries("s-0-0"), makeSeries("s-0-1"), makeSeries("s-0-2"))),
                TvHomeRow(title = "Row 1", items = listOf(makeSeries("s-1-0"), makeSeries("s-1-1")))
            )
        )
    }

    private fun viewModel() = HomeViewModel(
        mediaRepository = object : MediaRepository {
            override suspend fun getHomeFeed(): Result<HomeFeed> =
                Result.success(HomeFeed(hero = null, heroes = emptyList(), rows = emptyList()))
            override suspend fun getSeriesById(id: String): Result<SeriesDetails> =
                Result.failure(NotImplementedError())
        },
        coroutineScope = testScope
    )

    // ── origin tracking ──

    @Test
    fun `no pending return focus on initial entry`() {
        val vm = viewModel()
        assertNull(vm.pendingReturnFocus.value)
        assertFalse(shouldRestoreHomeFocus(vm.pendingReturnFocus.value))
    }

    @Test
    fun `hero selection records Hero origin`() {
        val vm = viewModel()
        vm.recordHeroSelection("hero-1")
        val target = vm.pendingReturnFocus.value
        assertTrue(target is HomeReturnFocusTarget.Hero)
        assertEquals("hero-1", (target as HomeReturnFocusTarget.Hero).seriesId)
        assertTrue(shouldRestoreHomeFocus(target))
    }

    @Test
    fun `row card selection records RowCard origin with indices and series id`() {
        val vm = viewModel()
        vm.recordRowCardSelection(rowIndex = 1, cardIndex = 2, seriesId = "s-1-2")
        val target = vm.pendingReturnFocus.value
        assertTrue(target is HomeReturnFocusTarget.RowCard)
        target as HomeReturnFocusTarget.RowCard
        assertEquals(1, target.rowIndex)
        assertEquals(2, target.cardIndex)
        assertEquals("s-1-2", target.seriesId)
    }

    @Test
    fun `consumeReturnFocus clears target so recompositions do not jump`() {
        val vm = viewModel()
        vm.recordRowCardSelection(0, 1, "s-0-1")
        vm.consumeReturnFocus()
        assertNull(vm.pendingReturnFocus.value)
        assertFalse(shouldRestoreHomeFocus(vm.pendingReturnFocus.value))
    }

    @Test
    fun `heroSelectionTarget and rowCardSelectionTarget helpers build origins`() {
        assertEquals(HomeReturnFocusTarget.Hero("h"), heroSelectionTarget("h"))
        assertEquals(
            HomeReturnFocusTarget.RowCard(0, 2, "s"),
            rowCardSelectionTarget(0, 2, "s")
        )
    }

    // ── return focus resolution ──

    @Test
    fun `hero origin resolves to HeroCta`() {
        val resolved = resolveHomeReturnFocus(makeFeed(), HomeReturnFocusTarget.Hero("hero-1"))
        assertEquals(ResolvedHomeReturnFocus.HeroCta, resolved)
    }

    @Test
    fun `row origin resolves to exact card on id match`() {
        val resolved = resolveHomeReturnFocus(makeFeed(), HomeReturnFocusTarget.RowCard(0, 1, "s-0-1"))
        assertEquals(ResolvedHomeReturnFocus.RowCard(0, 1), resolved)
    }

    @Test
    fun `row origin follows series id when it moved within the row`() {
        val feed = makeFeed()
        // s-0-2 moved to index 0 in a refreshed feed.
        val refreshed = feed.copy(
            rows = listOf(
                TvHomeRow(title = "Row 0", items = listOf(makeSeries("s-0-2"), makeSeries("s-0-0"), makeSeries("s-0-1"))),
                feed.rows[1]
            )
        )
        val resolved = resolveHomeReturnFocus(refreshed, HomeReturnFocusTarget.RowCard(0, 2, "s-0-2"))
        assertEquals(ResolvedHomeReturnFocus.RowCard(0, 0), resolved)
    }

    @Test
    fun `missing row resolves to HeroCta fallback`() {
        val resolved = resolveHomeReturnFocus(makeFeed(), HomeReturnFocusTarget.RowCard(9, 0, "gone"))
        assertEquals(ResolvedHomeReturnFocus.HeroCta, resolved)
    }

    @Test
    fun `empty row resolves to HeroCta fallback`() {
        val feed = makeFeed().copy(
            rows = listOf(TvHomeRow(title = "Empty", items = emptyList()))
        )
        val resolved = resolveHomeReturnFocus(feed, HomeReturnFocusTarget.RowCard(0, 0, "s"))
        assertEquals(ResolvedHomeReturnFocus.HeroCta, resolved)
    }

    @Test
    fun `stale card index clamps into range for Card-0 fallback step`() {
        val resolved = resolveHomeReturnFocus(makeFeed(), HomeReturnFocusTarget.RowCard(1, 99, "unknown"))
        // Row 1 has 2 items -> clamped to last valid card (index 1).
        assertEquals(ResolvedHomeReturnFocus.RowCard(1, 1), resolved)
    }

    @Test
    fun `null target resolves to null keeping default hero focus`() {
        assertNull(resolveHomeReturnFocus(makeFeed(), null))
    }

    // ── fallback hierarchy executor ──

    @Test
    fun `executor focuses target card when acquisition succeeds`() = runTest {
        val requested = mutableListOf<Pair<Int, Int>>()
        val result = executeHomeReturnFocus(
            resolved = ResolvedHomeReturnFocus.RowCard(1, 1),
            requestCardFocus = { r, c -> requested.add(r to c); true },
            requestHeroFocus = { false }
        )
        assertEquals(HomeReturnFocusResult.RowCardFocused(1, 1), result)
        assertEquals(listOf(1 to 1), requested)
    }

    @Test
    fun `executor falls back to Card 0 when target fails`() = runTest {
        val requested = mutableListOf<Pair<Int, Int>>()
        val result = executeHomeReturnFocus(
            resolved = ResolvedHomeReturnFocus.RowCard(0, 2),
            requestCardFocus = { r, c ->
                requested.add(r to c)
                c == 0 // only Card 0 succeeds
            },
            requestHeroFocus = { error("hero must not be attempted when Card 0 succeeds") }
        )
        assertEquals(HomeReturnFocusResult.RowCardFocused(0, 0), result)
        assertEquals(listOf(0 to 2, 0 to 0), requested)
    }

    @Test
    fun `executor falls back to Hero CTA when row cards fail`() = runTest {
        var heroRequested = false
        val result = executeHomeReturnFocus(
            resolved = ResolvedHomeReturnFocus.RowCard(0, 2),
            requestCardFocus = { _, _ -> false },
            requestHeroFocus = { heroRequested = true; true }
        )
        assertEquals(HomeReturnFocusResult.HeroFocused, result)
        assertTrue(heroRequested)
    }

    @Test
    fun `executor returns Unfocused when everything fails`() = runTest {
        val result = executeHomeReturnFocus(
            resolved = ResolvedHomeReturnFocus.RowCard(0, 1),
            requestCardFocus = { _, _ -> false },
            requestHeroFocus = { false }
        )
        assertEquals(HomeReturnFocusResult.Unfocused, result)
    }

    @Test
    fun `executor attempts Card 0 only once when target is Card 0`() = runTest {
        var attempts = 0
        var heroAttempts = 0
        val result = executeHomeReturnFocus(
            resolved = ResolvedHomeReturnFocus.RowCard(0, 0),
            requestCardFocus = { _, _ -> attempts++; false },
            requestHeroFocus = { heroAttempts++; false }
        )
        assertEquals(HomeReturnFocusResult.Unfocused, result)
        assertEquals(1, attempts)
        assertEquals(1, heroAttempts)
    }

    @Test
    fun `restoreDrawerReturnFocus atomically consumes pending target and emits to drawerReturnEvents`() = runTest {
        val vm = viewModel()
        // Initially when no target is pending, restoreDrawerReturnFocus returns false
        assertFalse(vm.restoreDrawerReturnFocus())

        var collectedTarget: HomeDrawerReturnTarget? = null
        val job = launch(UnconfinedTestDispatcher(testScheduler)) {
            vm.drawerReturnEvents.collect {
                collectedTarget = it
            }
        }

        // Record origin Row(2) and restore
        vm.recordDrawerOrigin(HomeDrawerReturnTarget.Row(2))
        val restored = vm.restoreDrawerReturnFocus()
        assertTrue(restored)
        assertEquals(HomeDrawerReturnTarget.Row(2), collectedTarget)

        // Subsequent restore immediately returns false because target was consumed
        assertFalse(vm.restoreDrawerReturnFocus())
        job.cancel()
    }
    @Test
    fun `drawer return focus executes section target card 0 or returns Unfocused without hero fallback`() = runTest {
        val feed = makeFeed()

        // 1. Hero target
        var heroRequested = false
        val heroRes = executeHomeDrawerReturnFocus(
            target = HomeDrawerReturnTarget.Hero,
            feed = feed,
            requestHeroFocus = { heroRequested = true; true },
            requestRecentEpisodesFocus = { false },
            requestRowCardFocus = { _, _ -> false }
        )
        assertEquals(HomeDrawerReturnFocusResult.HeroFocused, heroRes)
        assertTrue(heroRequested)

        // 2. Row target success
        var rowRequested: Pair<Int, Int>? = null
        val rowRes = executeHomeDrawerReturnFocus(
            target = HomeDrawerReturnTarget.Row(1),
            feed = feed,
            requestHeroFocus = { false },
            requestRecentEpisodesFocus = { false },
            requestRowCardFocus = { r, c -> rowRequested = r to c; true }
        )
        assertEquals(HomeDrawerReturnFocusResult.RowCardFocused(1, 0), rowRes)
        assertEquals(1 to 0, rowRequested)

        // 3. Row target failure returns Unfocused and does NOT request Hero CTA
        heroRequested = false
        val rowFallbackRes = executeHomeDrawerReturnFocus(
            target = HomeDrawerReturnTarget.Row(1),
            feed = feed,
            requestHeroFocus = { heroRequested = true; true },
            requestRecentEpisodesFocus = { false },
            requestRowCardFocus = { _, _ -> false }
        )
        assertEquals(HomeDrawerReturnFocusResult.Unfocused, rowFallbackRes)
        assertFalse(heroRequested)
    }

    // ── focus coordinator safety ──

    @Test
    fun `concurrent return-focus transitions are rejected by coordinator`() = runTest {
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

    // ── drawer return focus origin tracking & lifecycle ──

    private fun makeEpisode(id: String, order: Int = 1) = TvRecentlyAddedEpisode(
        id = id,
        title = "Episode $order",
        order = order,
        thumbnailUrl = null,
        duration = 2400,
        rating = null,
        series = TvRecentlyAddedSeries(id = "s-1", title = "Series 1", posterUrl = null, backdropUrl = null),
        season = TvRecentlyAddedSeason(id = "sn-1", title = "Season 1", seasonNumber = 1),
        videoSources = emptyList()
    )

    @Test
    fun `restoreDrawerReturnFocus emits sequence of recorded origins on demand`() = runTest {
        val vm = HomeViewModel(
            mediaRepository = object : MediaRepository {
                override suspend fun getHomeFeed(): Result<HomeFeed> =
                    Result.success(HomeFeed(rows = emptyList(), hero = null, heroes = emptyList()))
                override suspend fun getSeriesById(id: String): Result<SeriesDetails> =
                    Result.failure(NotImplementedError())
            },
            coroutineScope = this
        )

        val events = mutableListOf<HomeDrawerReturnTarget>()
        val job = launch(UnconfinedTestDispatcher(testScheduler)) {
            vm.drawerReturnEvents.collect {
                events.add(it)
            }
        }

        vm.recordDrawerOrigin(HomeDrawerReturnTarget.Hero)
        assertTrue(vm.restoreDrawerReturnFocus())
        advanceUntilIdle()

        vm.recordDrawerOrigin(HomeDrawerReturnTarget.RecentlyAddedEpisodes)
        assertTrue(vm.restoreDrawerReturnFocus())
        advanceUntilIdle()

        vm.recordDrawerOrigin(HomeDrawerReturnTarget.Row(1))
        assertTrue(vm.restoreDrawerReturnFocus())
        advanceUntilIdle()

        assertEquals(
            listOf(
                HomeDrawerReturnTarget.Hero,
                HomeDrawerReturnTarget.RecentlyAddedEpisodes,
                HomeDrawerReturnTarget.Row(1)
            ),
            events
        )
        job.cancel()
    }
    // ── drawer return focus 3-step fallback execution ──

    @Test
    fun `drawer return focus executes Hero target directly`() = runTest {
        val feed = makeFeed()
        var heroRequested = false

        val result = executeHomeDrawerReturnFocus(
            target = HomeDrawerReturnTarget.Hero,
            feed = feed,
            requestHeroFocus = { heroRequested = true; true },
            requestRecentEpisodesFocus = { false },
            requestRowCardFocus = { _, _ -> false }
        )

        assertEquals(HomeDrawerReturnFocusResult.HeroFocused, result)
        assertTrue(heroRequested)
    }

    @Test
    fun `drawer return focus executes RecentlyAddedEpisodes target card 0 on step 1`() = runTest {
        val feed = makeFeed().copy(recentlyAddedEpisodes = listOf(makeEpisode("e-1")))
        var episodesRequested = false

        val result = executeHomeDrawerReturnFocus(
            target = HomeDrawerReturnTarget.RecentlyAddedEpisodes,
            feed = feed,
            requestHeroFocus = { false },
            requestRecentEpisodesFocus = { episodesRequested = true; true },
            requestRowCardFocus = { _, _ -> false }
        )

        assertEquals(HomeDrawerReturnFocusResult.RecentlyAddedEpisodesFocused, result)
        assertTrue(episodesRequested)
    }

    @Test
    fun `drawer return focus from RecentlyAddedEpisodes falls back to first row card 0 when episodes focus fails`() = runTest {
        val feed = makeFeed().copy(recentlyAddedEpisodes = listOf(makeEpisode("e-1")))
        var rowRequested: Pair<Int, Int>? = null

        val result = executeHomeDrawerReturnFocus(
            target = HomeDrawerReturnTarget.RecentlyAddedEpisodes,
            feed = feed,
            requestHeroFocus = { false },
            requestRecentEpisodesFocus = { false },
            requestRowCardFocus = { r, c -> rowRequested = r to c; true }
        )

        assertEquals(HomeDrawerReturnFocusResult.RowCardFocused(0, 0), result)
        assertEquals(0 to 0, rowRequested)
    }

    @Test
    fun `drawer return focus from RecentlyAddedEpisodes returns Unfocused and logs warning when section focus fails`() = runTest {
        val feed = makeFeed().copy(recentlyAddedEpisodes = listOf(makeEpisode("e-1")))
        var heroRequested = false
        var loggedTag: String? = null
        var loggedMessage: String? = null

        TvFocusLog.debugOverride = true
        TvFocusLog.logger = object : TvFocusLog.Logger {
            override fun d(tag: String, message: String) {}
            override fun i(tag: String, message: String) {}
            override fun w(tag: String, message: String, throwable: Throwable?) {
                loggedTag = tag
                loggedMessage = message
            }
        }

        val result = executeHomeDrawerReturnFocus(
            target = HomeDrawerReturnTarget.RecentlyAddedEpisodes,
            feed = feed,
            requestHeroFocus = { heroRequested = true; true },
            requestRecentEpisodesFocus = { false },
            requestRowCardFocus = { _, _ -> false }
        )

        assertEquals(HomeDrawerReturnFocusResult.Unfocused, result)
        assertFalse(heroRequested)
        assertEquals("TvFocus/Fallback", loggedTag)
        assertEquals("Failed to focus target RecentlyAddedEpisodes; returning Unfocused", loggedMessage)
    }

    @Test
    fun `drawer return focus to target row succeeds on step 1`() = runTest {
        val feed = makeFeed()
        var rowRequested: Pair<Int, Int>? = null

        val result = executeHomeDrawerReturnFocus(
            target = HomeDrawerReturnTarget.Row(1),
            feed = feed,
            requestHeroFocus = { false },
            requestRecentEpisodesFocus = { false },
            requestRowCardFocus = { r, c -> rowRequested = r to c; true }
        )

        assertEquals(HomeDrawerReturnFocusResult.RowCardFocused(1, 0), result)
        assertEquals(1 to 0, rowRequested)
    }

    @Test
    fun `drawer return focus to target row falls back to recent episodes when target row fails`() = runTest {
        val feed = makeFeed().copy(recentlyAddedEpisodes = listOf(makeEpisode("e-1")))
        var episodesRequested = false

        val result = executeHomeDrawerReturnFocus(
            target = HomeDrawerReturnTarget.Row(1),
            feed = feed,
            requestHeroFocus = { false },
            requestRecentEpisodesFocus = { episodesRequested = true; true },
            requestRowCardFocus = { r, _ -> if (r == 1) false else true }
        )

        assertEquals(HomeDrawerReturnFocusResult.RecentlyAddedEpisodesFocused, result)
        assertTrue(episodesRequested)
    }

    @Test
    fun `drawer return focus to target row falls back to first row card 0 when target row fails and no episodes`() = runTest {
        val feed = makeFeed()
        var rowRequested: Pair<Int, Int>? = null

        val result = executeHomeDrawerReturnFocus(
            target = HomeDrawerReturnTarget.Row(1),
            feed = feed,
            requestHeroFocus = { false },
            requestRecentEpisodesFocus = { false },
            requestRowCardFocus = { r, c ->
                if (r == 1) false
                else {
                    rowRequested = r to c
                    true
                }
            }
        )

        assertEquals(HomeDrawerReturnFocusResult.RowCardFocused(0, 0), result)
        assertEquals(0 to 0, rowRequested)
    }

    @Test
    fun `drawer return focus to target row returns Unfocused and logs warning when rows and episodes fail`() = runTest {
        val feed = makeFeed()
        var heroRequested = false
        var loggedTag: String? = null
        var loggedMessage: String? = null

        TvFocusLog.debugOverride = true
        TvFocusLog.logger = object : TvFocusLog.Logger {
            override fun d(tag: String, message: String) {}
            override fun i(tag: String, message: String) {}
            override fun w(tag: String, message: String, throwable: Throwable?) {
                loggedTag = tag
                loggedMessage = message
            }
        }

        val target = HomeDrawerReturnTarget.Row(1)
        val result = executeHomeDrawerReturnFocus(
            target = target,
            feed = feed,
            requestHeroFocus = { heroRequested = true; true },
            requestRecentEpisodesFocus = { false },
            requestRowCardFocus = { _, _ -> false }
        )

        assertEquals(HomeDrawerReturnFocusResult.Unfocused, result)
        assertFalse(heroRequested)
        assertEquals("TvFocus/Fallback", loggedTag)
        assertEquals("Failed to focus target Row(rowIndex=1); returning Unfocused", loggedMessage)
    }

    @Test
    fun `drawer return focus to hero returns Unfocused and logs warning when hero focus fails`() = runTest {
        val feed = makeFeed()
        var loggedTag: String? = null
        var loggedMessage: String? = null

        TvFocusLog.debugOverride = true
        TvFocusLog.logger = object : TvFocusLog.Logger {
            override fun d(tag: String, message: String) {}
            override fun i(tag: String, message: String) {}
            override fun w(tag: String, message: String, throwable: Throwable?) {
                loggedTag = tag
                loggedMessage = message
            }
        }

        val target = HomeDrawerReturnTarget.Hero
        val result = executeHomeDrawerReturnFocus(
            target = target,
            feed = feed,
            requestHeroFocus = { false },
            requestRecentEpisodesFocus = { false },
            requestRowCardFocus = { _, _ -> false }
        )

        assertEquals(HomeDrawerReturnFocusResult.Unfocused, result)
        assertEquals("TvFocus/Fallback", loggedTag)
        assertEquals("Failed to focus target Hero; returning Unfocused", loggedMessage)
    }

    @Test
    fun `drawer return focus returns Unfocused when all 3 fallback steps fail`() = runTest {
        val feed = makeFeed()

        val result = executeHomeDrawerReturnFocus(
            target = HomeDrawerReturnTarget.Row(1),
            feed = feed,
            requestHeroFocus = { false },
            requestRecentEpisodesFocus = { false },
            requestRowCardFocus = { _, _ -> false }
        )

        assertEquals(HomeDrawerReturnFocusResult.Unfocused, result)
    }
}
