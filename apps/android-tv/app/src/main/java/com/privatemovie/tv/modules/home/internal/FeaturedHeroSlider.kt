package com.privatemovie.tv.modules.home.internal

import androidx.compose.animation.Crossfade
import androidx.compose.animation.core.tween
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
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
import androidx.compose.foundation.shape.CircleShape
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
import androidx.compose.ui.draw.clipToBounds
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.focus.onFocusChanged
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.input.key.onKeyEvent
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import coil.compose.SubcomposeAsyncImage
import coil.compose.SubcomposeAsyncImageContent
import coil.request.ImageRequest
import androidx.tv.material3.Border
import androidx.tv.material3.Button as TvButton
import androidx.tv.material3.ButtonDefaults as TvButtonDefaults
import com.privatemovie.tv.components.ImageUrlResolver
import com.privatemovie.tv.components.LogoOrTitleRender
import com.privatemovie.tv.components.MediaPlaceholderIcons
import com.privatemovie.tv.components.isRepeatKeyEvent

@Composable
fun FeaturedHeroSlider(
    sliderState: HeroSliderState,
    baseUrl: String,
    onSelectSeries: (String) -> Unit,
    ctaFocusRequester: FocusRequester,
    modifier: Modifier = Modifier,
    onDownFromCta: (() -> Unit)? = null
) {
    val heroes = sliderState.heroes
    if (heroes.isEmpty()) return

    val currentHero = sliderState.activeHero ?: heroes.first()
    var isCtaFocused by remember { mutableStateOf(false) }

    Box(
        modifier = modifier
            .fillMaxWidth()
            .clipToBounds()
            .background(MaterialTheme.colorScheme.background)
    ) {
        // Crossfading Backdrop Artwork & Metadata (pure display, not focusable)
        Crossfade(
            targetState = sliderState.activeIndex,
            animationSpec = tween(500),
            label = "HeroSliderCrossfade"
        ) { index ->
            val hero = heroes.getOrNull(index) ?: heroes.first()
            HeroBackdropAndDetails(
                hero = hero,
                baseUrl = baseUrl
            )
        }

        // Persistent CTA Button & Controls overlay (STABLE across slide changes, never loses focus!)
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(start = 48.dp, end = 48.dp, bottom = 48.dp),
            verticalArrangement = Arrangement.Bottom
        ) {
            val ctaShape = RoundedCornerShape(8.dp)
            TvButton(
                onClick = { onSelectSeries(currentHero.series.id) },
                modifier = Modifier
                    .focusRequester(ctaFocusRequester)
                    .onFocusChanged {
                        isCtaFocused = it.isFocused
                        sliderState.onCtaFocusChanged(it.isFocused)
                    }
                    .onKeyEvent { keyEvent ->
                        if (isRepeatKeyEvent(keyEvent)) {
                            return@onKeyEvent true
                        }
                        if (keyEvent.nativeKeyEvent.action == android.view.KeyEvent.ACTION_DOWN) {
                            when (keyEvent.nativeKeyEvent.keyCode) {
                                android.view.KeyEvent.KEYCODE_DPAD_DOWN -> {
                                    if (onDownFromCta != null) {
                                        onDownFromCta()
                                        true
                                    } else false
                                }
                                else -> sliderState.handleKeyEvent(keyEvent)
                            }
                        } else {
                            sliderState.handleKeyEvent(keyEvent)
                        }
                    },
                shape = TvButtonDefaults.shape(
                    shape = ctaShape,
                    focusedShape = ctaShape
                ),
                scale = TvButtonDefaults.scale(
                    scale = 1.0f,
                    focusedScale = 1.08f
                ),
                border = TvButtonDefaults.border(
                    border = Border.None,
                    focusedBorder = Border(
                        border = BorderStroke(width = 2.dp, color = Color.White),
                        shape = ctaShape
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
                    if (isCtaFocused && sliderState.heroCount > 1) {
                        Icon(
                            imageVector = MediaPlaceholderIcons.ChevronLeft,
                            contentDescription = "Previous Slide",
                            modifier = Modifier.size(16.dp),
                            tint = Color.White.copy(alpha = 0.85f)
                        )
                    }
                    Text(
                        text = "View Series",
                        style = MaterialTheme.typography.titleMedium.copy(fontWeight = FontWeight.Bold)
                    )
                    if (isCtaFocused && sliderState.heroCount > 1) {
                        Icon(
                            imageVector = MediaPlaceholderIcons.ChevronRight,
                            contentDescription = "Next Slide",
                            modifier = Modifier.size(16.dp),
                            tint = Color.White.copy(alpha = 0.85f)
                        )
                    }
                }
            }
        }

        if (sliderState.heroCount > 1) {
            PaginationDots(
                count = sliderState.heroCount,
                activeIndex = sliderState.activeIndex,
                onSelectIndex = { sliderState.selectSlide(it) },
                modifier = Modifier
                    .align(Alignment.BottomEnd)
                    .padding(end = 48.dp, bottom = 48.dp)
            )
        }
    }
}

