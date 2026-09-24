package com.privatemovie.tv.modules.detail.internal

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp
import androidx.tv.material3.Border
import androidx.tv.material3.Button as TvButton
import androidx.tv.material3.ButtonDefaults as TvButtonDefaults

/**
 * High-contrast Back button shared across the series Detail screen
 * ([SeriesHeader] banner plus the [DetailLoading]/[DetailError] fallbacks).
 *
 * Unfocused it keeps a 1.dp semi-transparent white border ring over a lighter
 * translucent container so it stays legible over dark backdrop banners and
 * scrim gradients. Focused it uses a bold 2.dp solid white border, a bright
 * container tint, and 1.05x scale for clear D-pad focus indication.
 */
@Composable
fun DetailBackButton(
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    contentPadding: PaddingValues = PaddingValues(horizontal = 16.dp, vertical = 8.dp),
    content: @Composable () -> Unit
) {
    val backShape = RoundedCornerShape(8.dp)
    TvButton(
        onClick = onClick,
        modifier = modifier,
        shape = TvButtonDefaults.shape(shape = backShape, focusedShape = backShape),
        scale = TvButtonDefaults.scale(scale = 1.0f, focusedScale = 1.05f),
        border = TvButtonDefaults.border(
            border = Border(
                border = BorderStroke(width = 1.dp, color = Color.White.copy(alpha = 0.5f)),
                shape = backShape
            ),
            focusedBorder = Border(
                border = BorderStroke(width = 2.dp, color = Color.White),
                shape = backShape
            )
        ),
        colors = TvButtonDefaults.colors(
            containerColor = Color.White.copy(alpha = 0.2f),
            focusedContainerColor = Color.White.copy(alpha = 0.35f),
            contentColor = Color.White,
            focusedContentColor = Color.White
        ),
        contentPadding = contentPadding
    ) {
        content()
    }
}
