package com.privatemovie.tv.modules.detail.internal

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.window.Dialog
import androidx.tv.material3.Border
import androidx.tv.material3.Button as TvButton
import androidx.tv.material3.ButtonDefaults as TvButtonDefaults
import androidx.tv.material3.Card as TvCard
import androidx.tv.material3.CardDefaults as TvCardDefaults

@Composable
fun SourcePickerDialog(
    episodeTitle: String,
    sources: List<TvVideoSource>,
    onSelectSource: (TvVideoSource) -> Unit,
    onDismiss: () -> Unit,
    modifier: Modifier = Modifier
) {
    val firstSourceFocus = remember { FocusRequester() }

    LaunchedEffect(Unit) {
        if (sources.isNotEmpty()) {
            firstSourceFocus.requestFocus()
        }
    }

    Dialog(onDismissRequest = onDismiss) {
        Surface(
            shape = RoundedCornerShape(16.dp),
            color = Color(0xFF1E1E1E),
            border = BorderStroke(1.dp, Color(0xFF3E3E3E)),
            modifier = modifier
                .fillMaxWidth(0.85f)
                .padding(16.dp)
        ) {
            Column(
                modifier = Modifier.padding(24.dp),
                horizontalAlignment = Alignment.Start
            ) {
                Text(
                    text = "Select Playback Source",
                    style = MaterialTheme.typography.titleLarge,
                    color = MaterialTheme.colorScheme.onSurface
                )
                Spacer(modifier = Modifier.height(4.dp))
                Text(
                    text = episodeTitle,
                    style = MaterialTheme.typography.bodyMedium,
                    color = Color.LightGray
                )
                Spacer(modifier = Modifier.height(20.dp))

                LazyColumn(
                    verticalArrangement = Arrangement.spacedBy(12.dp)
                ) {
                    itemsIndexed(sources) { index, source ->
                        val itemModifier = if (index == 0) {
                            Modifier.focusRequester(firstSourceFocus)
                        } else {
                            Modifier
                        }
                        SourceItemRow(
                            source = source,
                            onSelect = { onSelectSource(source) },
                            modifier = itemModifier
                        )
                    }
                }

                Spacer(modifier = Modifier.height(24.dp))

                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.End
                ) {
                    val cancelShape = RoundedCornerShape(8.dp)
                    TvButton(
                        onClick = onDismiss,
                        shape = TvButtonDefaults.shape(
                            shape = cancelShape,
                            focusedShape = cancelShape
                        ),
                        scale = TvButtonDefaults.scale(
                            scale = 1.0f,
                            focusedScale = 1.05f
                        ),
                        border = TvButtonDefaults.border(
                            border = Border.None,
                            focusedBorder = Border(
                                border = BorderStroke(width = 2.dp, color = Color.White),
                                shape = cancelShape
                            )
                        ),
                        colors = TvButtonDefaults.colors(
                            containerColor = Color.White.copy(alpha = 0.12f),
                            focusedContainerColor = Color.White.copy(alpha = 0.25f),
                            contentColor = Color.White,
                            focusedContentColor = Color.White
                        )
                    ) {
                        Text("Cancel", fontWeight = FontWeight.Medium)
                    }
                }
            }
        }
    }
}

@Composable
private fun SourceItemRow(
    source: TvVideoSource,
    onSelect: () -> Unit,
    modifier: Modifier = Modifier
) {
    val cardShape = RoundedCornerShape(10.dp)
    TvCard(
        onClick = onSelect,
        modifier = modifier.fillMaxWidth(),
        shape = TvCardDefaults.shape(
            shape = cardShape,
            focusedShape = cardShape
        ),
        scale = TvCardDefaults.scale(
            scale = 1.0f,
            focusedScale = 1.03f
        ),
        border = TvCardDefaults.border(
            border = Border.None,
            focusedBorder = Border(
                border = BorderStroke(width = 2.dp, color = Color.White),
                shape = cardShape
            )
        ),
        colors = TvCardDefaults.colors(
            containerColor = Color(0xFF2B2B36),
            focusedContainerColor = MaterialTheme.colorScheme.primaryContainer
        )
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
                    text = source.label,
                    style = MaterialTheme.typography.titleMedium.copy(fontWeight = FontWeight.Bold),
                    color = MaterialTheme.colorScheme.onSurface
                )
                val formatDetails = listOfNotNull(
                    source.quality?.let { "Quality: $it" },
                    "Type: ${source.type.uppercase()}"
                ).joinToString("  •  ")

                Text(
                    text = formatDetails,
                    style = MaterialTheme.typography.bodySmall,
                    color = Color.LightGray
                )
            }

            Box(
                modifier = Modifier
                    .clip(RoundedCornerShape(6.dp))
                    .background(MaterialTheme.colorScheme.primary)
                    .padding(horizontal = 14.dp, vertical = 6.dp)
            ) {
                Text(
                    text = "Play",
                    style = MaterialTheme.typography.labelMedium.copy(fontWeight = FontWeight.Bold),
                    color = Color.White
                )
            }
        }
    }
}