@Composable
fun HeroBackdropAndDetails(
    hero: TvHomeHero,
    baseUrl: String,
    modifier: Modifier = Modifier
) {
    val series = hero.series
    val context = LocalContext.current
    val rawImageUrl = series.backdropUrl ?: series.posterUrl
    val resolvedUrl = remember(rawImageUrl, baseUrl) {
        ImageUrlResolver.resolve(rawImageUrl, baseUrl)
    }

    Box(
        modifier = modifier
            .fillMaxSize()
            .clipToBounds()
    ) {
        // Full-bleed backdrop image with Crop filling 100% of container without aspect ratio spill
        if (resolvedUrl != null) {
            val imageRequest = remember(resolvedUrl, context) {
                ImageRequest.Builder(context)
                    .data(resolvedUrl)
                    .crossfade(true)
                    .build()
            }

            SubcomposeAsyncImage(
                model = imageRequest,
                contentDescription = series.title,
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

        // Gradient overlay (horizontal cinematic fade from left)
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

        // Gradient overlay (vertical fade: top scrim + SOLID dark background at bottom)
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

        // Billboard Content overlay (Text & Logo only - CTA button is placed below it)
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(start = 48.dp, end = 48.dp, top = 80.dp, bottom = 120.dp),
            verticalArrangement = Arrangement.Bottom
        ) {
            Column(
                modifier = Modifier.fillMaxWidth(0.65f)
            ) {
                // Featured pill & tags/genres
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
                            text = "FEATURED",
                            style = MaterialTheme.typography.labelSmall.copy(
                                fontWeight = FontWeight.Bold,
                                letterSpacing = 1.sp
                            ),
                            color = Color.White
                        )
                    }

                    val tagsToDisplay = if (hero.tags.isNotEmpty()) {
                        hero.tags
                    } else {
                        series.genres.map { it.name }
                    }

                    tagsToDisplay.take(3).forEach { tag ->
                        Box(
                            modifier = Modifier
                                .clip(RoundedCornerShape(4.dp))
                                .background(Color.White.copy(alpha = 0.15f))
                                .padding(horizontal = 8.dp, vertical = 3.dp)
                        ) {
                            Text(
                                text = tag,
                                style = MaterialTheme.typography.labelSmall.copy(fontWeight = FontWeight.Medium),
                                color = Color.White.copy(alpha = 0.9f)
                            )
                        }
                    }

                    series.rating?.let { rating ->
                        Row(
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.spacedBy(3.dp),
                            modifier = Modifier
                                .clip(RoundedCornerShape(4.dp))
                                .background(Color(0xFFE5A00D).copy(alpha = 0.2f))
                                .padding(horizontal = 6.dp, vertical = 3.dp)
                        ) {
                            Icon(
                                imageVector = MediaPlaceholderIcons.Star,
                                contentDescription = null,
                                tint = Color(0xFFE5A00D),
                                modifier = Modifier.size(12.dp)
                            )
                            Text(
                                text = rating,
                                style = MaterialTheme.typography.labelSmall.copy(fontWeight = FontWeight.Bold),
                                color = Color(0xFFE5A00D)
                            )
                        }
                    }
                }

                Spacer(modifier = Modifier.height(14.dp))

                // Logo or Title headline render
                LogoOrTitleRender(
                    logoUrl = series.logoUrl,
                    title = series.title,
                    baseUrl = baseUrl
                )

                // Synopsis
                series.description?.let { desc ->
                    Spacer(modifier = Modifier.height(8.dp))
                    Text(
                        text = desc,
                        style = MaterialTheme.typography.bodyMedium,
                        color = Color.White.copy(alpha = 0.8f),
                        maxLines = 2,
                        overflow = TextOverflow.Ellipsis
                    )
                }

                Spacer(modifier = Modifier.height(6.dp))
                Text(
                    text = seriesMetaLine(series),
                    style = MaterialTheme.typography.bodySmall.copy(fontWeight = FontWeight.Medium),
                    color = Color.White.copy(alpha = 0.6f)
                )
            }
        }
    }
}

@Composable
fun PaginationDots(
    count: Int,
    activeIndex: Int,
    onSelectIndex: (Int) -> Unit,
    modifier: Modifier = Modifier
) {
    Row(
        modifier = modifier,
        horizontalArrangement = Arrangement.spacedBy(8.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        for (i in 0 until count) {
            val isActive = i == activeIndex
            Box(
                modifier = Modifier
                    .size(if (isActive) 10.dp else 8.dp)
                    .clip(CircleShape)
                    .background(
                        if (isActive) MaterialTheme.colorScheme.primary
                        else Color.White.copy(alpha = 0.35f)
                    )
                    .clickable { onSelectIndex(i) }
            )
        }
    }
}
