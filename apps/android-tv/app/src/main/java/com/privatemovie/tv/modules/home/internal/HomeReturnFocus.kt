package com.privatemovie.tv.modules.home.internal

/**
 * Origin-tracked focus target for returning from the Detail screen to Home.
 *
 * Records where the user launched the Detail screen from so focus can be
 * restored to that exact origin item when popping back.
 */
sealed interface HomeReturnFocusTarget {
    /** User launched Detail from the Featured Hero Slider CTA. */
    data class Hero(val seriesId: String) : HomeReturnFocusTarget

    /**
     * User launched Detail from a catalog row card.
     *
     * @param rowIndex index into [TvHomeFeed.rows].
     * @param cardIndex index of the card within the row.
     * @param seriesId id of the launched series (used to validate the row still matches).
     */
    data class RowCard(
        val rowIndex: Int,
        val cardIndex: Int,
        val seriesId: String
    ) : HomeReturnFocusTarget
}

/**
 * Resolved, feed-validated focus destination.
 *
 * Resolution validates the recorded origin against the current [TvHomeFeed]
 * so stale indices (feed refresh while on Detail) degrade gracefully through
 * the 3-step fallback hierarchy instead of focusing the wrong card.
 */
sealed interface ResolvedHomeReturnFocus {
    /** Focus the Hero CTA button. */
    data object HeroCta : ResolvedHomeReturnFocus

    /**
     * Focus a card in a row.
     *
     * @param rowIndex validated row index.
     * @param cardIndex validated card index (series-id matched when possible,
     * otherwise clamped into range; executor falls back to Card 0 on failure).
     */
    data class RowCard(val rowIndex: Int, val cardIndex: Int) : ResolvedHomeReturnFocus
}

/**
 * Records a Hero CTA selection as a return-focus origin.
 */
fun heroSelectionTarget(seriesId: String): HomeReturnFocusTarget.Hero =
    HomeReturnFocusTarget.Hero(seriesId = seriesId)

/**
 * Records a catalog row card selection as a return-focus origin.
 */
fun rowCardSelectionTarget(
    rowIndex: Int,
    cardIndex: Int,
    seriesId: String
): HomeReturnFocusTarget.RowCard =
    HomeReturnFocusTarget.RowCard(rowIndex = rowIndex, cardIndex = cardIndex, seriesId = seriesId)

/**
 * Whether Home should attempt focus restoration on entry.
 */
fun shouldRestoreHomeFocus(target: HomeReturnFocusTarget?): Boolean = target != null

/**
 * Resolves a recorded [target] against the current [feed].
 *
 * - Hero origin always resolves to [ResolvedHomeReturnFocus.HeroCta].
 * - RowCard origin resolves to the exact card when row index, card index and
 *   series ID all match; if the series moved within the same row its new index
 *   is used; if the row is missing/empty resolution degrades to HeroCta
 *   (fallback step 3); otherwise the card index is clamped into range and the
 *   executor applies the Card-0 fallback (step 2) on acquisition failure.
 * - Null target resolves to null (no restoration; keep default hero focus).
 */
fun resolveHomeReturnFocus(
    feed: TvHomeFeed,
    target: HomeReturnFocusTarget?
): ResolvedHomeReturnFocus? {
    if (target == null) return null
    return when (target) {
        is HomeReturnFocusTarget.Hero -> ResolvedHomeReturnFocus.HeroCta
        is HomeReturnFocusTarget.RowCard -> {
            val row = feed.rows.getOrNull(target.rowIndex) ?: return ResolvedHomeReturnFocus.HeroCta
            if (row.items.isEmpty()) return ResolvedHomeReturnFocus.HeroCta
            val exactMatch = row.items.getOrNull(target.cardIndex)?.id == target.seriesId
            if (exactMatch) {
                return ResolvedHomeReturnFocus.RowCard(
                    rowIndex = target.rowIndex,
                    cardIndex = target.cardIndex
                )
            }
            val movedIndex = row.items.indexOfFirst { it.id == target.seriesId }
            if (movedIndex >= 0) {
                return ResolvedHomeReturnFocus.RowCard(
                    rowIndex = target.rowIndex,
                    cardIndex = movedIndex
                )
            }
            // Stale index (feed changed while on Detail): clamp so the executor
            // can attempt the remembered position then fall back to Card 0.
            val clamped = target.cardIndex.coerceIn(0, row.items.size - 1)
            ResolvedHomeReturnFocus.RowCard(rowIndex = target.rowIndex, cardIndex = clamped)
        }
    }
}

/**
 * Outcome of executing a resolved return-focus restoration.
 */
sealed interface HomeReturnFocusResult {
    /** Hero CTA acquired focus. */
    data object HeroFocused : HomeReturnFocusResult

    /** A row card acquired focus. */
    data class RowCardFocused(val rowIndex: Int, val cardIndex: Int) : HomeReturnFocusResult

    /** Nothing could acquire focus (caller keeps current focus). */
    data object Unfocused : HomeReturnFocusResult
}

