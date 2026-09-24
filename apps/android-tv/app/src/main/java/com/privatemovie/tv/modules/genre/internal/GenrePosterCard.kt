package com.privatemovie.tv.modules.genre.internal

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.focus.onFocusChanged
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.input.key.onKeyEvent
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.tv.material3.Border
import androidx.tv.material3.Card as TvCard
import androidx.tv.material3.CardDefaults as TvCardDefaults
import com.privatemovie.tv.components.MediaAspectRatio
import com.privatemovie.tv.components.MediaPlaceholderIcons
import com.privatemovie.tv.components.TvMediaImage
import com.privatemovie.tv.components.isRepeatKeyEvent
import com.privatemovie.tv.dto.models.SeriesSummary

/**
 * Poster card for the genre catalog grid, bound to [SeriesSummary].
 *
 * D-pad Up from the top grid row is intercepted via [onUp] so the host can
 * return focus to the filter pills / header. D-pad Left from a leftmost
 * column card is intercepted via [onLeft] so the host can shift focus into
 * the left navigation drawer.
 */
@Composable
fun GenrePosterCard(
    series: SeriesSummary,
    baseUrl: String,
    onSelect: () -> Unit,
    modifier: Modifier = Modifier,
    focusRequester: FocusRequester? = null,
    onFocused: (() -> Unit)? = null,
    onUp: (() -> Unit)? = null,
    onLeft: (() -> Unit)? = null
) {
    val cardShape = RoundedCornerShape(10.dp)

    Column(modifier = modifier.fillMaxWidth()) {
        var cardModifier: Modifier = Modifier.fillMaxWidth()

        if (focusRequester != null) {
            cardModifier = cardModifier.focusRequester(focusRequester)
        }
        if (onFocused != null) {
            cardModifier = cardModifier.onFocusChanged { state ->
                if (state.isFocused) onFocused()
            }
        }
        if (onUp != null || onLeft != null) {
            cardModifier = cardModifier.onKeyEvent { keyEvent ->
                if (isRepeatKeyEvent(keyEvent)) {
                    return@onKeyEvent true
                }
                if (keyEvent.nativeKeyEvent.action == android.view.KeyEvent.ACTION_DOWN) {
                    when (keyEvent.nativeKeyEvent.keyCode) {
                        android.view.KeyEvent.KEYCODE_DPAD_UP -> {
                            if (onUp != null) {
                                onUp()
                                true
                            } else false
                        }
                        android.view.KeyEvent.KEYCODE_DPAD_LEFT -> {
                            if (onLeft != null) {
                                onLeft()
                                true
                            } else false
                        }
                        else -> false
                    }
                } else {
                    false
                }
            }
        }

        TvCard(
            onClick = onSelect,
            shape = TvCardDefaults.shape(shape = cardShape, focusedShape = cardShape),
            scale = TvCardDefaults.scale(scale = 1.0f, focusedScale = 1.08f),
            border = TvCardDefaults.border(
                border = Border.None,
                focusedBorder = Border(
                    border = BorderStroke(width = 3.dp, color = Color.White),
                    shape = cardShape
                )
            ),
            colors = TvCardDefaults.colors(
                containerColor = Color.Transparent,
                focusedContainerColor = Color.Transparent
            ),
            modifier = cardModifier
        ) {
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .clip(cardShape)
            ) {
                TvMediaImage(
                    imageUrl = series.posterUrl,
                    contentDescription = series.title,
                    baseUrl = baseUrl,
                    aspectRatio = MediaAspectRatio.POSTER,
                    title = series.title,
                    shape = RoundedCornerShape(0.dp),
                    modifier = Modifier.fillMaxWidth()
                )

                series.type?.let { type ->
                    Box(
                        modifier = Modifier
                            .align(Alignment.TopStart)
                            .padding(8.dp)
                            .clip(RoundedCornerShape(4.dp))
                            .background(Color.Black.copy(alpha = 0.75f))
                            .padding(horizontal = 6.dp, vertical = 2.dp)
                    ) {
                        Text(
                            text = type.uppercase(),
                            style = MaterialTheme.typography.labelSmall.copy(
                                fontSize = 10.sp,
                                fontWeight = FontWeight.Bold
                            ),
                            color = MaterialTheme.colorScheme.primary
                        )
                    }
                }

                series.rating?.let { rating ->
                    Row(
                        modifier = Modifier
                            .align(Alignment.TopEnd)
                            .padding(8.dp)
                            .clip(RoundedCornerShape(4.dp))
                            .background(Color.Black.copy(alpha = 0.75f))
                            .padding(horizontal = 5.dp, vertical = 2.dp),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(2.dp)
                    ) {
                        Icon(
                            imageVector = MediaPlaceholderIcons.Star,
                            contentDescription = null,
                            tint = Color(0xFFE5A00D),
                            modifier = Modifier.size(10.dp)
                        )
                        Text(
                            text = rating,
                            style = MaterialTheme.typography.labelSmall.copy(
                                fontSize = 10.sp,
                                fontWeight = FontWeight.Bold
                            ),
                            color = Color(0xFFE5A00D)
                        )
                    }
                }
            }
        }

        Spacer(modifier = Modifier.height(8.dp))

        Text(
            text = series.title,
            style = MaterialTheme.typography.bodyMedium.copy(fontWeight = FontWeight.SemiBold),
            color = MaterialTheme.colorScheme.onSurface,
            maxLines = 1,
            overflow = TextOverflow.Ellipsis
        )
        genreCardMetaLine(series)?.let { meta ->
            Text(
                text = meta,
                style = MaterialTheme.typography.bodySmall,
                color = Color.Gray,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis
            )
        }
    }
}

private fun genreCardMetaLine(series: SeriesSummary): String? {
    val genre = series.genres.firstOrNull()?.name
    return genre ?: series.type
}
