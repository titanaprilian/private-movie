package com.privatemovie.tv.components

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Shape
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import coil.compose.SubcomposeAsyncImage
import coil.compose.SubcomposeAsyncImageContent
import coil.request.ImageRequest

@Composable
fun TvMediaImage(
    imageUrl: String?,
    contentDescription: String?,
    modifier: Modifier = Modifier,
    aspectRatio: MediaAspectRatio = MediaAspectRatio.POSTER,
    title: String? = null,
    baseUrl: String? = null,
    contentScale: ContentScale = ContentScale.Crop,
    shape: Shape = RoundedCornerShape(8.dp),
    placeholderIcon: ImageVector? = null
) {
    val context = LocalContext.current
    val resolvedUrl = remember(imageUrl, baseUrl) {
        ImageUrlResolver.resolve(imageUrl, baseUrl)
    }

    Box(
        modifier = modifier
            .aspectRatio(aspectRatio.ratio)
            .clip(shape),
        contentAlignment = Alignment.Center
    ) {
        if (resolvedUrl != null) {
            val imageRequest = remember(resolvedUrl, context) {
                ImageRequest.Builder(context)
                    .data(resolvedUrl)
                    .crossfade(true)
                    .build()
            }

            SubcomposeAsyncImage(
                model = imageRequest,
                contentDescription = contentDescription,
                contentScale = contentScale,
                modifier = Modifier.fillMaxSize(),
                loading = {
                    TvMediaImageFallback(
                        title = title,
                        aspectRatio = aspectRatio,
                        placeholderIcon = placeholderIcon
                    )
                },
                error = {
                    TvMediaImageFallback(
                        title = title,
                        aspectRatio = aspectRatio,
                        placeholderIcon = placeholderIcon
                    )
                },
                success = {
                    SubcomposeAsyncImageContent()
                }
            )
        } else {
            TvMediaImageFallback(
                title = title,
                aspectRatio = aspectRatio,
                placeholderIcon = placeholderIcon
            )
        }
    }
}

@Composable
fun TvMediaImageFallback(
    title: String?,
    aspectRatio: MediaAspectRatio,
    modifier: Modifier = Modifier,
    placeholderIcon: ImageVector? = null
) {
    val icon = placeholderIcon ?: when (aspectRatio) {
        MediaAspectRatio.POSTER -> MediaPlaceholderIcons.Movie
        MediaAspectRatio.THUMBNAIL, MediaAspectRatio.BACKDROP -> MediaPlaceholderIcons.Tv
    }

    val gradient = Brush.verticalGradient(
        colors = listOf(
            Color(0xFF2A2D34),
            Color(0xFF141419)
        )
    )

    Box(
        modifier = modifier
            .fillMaxSize()
            .background(gradient)
            .padding(12.dp),
        contentAlignment = Alignment.Center
    ) {
        Column(
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.Center
        ) {
            Icon(
                imageVector = icon,
                contentDescription = null,
                tint = Color.White.copy(alpha = 0.5f),
                modifier = Modifier.size(if (aspectRatio == MediaAspectRatio.POSTER) 36.dp else 28.dp)
            )

            if (!title.isNullOrBlank()) {
                Spacer(modifier = Modifier.height(6.dp))
                Text(
                    text = title,
                    style = MaterialTheme.typography.bodySmall.copy(
                        color = Color.White.copy(alpha = 0.8f),
                        fontSize = 12.sp,
                        fontWeight = FontWeight.Medium,
                        textAlign = TextAlign.Center
                    ),
                    maxLines = 2,
                    overflow = TextOverflow.Ellipsis
                )
            }
        }
    }
}
