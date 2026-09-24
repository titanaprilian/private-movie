package com.privatemovie.tv.components.drawer

import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue

/**
 * Outcome of feeding a hardware key event into [NavigationDrawerState].
 */
enum class DrawerKeyAction {
    /** Collapse the drawer and hand focus back to page content. */
    COLLAPSE_AND_FOCUS_CONTENT,

    /** Key was handled but needs no focus handoff (e.g. repeat guard). */
    CONSUMED,
}

/**
 * UI-agnostic state machine for the collapsible TV left navigation drawer.
 *
 * Kept free of Compose UI and Android key classes so it is unit-testable on
 * the plain JVM: callers pass the raw [android.view.KeyEvent] key code as an
 * [Int] (e.g. `KEYCODE_DPAD_RIGHT`, `KEYCODE_BACK`).
 *
 * Contract:
 * - Any drawer item gaining focus expands the drawer.
 * - D-pad Right or remote Back while expanded collapses the drawer and the
 *   caller must return focus to page content ([DrawerKeyAction.COLLAPSE_AND_FOCUS_CONTENT]).
 * - Selecting an item collapses the drawer; the caller navigates and then
 *   hands focus to content via [onSelectDestination].
 */
class NavigationDrawerState(
    val onCollapseFocusContent: () -> Unit = {},
    val onSelectDestination: (DrawerDestination) -> Unit = {},
) {
    var expanded: Boolean by mutableStateOf(false)
        private set

    val drawerWidthDp: Int
        get() = if (expanded) TvDrawerDefaults.EXPANDED_WIDTH_DP else TvDrawerDefaults.COLLAPSED_WIDTH_DP

    fun onDrawerItemFocused() {
        expanded = true
    }

    fun collapse() {
        expanded = false
    }

    fun expand() {
        expanded = true
    }

    /**
     * Handles a hardware key-down inside the drawer. Returns the action the
     * caller must perform, or `null` when the key is not handled.
     *
     * @param keyCode raw `android.view.KeyEvent` key code.
     * @param isKeyDown true for ACTION_DOWN only; key-up events are ignored.
     * @param isRepeat true for held-key repeats, which are swallowed.
     */
    fun handleKeyDown(keyCode: Int, isKeyDown: Boolean, isRepeat: Boolean = false): DrawerKeyAction? {
        if (!isKeyDown || isRepeat) return null
        if (!expanded) return null
        return when (keyCode) {
            android.view.KeyEvent.KEYCODE_DPAD_RIGHT,
            android.view.KeyEvent.KEYCODE_BACK,
            android.view.KeyEvent.KEYCODE_ESCAPE,
            -> {
                collapse()
                onCollapseFocusContent()
                DrawerKeyAction.COLLAPSE_AND_FOCUS_CONTENT
            }
            else -> null
        }
    }

    /**
     * Selects a drawer destination: collapses the drawer and forwards the
     * destination so the caller can navigate and hand focus to content.
     */
    fun selectDestination(destination: DrawerDestination) {
        collapse()
        onSelectDestination(destination)
    }
}
