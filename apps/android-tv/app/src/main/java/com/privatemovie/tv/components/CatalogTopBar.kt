package com.privatemovie.tv.components

import android.view.KeyEvent.ACTION_DOWN
import android.view.KeyEvent.KEYCODE_DPAD_DOWN
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.input.key.onKeyEvent
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.tv.material3.Border
import androidx.tv.material3.Button as TvButton
import androidx.tv.material3.ButtonDefaults as TvButtonDefaults
import com.privatemovie.tv.components.isRepeatKeyEvent
import com.privatemovie.tv.dto.models.GenreItem
import com.privatemovie.tv.modules.home.internal.CatalogHeaderUiState
import com.privatemovie.tv.modules.home.internal.CatalogSearchViewModel
import com.privatemovie.tv.modules.home.internal.CatalogTopBarViewModel

/**
 * Unified, reusable top navigation bar for TV catalog screens.
 *
 * Displays the app logo, a "Home" link (highlighted when [activeGenreSlug] is
 * null), dynamic Big Genre links, and an interactive [CatalogSearch].
 *
 * D-pad Down from any header item invokes [onDownToContent] so hosts (e.g.
 * `HomeScreen` hero) receive focus predictably.
 */
@Composable
fun CatalogTopBar(
    headerViewModel: CatalogTopBarViewModel,
    searchViewModel: CatalogSearchViewModel,
    onNavigateHome: () -> Unit,
    onSelectGenre: (String) -> Unit,
    onSelectSeries: (String) -> Unit,
    modifier: Modifier = Modifier,
    activeGenreSlug: String? = null,
    headerFocusRequester: FocusRequester? = null,
    onDownToContent: (() -> Unit)? = null
) {
    val headerState by headerViewModel.uiState.collectAsState()
    val bigGenres = when (val state = headerState) {
        is CatalogHeaderUiState.Success -> state.bigGenres
        else -> emptyList()
    }

    CatalogTopBarContent(
        bigGenres = bigGenres,
        searchViewModel = searchViewModel,
        onNavigateHome = onNavigateHome,
        onSelectGenre = onSelectGenre,
        onSelectSeries = onSelectSeries,
        modifier = modifier,
        activeGenreSlug = activeGenreSlug,
        headerFocusRequester = headerFocusRequester,
        onDownToContent = onDownToContent
    )
}

@Composable
fun CatalogTopBarContent(
    bigGenres: List<GenreItem>,
    searchViewModel: CatalogSearchViewModel,
    onNavigateHome: () -> Unit,
    onSelectGenre: (String) -> Unit,
    onSelectSeries: (String) -> Unit,
    modifier: Modifier = Modifier,
    activeGenreSlug: String? = null,
    headerFocusRequester: FocusRequester? = null,
    onDownToContent: (() -> Unit)? = null
) {
    val homeFocus = remember { FocusRequester() }
    val effectiveHomeFocus = headerFocusRequester ?: homeFocus
    val genreFocusers = remember(bigGenres) { bigGenres.map { FocusRequester() } }

    Row(
        modifier = modifier
            .fillMaxWidth()
            .height(56.dp)
            .padding(horizontal = 48.dp),
        horizontalArrangement = Arrangement.SpaceBetween,
        verticalAlignment = Alignment.CenterVertically
    ) {
        Row(
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(8.dp),
            modifier = Modifier.weight(1f)
        ) {
            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(12.dp),
                modifier = Modifier.padding(end = 8.dp)
            ) {
                Text(
                    text = "PRIVATE MOVIE",
                    style = MaterialTheme.typography.titleLarge.copy(
                        fontWeight = FontWeight.Black,
                        letterSpacing = 2.sp
                    ),
                    color = MaterialTheme.colorScheme.primary
                )
                Box(
                    modifier = Modifier
                        .clip(RoundedCornerShape(4.dp))
                        .background(Color.White.copy(alpha = 0.12f))
                        .padding(horizontal = 6.dp, vertical = 2.dp)
                ) {
                    Text(
                        text = "TV",
                        style = MaterialTheme.typography.labelSmall.copy(
                            fontWeight = FontWeight.Bold,
                            letterSpacing = 1.sp
                        ),
                        color = Color.White.copy(alpha = 0.8f)
                    )
                }
            }

            HeaderNavPill(
                label = "Home",
                isActive = activeGenreSlug == null,
                focusRequester = effectiveHomeFocus,
                onClick = onNavigateHome,
                onDownToContent = onDownToContent
            )
            bigGenres.forEachIndexed { index, genre ->
                HeaderNavPill(
                    label = genre.name,
                    isActive = activeGenreSlug == genre.slug,
                    focusRequester = genreFocusers.getOrNull(index),
                    onClick = { onSelectGenre(genre.slug) },
                    onDownToContent = onDownToContent
                )
            }
        }

        CatalogSearch(
            searchViewModel = searchViewModel,
            onSelectSeries = onSelectSeries,
            onDownToContent = onDownToContent
        )
    }
}

@Composable
private fun HeaderNavPill(
    label: String,
    isActive: Boolean,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    focusRequester: FocusRequester? = null,
    onDownToContent: (() -> Unit)? = null
) {
    val pillShape = RoundedCornerShape(8.dp)
    var pillModifier: Modifier = modifier
    if (focusRequester != null) {
        pillModifier = pillModifier.focusRequester(focusRequester)
    }
    pillModifier = pillModifier.onKeyEvent { keyEvent ->
        if (isRepeatKeyEvent(keyEvent)) return@onKeyEvent true
        if (keyEvent.nativeKeyEvent.action == ACTION_DOWN &&
            keyEvent.nativeKeyEvent.keyCode == KEYCODE_DPAD_DOWN
        ) {
            onDownToContent?.invoke()
            onDownToContent != null
        } else {
            false
        }
    }
    TvButton(
        onClick = onClick,
        modifier = pillModifier,
        shape = TvButtonDefaults.shape(shape = pillShape, focusedShape = pillShape),
        scale = TvButtonDefaults.scale(scale = 1.0f, focusedScale = 1.08f),
        border = TvButtonDefaults.border(
            border = Border.None,
            focusedBorder = Border(
                border = androidx.compose.foundation.BorderStroke(width = 2.dp, color = Color.White),
                shape = pillShape
            )
        ),
        colors = TvButtonDefaults.colors(
            containerColor = if (isActive) MaterialTheme.colorScheme.primary.copy(alpha = 0.35f)
            else Color.Transparent,
            focusedContainerColor = MaterialTheme.colorScheme.primary,
            contentColor = if (isActive) Color.White else Color.White.copy(alpha = 0.75f),
            focusedContentColor = Color.White
        )
    ) {
        Text(
            text = label,
            style = MaterialTheme.typography.bodyMedium.copy(fontWeight = if (isActive) FontWeight.Bold else FontWeight.Medium)
        )
    }
}
