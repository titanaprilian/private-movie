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

    val Settings: ImageVector by lazy {
        ImageVector.Builder(
            name = "SettingsIcon",
            defaultWidth = 24.dp,
            defaultHeight = 24.dp,
            viewportWidth = 24f,
            viewportHeight = 24f
        ).path(fill = SolidColor(Color.White)) {
            moveTo(19.14f, 12.94f)
            curveTo(19.17f, 12.63f, 19.2f, 12.32f, 19.2f, 12f)
            curveTo(19.2f, 11.68f, 19.17f, 11.37f, 19.14f, 11.06f)
            lineTo(21.41f, 9.29f)
            curveTo(21.62f, 9.13f, 21.67f, 8.84f, 21.54f, 8.6f)
            lineTo(19.4f, 4.89f)
            curveTo(19.27f, 4.66f, 18.98f, 4.57f, 18.74f, 4.67f)
            lineTo(16.07f, 5.75f)
            curveTo(15.51f, 5.32f, 14.9f, 4.97f, 14.23f, 4.7f)
            lineTo(13.83f, 1.85f)
            curveTo(13.8f, 1.58f, 13.57f, 1.38f, 13.29f, 1.38f)
            lineTo(8.99f, 1.38f)
            curveTo(8.72f, 1.38f, 8.49f, 1.58f, 8.45f, 1.85f)
            lineTo(8.05f, 4.7f)
            curveTo(7.39f, 4.97f, 6.77f, 5.32f, 6.22f, 5.75f)
            lineTo(3.54f, 4.67f)
            curveTo(3.3f, 4.57f, 3.01f, 4.66f, 2.88f, 4.89f)
            lineTo(0.74f, 8.6f)
            curveTo(0.61f, 8.84f, 0.67f, 9.13f, 0.87f, 9.29f)
            lineTo(3.14f, 11.06f)
            curveTo(3.11f, 11.37f, 3.08f, 11.68f, 3.08f, 12f)
            curveTo(3.08f, 12.32f, 3.11f, 12.63f, 3.14f, 12.94f)
            lineTo(0.87f, 14.71f)
            curveTo(0.66f, 14.87f, 0.61f, 15.16f, 0.74f, 15.4f)
            lineTo(2.88f, 19.11f)
            curveTo(3.01f, 19.34f, 3.3f, 19.43f, 3.54f, 19.33f)
            lineTo(6.22f, 18.25f)
            curveTo(6.78f, 18.68f, 7.39f, 19.03f, 8.06f, 19.3f)
            lineTo(8.46f, 22.15f)
            curveTo(8.49f, 22.42f, 8.72f, 22.62f, 9f, 22.62f)
            lineTo(13.3f, 22.62f)
            curveTo(13.58f, 22.62f, 13.81f, 22.42f, 13.84f, 22.15f)
            lineTo(14.24f, 19.3f)
            curveTo(14.91f, 19.03f, 15.52f, 18.68f, 16.08f, 18.25f)
            lineTo(18.75f, 19.33f)
            curveTo(18.99f, 19.43f, 19.28f, 19.34f, 19.41f, 19.11f)
            lineTo(21.55f, 15.4f)
            curveTo(21.68f, 15.16f, 21.62f, 14.87f, 21.42f, 14.71f)
            lineTo(19.14f, 12.94f)
            close()
            moveTo(11.14f, 15.5f)
            curveTo(9.21f, 15.5f, 7.64f, 13.93f, 7.64f, 12f)
            curveTo(7.64f, 10.07f, 9.21f, 8.5f, 11.14f, 8.5f)
            curveTo(13.07f, 8.5f, 14.64f, 10.07f, 14.64f, 12f)
            curveTo(14.64f, 13.93f, 13.07f, 15.5f, 11.14f, 15.5f)
            close()
        }.build()
    }

    val Star: ImageVector by lazy {
        ImageVector.Builder(
            name = "StarIcon",
            defaultWidth = 24.dp,
            defaultHeight = 24.dp,
            viewportWidth = 24f,
            viewportHeight = 24f
        ).path(fill = SolidColor(Color.White)) {
            moveTo(12f, 17.27f)
            lineTo(18.18f, 21f)
            lineTo(16.54f, 13.97f)
            lineTo(22f, 9.24f)
            lineTo(14.81f, 8.63f)
            lineTo(12f, 2f)
            lineTo(9.19f, 8.63f)
            lineTo(2f, 9.24f)
            lineTo(7.46f, 13.97f)
            lineTo(5.82f, 21f)
            lineTo(12f, 17.27f)
            close()
        }.build()
    }
}
