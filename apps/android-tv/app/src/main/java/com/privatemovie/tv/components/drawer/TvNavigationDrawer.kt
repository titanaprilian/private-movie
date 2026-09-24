package com.privatemovie.tv.components.drawer

import androidx.compose.animation.core.animateDpAsState
import androidx.compose.animation.core.tween
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.focus.onFocusChanged
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.input.key.KeyEventType
import androidx.compose.ui.input.key.onKeyEvent
import androidx.compose.ui.input.key.type
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import com.privatemovie.tv.components.isRepeatKeyEvent
import com.privatemovie.tv.dto.models.GenreItem

private const val DRAWER_ANIMATION_MS = 220

private val RailBackground = Color(0xCC14141A)
private val ExpandedBackground = Color(0xF21A1A22)
private val ScrimColor = Color(0x66000000)
private val ActivePillColor = Color(0xFF3A3A48)
private val FocusedPillBorder = Color(0xFFFFFFFF)

/**
 * Reusable collapsible TV left navigation drawer.
 *
 * - Collapsed: slim 72dp translucent icon rail (monogram + Search + Home +
 *   Big Genre icons).
 * - Expanded: ~280dp flyout with full text labels plus a dark scrim over the
 *   content area. Any drawer item gaining focus expands the drawer; D-pad
 *   Right and remote Back collapse it back to the rail and invoke
 *   [onCollapseFocusContent] so the caller can return focus to page content.
 *
 * @param bigGenres raw `GET /genres` payload; only `isBigGenre` entries are
 *   shown, sorted by `displayOrder` ascending.
 * @param currentRoute active NavHost route (`"home"`, `"search"`,
 *   `"genre/<slug>"`) used for the active pill highlight.
 * @param drawerState hoisted [NavigationDrawerState]; defaults to a
 *   remembered instance.
 */
@Composable
fun TvNavigationDrawer(
    bigGenres: List<GenreItem>,
    currentRoute: String?,
    modifier: Modifier = Modifier,
    drawerState: NavigationDrawerState = remember { NavigationDrawerState() },
    drawerFocusRequester: FocusRequester? = null,
    onSelectDestination: (DrawerDestination) -> Unit = drawerState::selectDestination,
    onCollapseFocusContent: () -> Unit = {},
) {
    val visibleGenres = remember(bigGenres) { bigGenresSorted(bigGenres) }
    val destinations = remember(visibleGenres) { drawerDestinations(visibleGenres) }
    val activeDestination = remember(currentRoute, visibleGenres) {
        resolveActiveDestination(currentRoute, visibleGenres)
    }

    val animatedWidth by animateDpAsState(
        targetValue = drawerState.drawerWidthDp.dp,
        animationSpec = tween(durationMillis = DRAWER_ANIMATION_MS),
        label = "TvNavigationDrawerWidth",
    )

    Box(modifier = modifier.fillMaxSize()) {
        // Dark scrim over content while expanded.
        if (drawerState.expanded) {
            Box(
                modifier = Modifier
                    .fillMaxSize()
                    .background(ScrimColor),
            )
        }

        Column(
            modifier = Modifier
                .fillMaxHeight()
                .width(animatedWidth)
                .background(if (drawerState.expanded) ExpandedBackground else RailBackground)
                .then(if (drawerFocusRequester != null) Modifier.focusRequester(drawerFocusRequester) else Modifier)
                .onKeyEvent { keyEvent ->
                    if (isRepeatKeyEvent(keyEvent)) return@onKeyEvent false
                    val action = drawerState.handleKeyDown(
                        keyCode = keyEvent.nativeKeyEvent.keyCode,
                        isKeyDown = keyEvent.type == KeyEventType.KeyDown,
                    )
                    if (action == DrawerKeyAction.COLLAPSE_AND_FOCUS_CONTENT) {
                        onCollapseFocusContent()
                        true
                    } else {
                        false
                    }
                }
                .padding(vertical = 12.dp, horizontal = 8.dp),
            horizontalAlignment = Alignment.Start,
        ) {
            DrawerHeader(expanded = drawerState.expanded)
            Spacer(modifier = Modifier.height(12.dp))
            destinations.forEach { destination ->
                DrawerItemRow(
                    destination = destination,
                    expanded = drawerState.expanded,
                    isActive = destination == activeDestination,
                    onFocused = { drawerState.onDrawerItemFocused() },
                    onSelected = { onSelectDestination(destination) },
                )
                Spacer(modifier = Modifier.height(4.dp))
            }
        }
    }
}

@Composable
private fun DrawerHeader(expanded: Boolean) {
    Row(
        verticalAlignment = Alignment.CenterVertically,
        modifier = Modifier
            .padding(horizontal = 8.dp, vertical = 6.dp),
    ) {
        Box(
            contentAlignment = Alignment.Center,
            modifier = Modifier
                .clip(RoundedCornerShape(8.dp))
                .background(Color(0xFFE50914))
                .padding(horizontal = 10.dp, vertical = 6.dp),
        ) {
            Text(
                text = "P",
                color = Color.White,
                style = MaterialTheme.typography.titleMedium,
                fontWeight = FontWeight.Black,
            )
        }
        if (expanded) {
            Text(
                text = "  PRIVATE MOVIE",
                color = Color.White,
                style = MaterialTheme.typography.titleSmall,
                fontWeight = FontWeight.Bold,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
            )
        }
    }
}

@Composable
private fun DrawerItemRow(
    destination: DrawerDestination,
    expanded: Boolean,
    isActive: Boolean,
    onFocused: () -> Unit,
    onSelected: () -> Unit,
) {
    var isFocused by remember { mutableStateOf(false) }
    LaunchedEffect(isFocused) {
        if (isFocused) onFocused()
    }

    val (glyph, label) = when (destination) {
        DrawerDestination.Search -> "\uD83D\uDD0D" to "Search"
        DrawerDestination.Home -> "\uD83C\uDFE0" to "Home"
        is DrawerDestination.Genre -> genreGlyph(destination.slug) to destination.name
    }

    Row(
        verticalAlignment = Alignment.CenterVertically,
        modifier = Modifier
            .clip(RoundedCornerShape(20.dp))
            .background(if (isActive) ActivePillColor else Color.Transparent)
            .onFocusChanged { isFocused = it.isFocused }
            .clickable(onClick = onSelected)
            .padding(horizontal = 10.dp, vertical = 8.dp),
    ) {
        Text(
            text = glyph,
            style = MaterialTheme.typography.titleMedium,
        )
        if (expanded) {
            Text(
                text = "  $label",
                color = if (isFocused) FocusedPillBorder else Color(0xFFE8E8EC),
                style = MaterialTheme.typography.bodyLarge,
                fontWeight = if (isActive) FontWeight.Bold else FontWeight.Normal,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
            )
        }
    }
}

/**
 * Stable glyph per genre slug so the collapsed 72dp rail shows a distinct
 * icon per Big Genre without bundling vector assets.
 */
internal fun genreGlyph(slug: String): String {
    val normalised = slug.lowercase()
    return when {
        "anim" in normalised -> "\uD83C\uDFA8"
        "korea" in normalised -> "\uD83C\uDFAC"
        "china" in normalised || "chinese" in normalised -> "\uD83D\uDC32"
        "japan" in normalised -> "\uD83C\uDF5C"
        "horror" in normalised -> "\uD83C\uDFA9"
        "comedy" in normalised -> "\uD83D\uDE02"
        "drama" in normalised -> "\uD83C\uDFAD"
        "action" in normalised -> "\uD83D\uDCA5"
        else -> "\uD83C\uDF9E️"
    }
}
