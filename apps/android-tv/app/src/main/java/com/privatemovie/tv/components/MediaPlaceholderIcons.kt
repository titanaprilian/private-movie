package com.privatemovie.tv.components

import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.graphics.vector.path
import androidx.compose.ui.unit.dp

object MediaPlaceholderIcons {
    val Movie: ImageVector by lazy {
        ImageVector.Builder(
            name = "MoviePlaceholder",
            defaultWidth = 24.dp,
            defaultHeight = 24.dp,
            viewportWidth = 24f,
            viewportHeight = 24f
        ).path(fill = SolidColor(Color.White)) {
            moveTo(18f, 4f)
            lineTo(20f, 8f)
            lineTo(17f, 8f)
            lineTo(15f, 4f)
            lineTo(13f, 4f)
            lineTo(15f, 8f)
            lineTo(12f, 8f)
            lineTo(10f, 4f)
            lineTo(8f, 4f)
            lineTo(10f, 8f)
            lineTo(7f, 8f)
            lineTo(5f, 4f)
            lineTo(4f, 4f)
            curveTo(2.9f, 4f, 2f, 4.9f, 2f, 6f)
            lineTo(2f, 18f)
            curveTo(2f, 19.1f, 2.9f, 20f, 4f, 20f)
            lineTo(20f, 20f)
            curveTo(21.1f, 20f, 22f, 19.1f, 22f, 18f)
            lineTo(22f, 4f)
            lineTo(18f, 4f)
            close()
        }.build()
    }

    val Tv: ImageVector by lazy {
        ImageVector.Builder(
            name = "TvPlaceholder",
            defaultWidth = 24.dp,
            defaultHeight = 24.dp,
            viewportWidth = 24f,
            viewportHeight = 24f
        ).path(fill = SolidColor(Color.White)) {
            moveTo(21f, 3f)
            lineTo(3f, 3f)
            curveTo(1.9f, 3f, 1f, 3.9f, 1f, 5f)
            lineTo(1f, 17f)
            curveTo(1f, 18.1f, 1.9f, 19f, 3f, 19f)
            lineTo(8f, 19f)
            lineTo(8f, 21f)
            lineTo(16f, 21f)
            lineTo(16f, 19f)
            lineTo(21f, 19f)
            curveTo(22.1f, 19f, 23f, 18.1f, 23f, 17f)
            lineTo(23f, 5f)
            curveTo(23f, 3.9f, 22.1f, 3f, 21f, 3f)
            close()
            moveTo(21f, 17f)
            lineTo(3f, 17f)
            lineTo(3f, 5f)
            lineTo(21f, 5f)
            lineTo(21f, 17f)
            close()
        }.build()
    }
}
