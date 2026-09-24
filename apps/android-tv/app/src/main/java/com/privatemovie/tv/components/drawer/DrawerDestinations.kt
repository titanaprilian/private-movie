package com.privatemovie.tv.components.drawer

import com.privatemovie.tv.dto.models.GenreItem

/**
 * Width contract for the collapsible TV left navigation drawer.
 *
 * Matches the 10-foot design guidelines used by Netflix / Prime Video /
 * Disney+: a slim persistent icon rail that expands into a labelled flyout.
 */
object TvDrawerDefaults {
    const val COLLAPSED_WIDTH_DP = 72
    const val EXPANDED_WIDTH_DP = 280
}

/**
 * External behavioural contract of the drawer.
 *
 * Only this — never Compose styling details — is covered by unit tests.
 */
sealed interface DrawerDestination {
    data object Search : DrawerDestination
    data object Home : DrawerDestination
    data class Genre(val slug: String, val name: String) : DrawerDestination
}

/**
 * Filters the raw `GET /genres` payload down to the Big Genres shown in the
 * drawer, sorted by [GenreItem.displayOrder] ascending so drawer order is
 * deterministic regardless of backend row order.
 */
fun bigGenresSorted(genres: List<GenreItem>): List<GenreItem> =
    genres
        .filter { it.isBigGenre }
        .sortedWith(compareBy({ it.displayOrder }, { it.slug }))

/**
 * Maps the ordered drawer destinations: fixed Search + Home entries first,
 * then the Big Genres in display order.
 */
fun drawerDestinations(bigGenres: List<GenreItem>): List<DrawerDestination> =
    listOf(DrawerDestination.Search, DrawerDestination.Home) +
        bigGenres.map { DrawerDestination.Genre(slug = it.slug, name = it.name) }

/**
 * Resolves which drawer destination is active for a NavHost route string.
 *
 * Accepted routes: `"search"`, `"home"`, `"genre/<slug>"`. Any other route
 * (detail, player, unknown) maps to `null` — no pill is highlighted.
 */
fun resolveActiveDestination(
    currentRoute: String?,
    bigGenres: List<GenreItem>,
): DrawerDestination? {
    if (currentRoute == null) return null
    return when {
        currentRoute == "search" -> DrawerDestination.Search
        currentRoute == "home" -> DrawerDestination.Home
        currentRoute.startsWith("genre/") -> {
            val slug = currentRoute.removePrefix("genre/")
            bigGenres.firstOrNull { it.slug == slug }
                ?.let { DrawerDestination.Genre(slug = it.slug, name = it.name) }
        }
        else -> null
    }
}
