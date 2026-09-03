package com.privatemovie.tv.modules.detail

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp

data class SampleEpisode(
    val id: String,
    val number: Int,
    val title: String
)

@Composable
fun DetailScreen(
    seriesId: String,
    onPlayEpisode: (String) -> Unit,
    onBack: () -> Unit,
    modifier: Modifier = Modifier
) {
    val sampleEpisodes = listOf(
        SampleEpisode("ep-1", 1, "Episode 1 — Premier"),
        SampleEpisode("ep-2", 2, "Episode 2 — The Journey Continues"),
        SampleEpisode("ep-3", 3, "Episode 3 — Climax")
    )

    Column(
        modifier = modifier
            .fillMaxSize()
            .background(MaterialTheme.colorScheme.background)
            .padding(32.dp)
    ) {
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Column {
                Text(
                    text = "Series Watch & Detail",
                    style = MaterialTheme.typography.headlineLarge,
                    color = MaterialTheme.colorScheme.onBackground
                )
                Text(
                    text = "Series ID: $seriesId",
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.primary
                )
            }

            Button(onClick = onBack) {
                Text("Back to Home")
            }
        }

        Spacer(modifier = Modifier.height(24.dp))

        Text(
            text = "Available Episodes",
            style = MaterialTheme.typography.titleLarge,
            color = MaterialTheme.colorScheme.onBackground
        )

        Spacer(modifier = Modifier.height(16.dp))

        LazyColumn(
            verticalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            items(sampleEpisodes) { episode ->
                EpisodeRow(
                    episode = episode,
                    onPlay = { onPlayEpisode(episode.id) }
                )
            }
        }
    }
}

@Composable
fun EpisodeRow(
    episode: SampleEpisode,
    onPlay: () -> Unit,
    modifier: Modifier = Modifier
) {
    Card(
        onClick = onPlay,
        colors = CardDefaults.cardColors(
            containerColor = MaterialTheme.colorScheme.surface
        ),
        modifier = modifier.fillMaxWidth()
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(16.dp),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Column {
                Text(
                    text = episode.title,
                    style = MaterialTheme.typography.titleMedium,
                    color = MaterialTheme.colorScheme.onSurface
                )
                Text(
                    text = "Select to play in TV player",
                    style = MaterialTheme.typography.bodySmall,
                    color = Color.LightGray
                )
            }

            Button(onClick = onPlay) {
                Text("Play Episode ${episode.number}")
            }
        }
    }
}
