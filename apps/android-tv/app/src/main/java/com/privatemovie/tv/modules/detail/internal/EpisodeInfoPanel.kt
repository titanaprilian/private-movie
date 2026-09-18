package com.privatemovie.tv.modules.detail.internal

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.tv.material3.Border
import androidx.tv.material3.ClickableSurfaceDefaults
import androidx.tv.material3.Surface

/**
 * Bottom Episode Description Panel displaying the highlighted episode's full, untruncated synopsis
 * (no line limits), full title, and source badges.
 *
 * Focusable container that supports D-pad navigation. Clicking OK does nothing (no-op).
 */
@Composable
fun EpisodeInfoPanel(
    episode: TvEpisode?,
    modifier: Modifier = Modifier,
    focusRequester: FocusRequester? = null
) {
    val panelShape = RoundedCornerShape(12.dp)

    Surface(
        onClick = { /* No-op click as specified */ },
        shape = ClickableSurfaceDefaults.shape(shape = panelShape, focusedShape = panelShape),
        border = ClickableSurfaceDefaults.border(
            border = Border.None,
            focusedBorder = Border(
                border = BorderStroke(2.dp, Color.White),
                shape = panelShape
            )
        ),
        colors = ClickableSurfaceDefaults.colors(
            containerColor = Color(0xFF1E1E26),
            focusedContainerColor = Color(0xFF282834),
            contentColor = Color.White,
            focusedContentColor = Color.White
        ),
        scale = ClickableSurfaceDefaults.scale(scale = 1.0f, focusedScale = 1.01f),
        modifier = modifier
            .fillMaxWidth()
            .then(
                if (focusRequester != null) Modifier.focusRequester(focusRequester) else Modifier
            )
    ) {
        Box(
            modifier = Modifier
                .fillMaxWidth()
                .padding(20.dp)
        ) {
            if (episode == null) {
                Text(
                    text = "Select an episode to view synopsis and playback details.",
                    style = MaterialTheme.typography.bodyMedium,
                    color = Color.Gray
                )
            } else {
                Column(modifier = Modifier.fillMaxWidth()) {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Text(
                            text = "Episode ${episode.order}: ${episode.title}",
                            style = MaterialTheme.typography.titleMedium.copy(
                                fontWeight = FontWeight.Bold,
                                fontSize = 16.sp
                            ),
                            color = MaterialTheme.colorScheme.onSurface,
                            maxLines = 1,
                            overflow = TextOverflow.Ellipsis,
                            modifier = Modifier.weight(1f)
                        )

                        // Playback status indicator
                        val sourcePillColor: Color
                        val sourcePillText: String
                        when (episode.videoSources.size) {
                            0 -> {
                                sourcePillColor = Color(0xFFFF5252)
                                sourcePillText = "No Playback Sources"
                            }
                            1 -> {
                                sourcePillColor = Color(0xFF4CAF50)
                                sourcePillText = "1 Direct Source (Instant Play)"
                            }
                            else -> {
                                sourcePillColor = MaterialTheme.colorScheme.primary
                                sourcePillText = "${episode.videoSources.size} Sources (Source Picker)"
                            }
                        }

                        Box(
                            modifier = Modifier
                                .clip(RoundedCornerShape(4.dp))
                                .background(sourcePillColor.copy(alpha = 0.18f))
                                .padding(horizontal = 10.dp, vertical = 4.dp)
                        ) {
                            Text(
                                text = sourcePillText,
                                style = MaterialTheme.typography.labelSmall.copy(
                                    fontWeight = FontWeight.SemiBold,
                                    fontSize = 11.sp
                                ),
                                color = sourcePillColor
                            )
                        }
                    }

                    Spacer(modifier = Modifier.height(10.dp))

                    // Full episode synopsis (untruncated, no line limits)
                    val synopsis = episode.description
                    if (!synopsis.isNullOrBlank()) {
                        Text(
                            text = synopsis,
                            style = MaterialTheme.typography.bodyMedium.copy(
                                lineHeight = 22.sp,
                                fontSize = 14.sp
                            ),
                            color = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                    } else {
                        Text(
                            text = "No episode synopsis provided.",
                            style = MaterialTheme.typography.bodySmall,
                            color = Color.Gray
                        )
                    }
                }
            }
        }
    }
}
