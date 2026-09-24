package com.privatemovie.tv.navigation

import com.privatemovie.tv.components.drawer.DrawerDestination

/**
 * Global navigation shell helpers for the collapsible TV left drawer.
 *
 * The drawer wraps only the top-level browsing destinations (Home, Search,
 * Genre). It is suppressed completely on the Player route (`player/{id}`)
 * so video playback is fully immersive — and on Detail / unknown routes
 * which are not browsing destinations.
 *
 * Kept free of NavController so it is unit-testable on the plain JVM.
 */

/**
 * Returns true when the drawer should be visible for [route].
 *
 * Accepts both NavHost pattern routes (`"genre/{slug}"`, `"player/{episodeId}"`)
 * and concrete routes (`"genre/animation"`, `"player/ep-1"`) so callers can
 * pass either `destination.route` or a resolved route string.
 */
fun isDrawerVisibleForRoute(route: String?): Boolean {
    if (route == null) return false
    return when {
        route == TvScreen.Home.route -> true
        route == TvScreen.Search.route -> true
        route == TvScreen.Genre.route -> true
        route.startsWith("genre/") -> true
        else -> false
    }
}

/**
 * Maps a drawer selection to the concrete NavHost route to navigate to.
 */
fun drawerDestinationToRoute(destination: DrawerDestination): String =
    when (destination) {
        DrawerDestination.Search -> TvScreen.Search.route
        DrawerDestination.Home -> TvScreen.Home.route
        is DrawerDestination.Genre -> TvScreen.Genre.createRoute(destination.slug)
    }

/**
 * Resolves the concrete drawer route (`"home"`, `"search"`, `"genre/<slug>"`)
 * from a NavHost destination pattern plus its arguments, so the drawer's
 * active-pill highlight follows the current genre slug.
 */
fun resolveDrawerCurrentRoute(destinationRoute: String?, argumentSlug: String?): String? =
    when (destinationRoute) {
        TvScreen.Home.route -> TvScreen.Home.route
        TvScreen.Search.route -> TvScreen.Search.route
        TvScreen.Genre.route ->
            if (argumentSlug.isNullOrEmpty()) TvScreen.Genre.route
            else TvScreen.Genre.createRoute(argumentSlug)
        else -> destinationRoute?.let {
            // Already-concrete browsing routes passed through (e.g. tests).
            if (isDrawerVisibleForRoute(it)) it else null
        }
    }

/**
 * Full-bleed content contract for browsing screens (Home, Genre, Search).
 *
 * The NavHost shell pads page content by the collapsed rail width so the
 * drawer never occludes content; screens keep their own comfortable inner
 * gutters on top. Hero backdrops extend to the top safe boundary because no
 * top bar is rendered above them.
 */
const val BROWSING_CONTENT_RAIL_PADDING_DP = 72

/** Column count of the 5-column browsing poster grids (Genre + Search). */
const val BROWSING_GRID_COLUMNS = 5

/**
 * Returns true when a card at [index] sits in the leftmost column and D-pad
 * Left from it must shift focus into the left navigation drawer instead of
 * moving to a sibling card.
 */
fun isLeftmostBrowsingIndex(index: Int, columns: Int = BROWSING_GRID_COLUMNS): Boolean {
    if (index < 0 || columns <= 0) return false
    return index % columns == 0
}

/**
 * Pure key-routing contract for left-edge cards: D-pad Left on the leftmost
 * card is consumed to focus the drawer; all other keys / positions are left
 * to the default focus system.
 *
 * @param keyCode raw `android.view.KeyEvent` key code.
 * @param isKeyDown true for ACTION_DOWN only.
 * @param isLeftmost true when the focused card is in the leftmost column
 *   ([isLeftmostBrowsingIndex]) or is the hero CTA / row card at index 0.
 */
fun shouldFocusDrawerOnKey(keyCode: Int, isKeyDown: Boolean, isLeftmost: Boolean): Boolean {
    if (!isKeyDown || !isLeftmost) return false
    return keyCode == android.view.KeyEvent.KEYCODE_DPAD_LEFT
}
