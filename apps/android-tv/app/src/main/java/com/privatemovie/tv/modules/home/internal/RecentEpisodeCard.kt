package com.privatemovie.tv.modules.home.internal

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
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
import androidx.compose.ui.graphics.TransformOrigin
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.input.key.onKeyEvent
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.tv.material3.Border
import androidx.tv.material3.Card as TvCard
import androidx.tv.material3.CardDefaults as TvCardDefaults
import com.privatemovie.tv.components.MediaAspectRatio
import com.privatemovie.tv.components.TvMediaImage
import com.privatemovie.tv.components.isRepeatKeyEvent

/** Width of a "Recently Added Episodes" card in dp. */
const val RECENT_EPISODE_CARD_WIDTH_DP = 260

/**
 * Formats an episode duration expressed in seconds as `mm:ss`.
 *
 * Returns `null` when the duration is unknown or not positive, so callers can
 * hide the duration badge entirely instead of rendering a misleading `00:00`.
 */
fun formatEpisodeDuration(durationSeconds: Int?): String? {
    if (durationSeconds == null || durationSeconds <= 0) return null
    val minutes = durationSeconds / 60
    val seconds = durationSeconds % 60
    return String.format("%02d:%02d", minutes, seconds)
}

/**
 * Season label such as `S1`.
 *
 * Prefers the explicit season number and falls back to digits embedded in the
 * season title (e.g. "Season 2"), defaulting to season 1 when neither is available.
 */
fun formatSeasonLabel(season: TvRecentlyAddedSeason): String {
    val number = season.seasonNumber
        ?: Regex("\\d+").find(season.title)?.value?.toIntOrNull()
        ?: 1
    return "S$number"
}

/** Badge label combining season and episode order, e.g. `S1 · EP 12`. */
fun episodeBadgeLabel(season: TvRecentlyAddedSeason, episodeOrder: Int): String {
    return "${formatSeasonLabel(season)} · EP $episodeOrder"
}

/**
 * 16:9 thumbnail card used by the "Recently Added Episodes" carousel.
 *
 * Layout:
 * - 16:9 thumbnail ([MediaAspectRatio.THUMBNAIL]) with a season/episode badge
 *   in the top-left corner and an optional duration badge in the bottom-right.
 * - Episode title (bold) and series title (muted) beneath the image.
 * - TV focus styling: 1.08x scaling and a 2.5dp high-contrast white border.
 *
 * [onLeft] is invoked when D-Pad Left is pressed (used by the first card in the
 * row to open the navigation drawer) and [onUp] when D-Pad Up is pressed.
 */
@Composable
fun RecentEpisodeCard(
    episode: TvRecentlyAddedEpisode,
    baseUrl: String?,
    onSelect: () -> Unit,
    modifier: Modifier = Modifier,
    transformOrigin: TransformOrigin = TransformOrigin.Center,
    focusRequester: FocusRequester? = null,
    onLeft: (() -> Unit)? = null,
    onUp: (() -> Unit)? = null
) {
    val cardShape = RoundedCornerShape(12.dp)
    var isFocused by remember { mutableStateOf(false) }

    var cardModifier: Modifier = modifier
        .width(RECENT_EPISODE_CARD_WIDTH_DP.dp)
        .graphicsLayer {
            this.transformOrigin = transformOrigin
        }
        .onFocusChanged { state ->
            isFocused = state.isFocused
        }

    if (focusRequester != null) {
        cardModifier = cardModifier.focusRequester(focusRequester)
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
        modifier = cardModifier,
        shape = TvCardDefaults.shape(
            shape = cardShape,
            focusedShape = cardShape
        ),
        scale = TvCardDefaults.scale(
            scale = 1.0f,
            focusedScale = 1.08f
        ),
        border = TvCardDefaults.border(
            border = Border.None,
            focusedBorder = Border(
                border = BorderStroke(width = 2.5.dp, color = Color.White),
                shape = cardShape
            )
        ),
        colors = TvCardDefaults.colors(
            containerColor = Color(0xFF1F1F28),
            focusedContainerColor = Color(0xFF282834)
        )
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(8.dp)
        ) {
            // 16:9 thumbnail with badges
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .height(146.dp)
                    .clip(RoundedCornerShape(8.dp))
            ) {
                TvMediaImage(
                    imageUrl = episode.thumbnailUrl,
                    contentDescription = episode.title,
                    baseUrl = baseUrl,
                    aspectRatio = MediaAspectRatio.THUMBNAIL,
                    shape = RoundedCornerShape(8.dp),
                    contentScale = ContentScale.Crop,
                    modifier = Modifier.fillMaxSize()
                )

                // Season / Episode badge (e.g. "S1 · EP 12")
                Box(
                    modifier = Modifier
                        .padding(8.dp)
                        .align(Alignment.TopStart)
                        .clip(RoundedCornerShape(4.dp))
                        .background(Color.Black.copy(alpha = 0.75f))
                        .padding(horizontal = 6.dp, vertical = 2.dp)
                ) {
                    Text(
                        text = episodeBadgeLabel(episode.season, episode.order),
                        style = MaterialTheme.typography.labelSmall.copy(
                            fontWeight = FontWeight.Bold,
                            fontSize = 11.sp
                        ),
                        color = Color.White
                    )
                }

                // Duration badge (e.g. "42:15") — hidden when unknown.
                formatEpisodeDuration(episode.duration)?.let { durationLabel ->
                    Box(
                        modifier = Modifier
                            .padding(8.dp)
                            .align(Alignment.BottomEnd)
                            .clip(RoundedCornerShape(4.dp))
                            .background(Color.Black.copy(alpha = 0.75f))
                            .padding(horizontal = 6.dp, vertical = 2.dp)
                    ) {
                        Text(
                            text = durationLabel,
                            style = MaterialTheme.typography.labelSmall.copy(
                                fontWeight = FontWeight.Medium,
                                fontSize = 10.sp
                            ),
                            color = Color.White
                        )
                    }
                }
            }

            Spacer(modifier = Modifier.height(10.dp))

            // Episode title (primary) and series title (secondary).
            Text(
                text = episode.title,
                style = MaterialTheme.typography.bodyMedium.copy(
                    fontWeight = FontWeight.Bold,
                    fontSize = 14.sp
                ),
                color = if (isFocused) Color.White else Color.White.copy(alpha = 0.9f),
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
                modifier = Modifier.padding(horizontal = 4.dp, vertical = 2.dp)
            )
            Text(
                text = episode.series.title,
                style = MaterialTheme.typography.bodySmall.copy(
                    fontWeight = FontWeight.Medium,
                    fontSize = 12.sp
                ),
                color = Color.LightGray.copy(alpha = 0.8f),
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
                modifier = Modifier.padding(horizontal = 4.dp)
            )
        }
    }
}
