package com.privatemovie.tv.modules.home.internal

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.input.key.onKeyEvent
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.tv.material3.Border
import androidx.tv.material3.Button as TvButton
import androidx.tv.material3.ButtonDefaults as TvButtonDefaults
import com.privatemovie.tv.components.MediaPlaceholderIcons
import com.privatemovie.tv.components.isRepeatKeyEvent

@Composable
fun FloatingTopBarOverlay(
    onOpenDevSettings: () -> Unit,
    modifier: Modifier = Modifier,
    settingsFocusRequester: FocusRequester? = null,
    onDownFromSettings: (() -> Unit)? = null
) {
    Box(
        modifier = modifier
            .fillMaxWidth()
            .background(
                Brush.verticalGradient(
                    colors = listOf(
                        Color.Black.copy(alpha = 0.75f),
                        Color.Black.copy(alpha = 0.4f),
                        Color.Transparent
                    )
                )
            )
            .padding(horizontal = 48.dp, vertical = 16.dp)
    ) {
        HomeTopBar(
            onOpenDevSettings = onOpenDevSettings,
            settingsFocusRequester = settingsFocusRequester,
            onDownFromSettings = onDownFromSettings
        )
    }
}

@Composable
fun HomeTopBar(
    onOpenDevSettings: () -> Unit,
    modifier: Modifier = Modifier,
    settingsFocusRequester: FocusRequester? = null,
    onDownFromSettings: (() -> Unit)? = null
) {
    Row(
        modifier = modifier
            .fillMaxWidth()
            .height(48.dp),
        horizontalArrangement = Arrangement.SpaceBetween,
        verticalAlignment = Alignment.CenterVertically
    ) {
        Row(
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            Text(
                text = "PRIVATE MOVIE",
                style = MaterialTheme.typography.titleLarge.copy(
                    fontWeight = FontWeight.Black,
                    letterSpacing = 2.sp
                ),
                color = MaterialTheme.colorScheme.primary
            )
            Box(
                modifier = Modifier
                    .clip(RoundedCornerShape(4.dp))
                    .background(Color.White.copy(alpha = 0.12f))
                    .padding(horizontal = 6.dp, vertical = 2.dp)
            ) {
                Text(
                    text = "TV",
                    style = MaterialTheme.typography.labelSmall.copy(
                        fontWeight = FontWeight.Bold,
                        letterSpacing = 1.sp
                    ),
                    color = Color.White.copy(alpha = 0.8f)
                )
            }
        }

        val buttonShape = RoundedCornerShape(20.dp)
        var buttonModifier: Modifier = Modifier
        if (settingsFocusRequester != null) {
            buttonModifier = buttonModifier.focusRequester(settingsFocusRequester)
        }
        if (onDownFromSettings != null) {
            buttonModifier = buttonModifier.onKeyEvent { keyEvent ->
                if (isRepeatKeyEvent(keyEvent)) {
                    return@onKeyEvent true
                }
                if (keyEvent.nativeKeyEvent.action == android.view.KeyEvent.ACTION_DOWN &&
                    keyEvent.nativeKeyEvent.keyCode == android.view.KeyEvent.KEYCODE_DPAD_DOWN
                ) {
                    onDownFromSettings()
                    true
                } else {
                    false
                }
            }
        }

        TvButton(
            onClick = onOpenDevSettings,
            modifier = buttonModifier,
            shape = TvButtonDefaults.shape(
                shape = buttonShape,
                focusedShape = buttonShape
            ),
            scale = TvButtonDefaults.scale(
                scale = 1.0f,
                focusedScale = 1.08f
            ),
            border = TvButtonDefaults.border(
                border = Border.None,
                focusedBorder = Border(
                    border = BorderStroke(width = 2.dp, color = Color.White),
                    shape = buttonShape
                )
            ),
            colors = TvButtonDefaults.colors(
                containerColor = Color.White.copy(alpha = 0.08f),
                focusedContainerColor = MaterialTheme.colorScheme.primary,
                contentColor = Color.White.copy(alpha = 0.9f),
                focusedContentColor = Color.White
            ),
            contentPadding = PaddingValues(horizontal = 14.dp, vertical = 8.dp)
        ) {
            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                Icon(
                    imageVector = MediaPlaceholderIcons.Settings,
                    contentDescription = null,
                    modifier = Modifier.size(16.dp)
                )
                Text(
                    text = "Settings",
                    style = MaterialTheme.typography.labelMedium.copy(fontWeight = FontWeight.SemiBold)
                )
            }
        }
    }
}