/**
 * Executes a [resolved] return-focus plan against focus-request side effects.
 *
 * Scroll synchronization (vertical LazyColumn + horizontal LazyRow bringing the
 * card into view) is the caller's responsibility before invoking this.
 *
 * Fallback hierarchy:
 * 1. Target card in row.
 * 2. Card 0 of that row when primary acquisition fails.
 * 3. Hero CTA when the row is missing/empty or neither card acquires focus.
 *
 * @param requestCardFocus side effect requesting focus on a card; returns true on success.
 * @param requestHeroFocus side effect requesting focus on the Hero CTA; returns true on success.
 */
suspend fun executeHomeReturnFocus(
    resolved: ResolvedHomeReturnFocus,
    requestCardFocus: suspend (rowIndex: Int, cardIndex: Int) -> Boolean,
    requestHeroFocus: suspend () -> Boolean
): HomeReturnFocusResult {
    return when (resolved) {
        is ResolvedHomeReturnFocus.HeroCta -> {
            if (requestHeroFocus()) HomeReturnFocusResult.HeroFocused
            else HomeReturnFocusResult.Unfocused
        }
        is ResolvedHomeReturnFocus.RowCard -> {
            if (requestCardFocus(resolved.rowIndex, resolved.cardIndex)) {
                return HomeReturnFocusResult.RowCardFocused(resolved.rowIndex, resolved.cardIndex)
            }
            if (resolved.cardIndex != 0 && requestCardFocus(resolved.rowIndex, 0)) {
                return HomeReturnFocusResult.RowCardFocused(resolved.rowIndex, 0)
            }
            if (requestHeroFocus()) HomeReturnFocusResult.HeroFocused
            else HomeReturnFocusResult.Unfocused
        }
    }
}

/**
 * Outcome of executing a drawer return-focus restoration.
 */
sealed interface HomeDrawerReturnFocusResult {
    data object HeroFocused : HomeDrawerReturnFocusResult
    data object RecentlyAddedEpisodesFocused : HomeDrawerReturnFocusResult
    data class RowCardFocused(val rowIndex: Int, val cardIndex: Int) : HomeDrawerReturnFocusResult
    data object Unfocused : HomeDrawerReturnFocusResult
}

/**
 * Executes a drawer return focus plan with a 3-step fallback hierarchy:
 * 1. Target section card 0 (Hero CTA, Recently Added Episodes card 0, or Row(rowIndex) card 0).
 * 2. If target section card 0 fails, falls back to first section card 0.
 * 3. Scrolls to top and focuses the Hero CTA button.
 */
suspend fun executeHomeDrawerReturnFocus(
    target: HomeDrawerReturnTarget,
    feed: TvHomeFeed,
    requestHeroFocus: suspend () -> Boolean,
    requestRecentEpisodesFocus: suspend () -> Boolean,
    requestRowCardFocus: suspend (rowIndex: Int, cardIndex: Int) -> Boolean
): HomeDrawerReturnFocusResult {
    when (target) {
        is HomeDrawerReturnTarget.Hero -> {
            if (requestHeroFocus()) return HomeDrawerReturnFocusResult.HeroFocused
            return HomeDrawerReturnFocusResult.Unfocused
        }
        is HomeDrawerReturnTarget.RecentlyAddedEpisodes -> {
            // Step 1: Target section card 0 (Recently Added Episodes)
            if (feed.recentlyAddedEpisodes.isNotEmpty() && requestRecentEpisodesFocus()) {
                return HomeDrawerReturnFocusResult.RecentlyAddedEpisodesFocused
            }
            // Step 2: First section card 0 (first non-empty catalog row card 0)
            val firstNonEmptyRowIndex = feed.rows.indexOfFirst { it.items.isNotEmpty() }
            if (firstNonEmptyRowIndex >= 0 && requestRowCardFocus(firstNonEmptyRowIndex, 0)) {
                return HomeDrawerReturnFocusResult.RowCardFocused(firstNonEmptyRowIndex, 0)
            }
            // Step 3: Hero CTA
            if (requestHeroFocus()) return HomeDrawerReturnFocusResult.HeroFocused
            return HomeDrawerReturnFocusResult.Unfocused
        }
        is HomeDrawerReturnTarget.Row -> {
            // Step 1: Target section card 0
            val row = feed.rows.getOrNull(target.rowIndex)
            if (row != null && row.items.isNotEmpty()) {
                if (requestRowCardFocus(target.rowIndex, 0)) {
                    return HomeDrawerReturnFocusResult.RowCardFocused(target.rowIndex, 0)
                }
            }
            // Step 2: First section card 0
            if (feed.recentlyAddedEpisodes.isNotEmpty()) {
                if (requestRecentEpisodesFocus()) {
                    return HomeDrawerReturnFocusResult.RecentlyAddedEpisodesFocused
                }
            }
            val firstNonEmptyRowIndex = feed.rows.indexOfFirst { it.items.isNotEmpty() }
            if (firstNonEmptyRowIndex >= 0 && firstNonEmptyRowIndex != target.rowIndex) {
                if (requestRowCardFocus(firstNonEmptyRowIndex, 0)) {
                    return HomeDrawerReturnFocusResult.RowCardFocused(firstNonEmptyRowIndex, 0)
                }
            }
            // Step 3: Hero CTA
            if (requestHeroFocus()) return HomeDrawerReturnFocusResult.HeroFocused
            return HomeDrawerReturnFocusResult.Unfocused
        }
    }
}
