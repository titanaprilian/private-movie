package com.privatemovie.tv.components

import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.widthIn
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import coil.compose.SubcomposeAsyncImage
import coil.compose.SubcomposeAsyncImageContent
import coil.request.ImageRequest

@Composable
fun LogoOrTitleRender(
    logoUrl: String?,
    title: String,
    modifier: Modifier = Modifier,
    baseUrl: String? = null,
    contentDescription: String? = null
) {
    val resolvedUrl = remember(logoUrl, baseUrl) {
        ImageUrlResolver.resolve(logoUrl, baseUrl)
    }

    var logoFailed by remember(resolvedUrl) { mutableStateOf(false) }

    if (resolvedUrl != null && !logoFailed) {
        val context = LocalContext.current
        val imageRequest = remember(resolvedUrl, context) {
            ImageRequest.Builder(context)
                .data(resolvedUrl)
                .crossfade(true)
                .build()
        }

        SubcomposeAsyncImage(
            model = imageRequest,
            contentDescription = contentDescription ?: title,
            contentScale = ContentScale.Fit,
            modifier = modifier
                .heightIn(max = 80.dp)
                .widthIn(max = 340.dp),
            loading = {
                TitleHeadlineText(title = title)
            },
            error = {
                logoFailed = true
                TitleHeadlineText(title = title)
            },
            success = {
                SubcomposeAsyncImageContent()
            }
        )
    } else {
        TitleHeadlineText(title = title, modifier = modifier)
    }
}

@Composable
fun TitleHeadlineText(
    title: String,
    modifier: Modifier = Modifier
) {
    Text(
        text = title,
        style = MaterialTheme.typography.headlineLarge.copy(
            fontWeight = FontWeight.ExtraBold,
            letterSpacing = 0.5.sp
        ),
        color = Color.White,
        maxLines = 1,
        overflow = TextOverflow.Ellipsis,
        modifier = modifier
    )
}
