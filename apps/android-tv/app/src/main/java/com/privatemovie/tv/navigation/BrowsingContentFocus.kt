package com.privatemovie.tv.navigation

import com.privatemovie.tv.components.drawer.DrawerDestination
import com.privatemovie.tv.components.drawer.NavigationDrawerState

/**
 * Content area of a browsing screen that must regain focus once the
 * navigation drawer collapses.
 *
 * The drawer is a sibling overlay of the browsing screens (Home, Search,
 * Genre catalog). When it collapses — via D-pad Right, remote Back or a
 * destination selection — the TV focus engine would otherwise keep focus on
 * the (now collapsed) drawer rail. Each browsing screen therefore exposes one
 * focus target that the drawer shell can hand focus back to.
 */
enum class BrowsingContentTarget {
    /** Home hero CTA (falls back to the first feed row). */
    HOME_HERO,

    /** Search text field. */
    SEARCH_FIELD,

    /** Genre catalog header — the filter pill row. */
    GENRE_HEADER,
}

/**
 * Maps an active NavHost route to the content focus target of that screen.
 *
 * Accepts both NavHost pattern routes (`"genre/{slug}"`) and concrete routes
 * (`"genre/animation"`) so callers can pass either form.
 *
 * @return the matching target, or `null` for routes without drawer content
 *   (Detail, Player, unknown routes).
 */
fun browsingContentTargetForRoute(route: String?): BrowsingContentTarget? = when {
    route == null -> null
    route == TvScreen.Home.route -> BrowsingContentTarget.HOME_HERO
    route == TvScreen.Search.route -> BrowsingContentTarget.SEARCH_FIELD
    route == TvScreen.Genre.route -> BrowsingContentTarget.GENRE_HEADER
    route.startsWith("genre/") -> BrowsingContentTarget.GENRE_HEADER
    else -> null
}

/**
 * Maps a drawer destination to the content focus target of the screen it
 * opens, so focus can be handed to the destination screen after navigation.
 */
fun browsingContentTargetForDestination(destination: DrawerDestination): BrowsingContentTarget =
    when (destination) {
        DrawerDestination.Search -> BrowsingContentTarget.SEARCH_FIELD
        DrawerDestination.Home -> BrowsingContentTarget.HOME_HERO
        is DrawerDestination.Genre -> BrowsingContentTarget.GENRE_HEADER
    }

/**
 * Coordinates the drawer ⇄ page-content interaction of the browsing shell.
 *
 * Enforces key rules across drawer and route focus interactions:
 * - Selecting a destination always collapses the drawer *before* navigating,
 *   so the drawer never stays expanded across a screen transition.
 * - Collapsing the drawer (D-pad Right / Back) always hands focus back to the
 *   page content instead of leaving it on the collapsed rail.
 * - On [TvScreen.Home], collapsing the drawer activates the home screen's origin
 *   return focus restoration when a target is pending, falling back to default
 *   content focus when no origin is recorded.
 * - Hardware / remote Back when expanded collapses the drawer and returns focus to
 *   the active screen without triggering the underlying screen's back handler.
 *
 * Deliberately free of Compose UI so the behaviour is unit-testable on the
 * plain JVM.
 */
class DrawerNavigationCoordinator(
    val drawerState: NavigationDrawerState,
    private val onNavigate: (DrawerDestination) -> Unit,
    private val onFocusContent: () -> Unit,
    private val onRestoreHomeFocus: (() -> Boolean)? = null,
    private val currentRoute: () -> String? = { null },
) {
    /**
     * Intercepts Back when the drawer is expanded, collapsing it and returning
     * focus to the active page content.
     *
     * @param onFallbackBack fallback invoked when the drawer is collapsed and does
     *   not intercept the back event (e.g. underlying screen's back handler).
     * @return true if the back event was consumed by the drawer, false otherwise.
     */
    fun handleBack(onFallbackBack: (() -> Unit)? = null): Boolean {
        if (drawerState.expanded) {
            collapseAndFocusContent()
            return true
        }
        onFallbackBack?.invoke()
        return false
    }

    /**
     * Collapses the drawer and forwards the destination to the caller, which
     * performs the actual navigation.
     */
    fun selectDestination(destination: DrawerDestination) {
        drawerState.collapse()
        onNavigate(destination)
    }

    /**
     * Collapses the drawer and hands focus back to the active page content.
     * When collapsing on the Home screen with origin return focus available,
     * activates the home return focus flow.
     */
    fun collapseAndFocusContent() {
        drawerState.collapse()
        val isHome = currentRoute() == TvScreen.Home.route
        val homeRestored = if (isHome) onRestoreHomeFocus?.invoke() == true else false
        if (!homeRestored) {
            onFocusContent()
        }
    }
}
