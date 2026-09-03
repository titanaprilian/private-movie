package com.privatemovie.tv.modules.player

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.material3.Button
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp

@Composable
fun PlayerScreen(
    episodeId: String,
    onExitPlayer: () -> Unit,
    modifier: Modifier = Modifier
) {
    var isPlaying by remember { mutableStateOf(true) }
    var statusText by remember { mutableStateOf("Playing Episode $episodeId") }

    Box(
        modifier = modifier
            .fillMaxSize()
            .background(Color.Black),
        contentAlignment = Alignment.Center
    ) {
        // Player Surface Placeholder
        Text(
            text = "TV Fullscreen Player Container\n$statusText",
            style = MaterialTheme.typography.headlineMedium,
            color = Color.White,
            modifier = Modifier.padding(32.dp)
        )

        // Overlay Transport Controls for TV D-Pad navigation
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(24.dp),
            verticalArrangement = Arrangement.SpaceBetween
        ) {
            // Top Bar
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text(
                    text = "Episode: $episodeId",
                    style = MaterialTheme.typography.titleLarge,
                    color = Color.White
                )

                Button(onClick = onExitPlayer) {
                    Text("Exit Player (Back)")
                }
            }

            // Bottom Transport Control Bar
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .background(Color(0xAA000000))
                    .padding(16.dp),
                horizontalArrangement = Arrangement.Center,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Button(onClick = { statusText = "Seeking -10s" }) {
                    Text("<< Seek -10s")
                }

                Spacer(modifier = Modifier.width(16.dp))

                Button(onClick = {
                    isPlaying = !isPlaying
                    statusText = if (isPlaying) "Playing Episode $episodeId" else "Paused"
                }) {
                    Text(if (isPlaying) "Pause" else "Play")
                }

                Spacer(modifier = Modifier.width(16.dp))

                Button(onClick = { statusText = "Seeking +10s" }) {
                    Text("Seek +10s >>")
                }
            }
        }
    }
}
