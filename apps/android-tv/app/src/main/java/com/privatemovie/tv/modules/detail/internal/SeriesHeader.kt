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
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.tv.material3.Border
import androidx.tv.material3.Button as TvButton
import androidx.tv.material3.ButtonDefaults as TvButtonDefaults
import com.privatemovie.tv.components.MediaAspectRatio
import com.privatemovie.tv.components.MediaPlaceholderIcons
import com.privatemovie.tv.components.TvMediaImage

/**
 * Series Header component combining a 16:9 backdrop banner with gradient fading down,
 * a crisp 2:3 vertical poster card on the left, and series metadata (title, genres, rating,
 * full synopsis, format) on the right, plus the prominent "Play Now / Watch Episode 1" CTA button
 * that receives initial focus.
 */
@Composable
fun SeriesHeader(
    details: TvSeriesDetails,
    baseUrl: String?,
    firstPlayableEpisode: TvEpisode?,
    playCtaFocusRequester: FocusRequester,
    onPlayCta: () -> Unit,
    onBack: () -> Unit,
    modifier: Modifier = Modifier
) {
    val headerShape = RoundedCornerShape(16.dp)

    Box(
        modifier = modifier
            .fillMaxWidth()
            .clip(headerShape)
            .background(Color(0xFF18181F))
    ) {
        // Backdrop banner
        TvMediaImage(
            imageUrl = details.backdropUrl ?: details.posterUrl,
            contentDescription = details.title,
            baseUrl = baseUrl,
            aspectRatio = MediaAspectRatio.BACKDROP,
            shape = RoundedCornerShape(0.dp),
            contentScale = ContentScale.Crop,
            modifier = Modifier
                .fillMaxWidth()
                .height(340.dp)
        )

        // Gradient fading down to background
        Box(
            modifier = Modifier
                .fillMaxWidth()
                .height(340.dp)
                .background(
                    Brush.verticalGradient(
                        colors = listOf(
                            Color.Black.copy(alpha = 0.45f),
                            Color(0xFF18181F).copy(alpha = 0.85f),
                            Color(0xFF18181F)
                        ),
                        startY = 0f,
                        endY = 700f
                    )
                )
        )

        // Gradient fading horizontally from poster area
        Box(
            modifier = Modifier
                .fillMaxWidth()
                .height(340.dp)
                .background(
                    Brush.horizontalGradient(
                        colors = listOf(
                            Color(0xFF18181F).copy(alpha = 0.95f),
                            Color(0xFF18181F).copy(alpha = 0.75f),
                            Color.Transparent
                        ),
                        startX = 0f,
                        endX = 1200f
                    )
                )
        )

        // Header content layout
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(24.dp)
        ) {
            // Top action bar (Back button)
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.End
            ) {
                val backShape = RoundedCornerShape(8.dp)
                TvButton(
                    onClick = onBack,
                    shape = TvButtonDefaults.shape(shape = backShape, focusedShape = backShape),
                    scale = TvButtonDefaults.scale(scale = 1.0f, focusedScale = 1.05f),
                    border = TvButtonDefaults.border(
                        border = Border.None,
                        focusedBorder = Border(
                            border = BorderStroke(width = 2.dp, color = Color.White),
                            shape = backShape
                        )
                    ),
                    colors = TvButtonDefaults.colors(
                        containerColor = Color.White.copy(alpha = 0.15f),
                        focusedContainerColor = Color.White.copy(alpha = 0.3f),
                        contentColor = Color.White,
                        focusedContentColor = Color.White
                    ),
                    contentPadding = PaddingValues(horizontal = 16.dp, vertical = 8.dp)
                ) {
                    Text("Back", fontWeight = FontWeight.Medium)
                }
            }

            Spacer(modifier = Modifier.height(12.dp))

            // Main side-by-side section: 2:3 Poster on left, Metadata & CTA on right
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(24.dp),
                verticalAlignment = Alignment.Top
            ) {
                // 2:3 vertical poster card
                Box(
                    modifier = Modifier
                        .width(160.dp)
                        .clip(RoundedCornerShape(12.dp))
                ) {
                    TvMediaImage(
                        imageUrl = details.posterUrl,
                        contentDescription = details.title,
                        baseUrl = baseUrl,
                        aspectRatio = MediaAspectRatio.POSTER,
                        shape = RoundedCornerShape(12.dp),
                        contentScale = ContentScale.Crop,
                        modifier = Modifier.width(160.dp)
                    )
                }

                // Series Metadata & Actions column
                Column(
                    modifier = Modifier.weight(1f)
                ) {
                    // Badges row: Format & Rating
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        Box(
                            modifier = Modifier
                                .clip(RoundedCornerShape(4.dp))
                                .background(MaterialTheme.colorScheme.primary)
                                .padding(horizontal = 8.dp, vertical = 3.dp)
                        ) {
                            Text(
                                text = details.type.uppercase(),
                                style = MaterialTheme.typography.labelSmall.copy(
                                    fontWeight = FontWeight.Bold,
                                    letterSpacing = 1.sp
                                ),
                                color = Color.White
                            )
                        }

                        details.rating?.let { rating ->
                            Row(
                                verticalAlignment = Alignment.CenterVertically,
                                horizontalArrangement = Arrangement.spacedBy(4.dp),
                                modifier = Modifier
                                    .clip(RoundedCornerShape(4.dp))
                                    .background(Color(0xFFE5A00D).copy(alpha = 0.2f))
                                    .padding(horizontal = 8.dp, vertical = 3.dp)
                            ) {
                                Icon(
                                    imageVector = MediaPlaceholderIcons.Star,
                                    contentDescription = null,
                                    tint = Color(0xFFE5A00D),
                                    modifier = Modifier.size(13.dp)
                                )
                                Text(
                                    text = rating,
                                    style = MaterialTheme.typography.labelSmall.copy(
                                        fontWeight = FontWeight.Bold
                                    ),
                                    color = Color(0xFFE5A00D)
                                )
                            }
                        }
                    }

                    Spacer(modifier = Modifier.height(10.dp))

                    // Title
                    Text(
                        text = details.title,
                        style = MaterialTheme.typography.headlineLarge.copy(
                            fontWeight = FontWeight.Bold,
                            letterSpacing = 0.5.sp
                        ),
                        color = MaterialTheme.colorScheme.onSurface,
                        maxLines = 2,
                        overflow = TextOverflow.Ellipsis
                    )

                    // Genres
                    val genreNames = details.genres.joinToString("  •  ") { it.name }
                    if (genreNames.isNotBlank()) {
                        Spacer(modifier = Modifier.height(6.dp))
                        Text(
                            text = genreNames,
                            style = MaterialTheme.typography.bodyMedium.copy(fontWeight = FontWeight.Medium),
                            color = Color.LightGray
                        )
                    }

                    // Synopsis
                    details.description?.let { desc ->
                        Spacer(modifier = Modifier.height(10.dp))
                        Text(
                            text = desc,
                            style = MaterialTheme.typography.bodyMedium.copy(lineHeight = 20.sp),
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                            maxLines = 4,
                            overflow = TextOverflow.Ellipsis
                        )
                    }

                    baseUrl?.let { url ->
                        Spacer(modifier = Modifier.height(10.dp))
                        Text(
                            text = "Connected Backend: $url",
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.primary
                        )
                    }

                    Spacer(modifier = Modifier.height(20.dp))

                    // Prominent CTA Button taking initial D-pad focus
                    val ctaText = when {
                        firstPlayableEpisode == null -> "No Episodes Available"
                        details.type.equals("movie", ignoreCase = true) -> "Play Now"
                        firstPlayableEpisode.order == 1 -> "Watch Episode 1"
                        else -> "Watch Episode ${firstPlayableEpisode.order}"
                    }
                    val isCtaEnabled = firstPlayableEpisode != null && firstPlayableEpisode.videoSources.isNotEmpty()
                    val buttonShape = RoundedCornerShape(8.dp)

                    TvButton(
                        onClick = onPlayCta,
                        enabled = isCtaEnabled,
                        modifier = Modifier.focusRequester(playCtaFocusRequester),
                        shape = TvButtonDefaults.shape(
                            shape = buttonShape,
                            focusedShape = buttonShape
                        ),
                        scale = TvButtonDefaults.scale(
                            scale = 1.0f,
                            focusedScale = 1.06f
                        ),
                        border = TvButtonDefaults.border(
                            border = Border.None,
                            focusedBorder = Border(
                                border = BorderStroke(width = 2.5.dp, color = Color.White),
                                shape = buttonShape
                            )
                        ),
                        colors = TvButtonDefaults.colors(
                            containerColor = MaterialTheme.colorScheme.primary,
                            focusedContainerColor = MaterialTheme.colorScheme.primary,
                            contentColor = Color.White,
                            focusedContentColor = Color.White
                        ),
                        contentPadding = PaddingValues(horizontal = 24.dp, vertical = 12.dp)
                    ) {
                        Row(
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.spacedBy(8.dp)
                        ) {
                            Icon(
                                imageVector = MediaPlaceholderIcons.Movie,
                                contentDescription = null,
                                modifier = Modifier.size(18.dp)
                            )
                            Text(
                                text = ctaText,
                                style = MaterialTheme.typography.titleMedium.copy(
                                    fontWeight = FontWeight.Bold,
                                    fontSize = 15.sp
                                )
                            )
                        }
                    }
                }
            }
        }
    }
}
