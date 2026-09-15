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
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.clipToBounds
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusProperties
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.input.key.onKeyEvent
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.tv.material3.Border
import androidx.tv.material3.Button as TvButton
import androidx.tv.material3.ButtonDefaults as TvButtonDefaults
import coil.compose.SubcomposeAsyncImage
import coil.compose.SubcomposeAsyncImageContent
import coil.request.ImageRequest
import com.privatemovie.tv.components.ImageUrlResolver
import com.privatemovie.tv.components.LogoOrTitleRender
import com.privatemovie.tv.components.MediaAspectRatio
import com.privatemovie.tv.components.MediaPlaceholderIcons
import com.privatemovie.tv.components.TvMediaImage

/**
 * Series Header component with full-bleed backdrop banner edge-to-edge, floating Back button
 * overlay in top-left, horizontal + vertical scrim gradients matching Home screen,
 * 2:3 vertical poster card, official series logo rendering (via [LogoOrTitleRender]),
 * metadata, and prominent "Watch Episode 1 / Play Now" CTA button.
 */
@Composable
fun SeriesHeader(
    details: TvSeriesDetails,
    baseUrl: String?,
    firstPlayableEpisode: TvEpisode?,
    playCtaFocusRequester: FocusRequester,
    backFocusRequester: FocusRequester,
    onPlayCta: () -> Unit,
    onBack: () -> Unit,
    modifier: Modifier = Modifier,
    onDownFromCta: (() -> Unit)? = null
) {
    val context = LocalContext.current
    val rawImageUrl = details.backdropUrl ?: details.posterUrl
    val resolvedUrl = remember(rawImageUrl, baseUrl) {
        ImageUrlResolver.resolve(rawImageUrl, baseUrl)
    }

    Box(
        modifier = modifier
            .fillMaxWidth()
            .clipToBounds()
            .background(MaterialTheme.colorScheme.background)
    ) {
        // 1. Edge-to-edge backdrop banner image filling 100% of header
        if (resolvedUrl != null) {
            val imageRequest = remember(resolvedUrl, context) {
                ImageRequest.Builder(context)
                    .data(resolvedUrl)
                    .crossfade(true)
                    .build()
            }

            SubcomposeAsyncImage(
                model = imageRequest,
                contentDescription = details.title,
                contentScale = ContentScale.Crop,
                modifier = Modifier
                    .fillMaxSize()
                    .clipToBounds(),
                loading = {
                    Box(
                        modifier = Modifier
                            .fillMaxSize()
                            .background(Color(0xFF141419))
                    )
                },
                error = {
                    Box(
                        modifier = Modifier
                            .fillMaxSize()
                            .background(Color(0xFF141419))
                    )
                },
                success = {
                    SubcomposeAsyncImageContent()
                }
            )
        } else {
            Box(
                modifier = Modifier
                    .fillMaxSize()
                    .background(Color(0xFF141419))
            )
        }

        // 2. Cinematic horizontal gradient (dark on left where text/poster sit, fading to transparent)
        Box(
            modifier = Modifier
                .fillMaxSize()
                .background(
                    Brush.horizontalGradient(
                        colors = listOf(
                            Color.Black.copy(alpha = 0.95f),
                            Color.Black.copy(alpha = 0.85f),
                            Color.Black.copy(alpha = 0.4f),
                            Color.Transparent
                        ),
                        startX = 0f,
                        endX = 1400f
                    )
                )
        )

        // 3. Cinematic vertical gradient (top scrim + bottom fade into MaterialTheme.colorScheme.background)
        Box(
            modifier = Modifier
                .fillMaxSize()
                .background(
                    Brush.verticalGradient(
                        colorStops = arrayOf(
                            0.0f to Color.Black.copy(alpha = 0.7f),
                            0.2f to Color.Transparent,
                            0.5f to Color.Transparent,
                            0.75f to Color.Black.copy(alpha = 0.85f),
                            1.0f to MaterialTheme.colorScheme.background
                        ),
                        startY = 0f
                    )
                )
        )

        // 4. Floating Back button in top-left corner
        Box(
            modifier = Modifier
                .fillMaxWidth()
                .padding(start = 48.dp, top = 24.dp)
        ) {
            val backShape = RoundedCornerShape(8.dp)
            TvButton(
                onClick = onBack,
                modifier = Modifier
                    .focusRequester(backFocusRequester)
                    .focusProperties {
                        down = playCtaFocusRequester
                    },
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
                    containerColor = Color.Black.copy(alpha = 0.5f),
                    focusedContainerColor = Color.White.copy(alpha = 0.35f),
                    contentColor = Color.White,
                    focusedContentColor = Color.White
                ),
                contentPadding = PaddingValues(horizontal = 16.dp, vertical = 8.dp)
            ) {
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(6.dp)
                ) {
                    Text("←", fontWeight = FontWeight.Bold, fontSize = 16.sp)
                    Text("Back", fontWeight = FontWeight.Medium)
                }
            }
        }

        // 5. Header main content (Poster + Metadata + Logo + CTA) aligned at bottom-left with safe padding
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .align(Alignment.BottomStart)
                .padding(start = 48.dp, end = 48.dp, bottom = 48.dp),
            horizontalArrangement = Arrangement.spacedBy(28.dp),
            verticalAlignment = Alignment.Bottom
        ) {
            // 2:3 vertical poster card
            Box(
                modifier = Modifier
                    .width(150.dp)
                    .clip(RoundedCornerShape(12.dp))
            ) {
                TvMediaImage(
                    imageUrl = details.posterUrl,
                    contentDescription = details.title,
                    baseUrl = baseUrl,
                    aspectRatio = MediaAspectRatio.POSTER,
                    shape = RoundedCornerShape(12.dp),
                    contentScale = ContentScale.Crop,
                    modifier = Modifier.width(150.dp)
                )
            }

            // Metadata & Actions column
            Column(
                modifier = Modifier.weight(1f),
                verticalArrangement = Arrangement.Bottom
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

                // Logo or Title fallback
                LogoOrTitleRender(
                    logoUrl = details.logoUrl,
                    title = details.title,
                    baseUrl = baseUrl
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

                // Synopsis (max 3 lines in header overview)
                details.description?.let { desc ->
                    Spacer(modifier = Modifier.height(8.dp))
                    Text(
                        text = desc,
                        style = MaterialTheme.typography.bodyMedium.copy(lineHeight = 20.sp),
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                        maxLines = 3,
                        overflow = TextOverflow.Ellipsis
                    )
                }

                Spacer(modifier = Modifier.height(16.dp))

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
                    modifier = Modifier
                        .focusRequester(playCtaFocusRequester)
                        .focusProperties {
                            up = backFocusRequester
                        }
                        .onKeyEvent { keyEvent ->
                            if (keyEvent.nativeKeyEvent.action == android.view.KeyEvent.ACTION_DOWN &&
                                keyEvent.nativeKeyEvent.keyCode == android.view.KeyEvent.KEYCODE_DPAD_DOWN
                            ) {
                                if (onDownFromCta != null) {
                                    onDownFromCta()
                                    true
                                } else false
                            } else false
                        },
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
