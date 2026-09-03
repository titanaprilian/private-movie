package com.privatemovie.tv.theme

import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color

val DarkColorScheme = darkColorScheme(
    primary = Color(0xFFE50914),
    onPrimary = Color.White,
    secondary = Color(0xFFB81D24),
    background = Color(0xFF141414),
    surface = Color(0xFF1F1F1F),
    onBackground = Color.White,
    onSurface = Color.White
)

@Composable
fun PrivateMovieTVTheme(content: @Composable () -> Unit) {
    MaterialTheme(
        colorScheme = DarkColorScheme,
        content = content
    )
}
