package com.privatemovie.tv.modules.detail.internal

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Icon
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
import androidx.compose.ui.focus.onFocusChanged
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.TransformOrigin
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.tv.material3.Border
import androidx.tv.material3.Card as TvCard
import androidx.tv.material3.CardDefaults as TvCardDefaults
import com.privatemovie.tv.components.EdgeScaleTransform
import com.privatemovie.tv.components.MediaAspectRatio
import com.privatemovie.tv.components.MediaPlaceholderIcons
import com.privatemovie.tv.components.TvMediaImage

/**
 * Horizontal carousel of 16:9 episode thumbnail cards.
 *
 * Each episode card displays:
 * - 16:9 thumbnail with fallback container
 * - Episode order badge (e.g. "EP 1")
 * - Episode title below thumbnail
 * - TV Card focus scaling and high-contrast border
 *
 * Highlighting or focusing an episode updates [onEpisodeFocused] to keep the dynamic info panel synced.
 */
@Composable
fun EpisodeCarousel(
    episodes: List<TvEpisode>,
    baseUrl: String?,
    onSelectEpisode: (TvEpisode) -> Unit,
    onEpisodeFocused: (TvEpisode) -> Unit,
    modifier: Modifier = Modifier
) {
    LazyRow(
        modifier = modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.spacedBy(20.dp),
        contentPadding = PaddingValues(horizontal = 24.dp, vertical = 12.dp)
    ) {
        itemsIndexed(episodes, key = { _, episode -> episode.id }) { index, episode ->
            val transformOrigin = EdgeScaleTransform(index, episodes.size)
            EpisodeThumbnailCard(
                episode = episode,
                baseUrl = baseUrl,
                onSelect = { onSelectEpisode(episode) },
                onFocus = { onEpisodeFocused(episode) },
                transformOrigin = transformOrigin
            )
        }
    }
}

@Composable
fun EpisodeThumbnailCard(
    episode: TvEpisode,
    baseUrl: String?,
    onSelect: () -> Unit,
    onFocus: () -> Unit,
    modifier: Modifier = Modifier,
    transformOrigin: TransformOrigin = TransformOrigin.Center
) {
    val cardShape = RoundedCornerShape(12.dp)
    var isFocused by remember { mutableStateOf(false) }

    TvCard(
        onClick = onSelect,
        modifier = modifier
            .width(260.dp)
            .graphicsLayer {
                this.transformOrigin = transformOrigin
            }
            .onFocusChanged { state ->
                isFocused = state.isFocused
                if (state.isFocused) {
                    onFocus()
                }
            },
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
            // 16:9 Thumbnail with Badge
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .height(140.dp)
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

                // Episode order badge (e.g. "EP 1")
                Box(
                    modifier = Modifier
                        .padding(8.dp)
                        .align(Alignment.TopStart)
                        .clip(RoundedCornerShape(4.dp))
                        .background(Color.Black.copy(alpha = 0.75f))
                        .padding(horizontal = 6.dp, vertical = 2.dp)
                ) {
                    Text(
                        text = "EP ${episode.order}",
                        style = MaterialTheme.typography.labelSmall.copy(
                            fontWeight = FontWeight.Bold,
                            fontSize = 11.sp
                        ),
                        color = Color.White
                    )
                }

                // Sources count pill if multi-source or unavailable
                if (episode.videoSources.isEmpty()) {
                    Box(
                        modifier = Modifier
                            .padding(8.dp)
                            .align(Alignment.BottomEnd)
                            .clip(RoundedCornerShape(4.dp))
                            .background(Color.Black.copy(alpha = 0.75f))
                            .padding(horizontal = 6.dp, vertical = 2.dp)
                    ) {
                        Text(
                            text = "Unavailable",
                            style = MaterialTheme.typography.labelSmall.copy(
                                fontWeight = FontWeight.Medium,
                                fontSize = 10.sp
                            ),
                            color = Color(0xFFFF5252)
                        )
                    }
                } else if (episode.videoSources.size > 1) {
                    Box(
                        modifier = Modifier
                            .padding(8.dp)
                            .align(Alignment.BottomEnd)
                            .clip(RoundedCornerShape(4.dp))
                            .background(Color.Black.copy(alpha = 0.75f))
                            .padding(horizontal = 6.dp, vertical = 2.dp)
                    ) {
                        Text(
                            text = "${episode.videoSources.size} Sources",
                            style = MaterialTheme.typography.labelSmall.copy(
                                fontWeight = FontWeight.Medium,
                                fontSize = 10.sp
                            ),
                            color = MaterialTheme.colorScheme.primary
                        )
                    }
                }
            }

            Spacer(modifier = Modifier.height(10.dp))

            // Episode title beneath thumbnail
            Text(
                text = "Episode ${episode.order} — ${episode.title}",
                style = MaterialTheme.typography.bodyMedium.copy(
                    fontWeight = FontWeight.SemiBold,
                    fontSize = 14.sp
                ),
                color = if (isFocused) Color.White else Color.White.copy(alpha = 0.9f),
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
                modifier = Modifier.padding(horizontal = 4.dp, vertical = 2.dp)
            )
        }
    }
}
