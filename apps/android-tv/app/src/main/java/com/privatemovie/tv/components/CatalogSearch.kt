package com.privatemovie.tv.components

import android.view.KeyEvent.ACTION_DOWN
import android.view.KeyEvent.KEYCODE_BACK
import android.view.KeyEvent.KEYCODE_DPAD_DOWN
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.focus.onFocusChanged
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.input.key.onKeyEvent
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.unit.dp
import androidx.tv.material3.Border
import androidx.tv.material3.ClickableSurfaceDefaults
import androidx.tv.material3.ExperimentalTvMaterial3Api
import androidx.tv.material3.Surface as TvSurface
import com.privatemovie.tv.components.isRepeatKeyEvent
import com.privatemovie.tv.modules.home.internal.CatalogSearchViewModel

/**
 * Interactive TV search field with a floating suggestions dropdown.
 *
 * - Focus/click expands the text field for TV IME keyboard input.
 * - Queries are debounced inside [searchViewModel].
 * - D-pad Down from the field moves focus into the suggestions list.
 * - Remote Back while the dropdown is open dismisses it and keeps field focus.
 */
@OptIn(ExperimentalTvMaterial3Api::class)
@Composable
fun CatalogSearch(
    searchViewModel: CatalogSearchViewModel,
    onSelectSeries: (String) -> Unit,
    modifier: Modifier = Modifier,
    onDownToContent: (() -> Unit)? = null,
    placeholder: String = "Search"
) {
    val uiState by searchViewModel.uiState.collectAsState()
    val fieldFocus = remember { FocusRequester() }
    val suggestionFocusers = remember(uiState.suggestions) {
        uiState.suggestions.map { FocusRequester() }
    }
    var isFieldFocused by remember { mutableStateOf(false) }
    var suppressDownToContent by remember { mutableStateOf(false) }

    LaunchedEffect(uiState.isDropdownOpen) {
        suppressDownToContent = uiState.isDropdownOpen
    }

    Box(modifier = modifier.width(280.dp)) {
        Column(modifier = Modifier.fillMaxWidth()) {
            BasicTextField(
                value = uiState.query,
                onValueChange = { searchViewModel.onQueryChange(it) },
                singleLine = true,
                textStyle = TextStyle(
                    color = Color.White,
                    fontSize = MaterialTheme.typography.bodyMedium.fontSize,
                    fontWeight = if (isFieldFocused) FontWeight.SemiBold else FontWeight.Normal
                ),
                cursorBrush = SolidColor(Color.White),
                keyboardOptions = KeyboardOptions(imeAction = ImeAction.Search),
                keyboardActions = KeyboardActions(
                    onSearch = {
                        uiState.suggestions.firstOrNull()?.let { onSelectSeries(it.id) }
                    }
                ),
                decorationBox = { innerTextField ->
                    Box(
                        modifier = Modifier
                            .fillMaxWidth()
                            .background(
                                if (isFieldFocused) Color.White.copy(alpha = 0.22f)
                                else Color.White.copy(alpha = 0.12f),
                                RoundedCornerShape(8.dp)
                            )
                            .padding(horizontal = 12.dp, vertical = 8.dp)
                    ) {
                        if (uiState.query.isEmpty()) {
                            Text(
                                text = placeholder,
                                style = MaterialTheme.typography.bodyMedium,
                                color = Color.White.copy(alpha = 0.6f)
                            )
                        }
                        innerTextField()
                    }
                },
                modifier = Modifier
                    .fillMaxWidth()
                    .focusRequester(fieldFocus)
                    .onFocusChanged { isFieldFocused = it.isFocused }
                    .onKeyEvent { keyEvent ->
                        if (isRepeatKeyEvent(keyEvent)) return@onKeyEvent true
                        if (keyEvent.nativeKeyEvent.action != ACTION_DOWN) return@onKeyEvent false
                        when (keyEvent.nativeKeyEvent.keyCode) {
                            KEYCODE_BACK -> {
                                if (uiState.isDropdownOpen) {
                                    searchViewModel.dismiss()
                                    true
                                } else {
                                    false
                                }
                            }
                            KEYCODE_DPAD_DOWN -> {
                                if (uiState.isDropdownOpen && suggestionFocusers.isNotEmpty()) {
                                    try {
                                        suggestionFocusers.first().requestFocus()
                                    } catch (_: Exception) {
                                    }
                                    true
                                } else {
                                    onDownToContent?.invoke()
                                    onDownToContent != null
                                }
                            }
                            else -> false
                        }
                    }
            )

            if (uiState.isDropdownOpen && uiState.suggestions.isNotEmpty()) {
                Column(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(top = 4.dp)
                        .background(Color(0xFF1C1C22), RoundedCornerShape(8.dp))
                        .padding(vertical = 4.dp)
                ) {
                    // Read latest focus state at key-event time so it cannot go stale.
                    uiState.suggestions.forEachIndexed { index, series ->
                        val requester = suggestionFocusers.getOrNull(index)
                        var itemModifier: Modifier = Modifier
                            .fillMaxWidth()
                            .padding(horizontal = 4.dp)
                        if (requester != null) {
                            itemModifier = itemModifier.focusRequester(requester)
                        }
                        itemModifier = itemModifier.onKeyEvent { keyEvent ->
                            if (isRepeatKeyEvent(keyEvent)) return@onKeyEvent true
                            if (keyEvent.nativeKeyEvent.action != ACTION_DOWN) return@onKeyEvent false
                            when (keyEvent.nativeKeyEvent.keyCode) {
                                KEYCODE_BACK -> {
                                    searchViewModel.dismiss()
                                    try {
                                        fieldFocus.requestFocus()
                                    } catch (_: Exception) {
                                    }
                                    true
                                }
                                KEYCODE_DPAD_DOWN -> {
                                    val next = suggestionFocusers.getOrNull(index + 1)
                                    if (next != null) {
                                        try {
                                            next.requestFocus()
                                        } catch (_: Exception) {
                                        }
                                        true
                                    } else {
                                        onDownToContent?.invoke()
                                        onDownToContent != null
                                    }
                                }
                                else -> false
                            }
                        }
                        TvSurface(
                            onClick = { onSelectSeries(series.id) },
                            modifier = itemModifier,
                            shape = ClickableSurfaceDefaults.shape(shape = RoundedCornerShape(6.dp)),
                            scale = ClickableSurfaceDefaults.scale(focusedScale = 1.02f),
                            border = ClickableSurfaceDefaults.border(
                                focusedBorder = Border(
                                    border = androidx.compose.foundation.BorderStroke(
                                        width = 2.dp,
                                        color = Color.White
                                    ),
                                    shape = RoundedCornerShape(6.dp)
                                )
                            ),
                            colors = ClickableSurfaceDefaults.colors(
                                containerColor = Color.Transparent,
                                focusedContainerColor = Color.White.copy(alpha = 0.12f)
                            )
                        ) {
                            Column(modifier = Modifier.padding(horizontal = 12.dp, vertical = 8.dp)) {
                                Text(
                                    text = series.title,
                                    style = MaterialTheme.typography.bodyMedium.copy(
                                        fontWeight = FontWeight.SemiBold
                                    ),
                                    color = Color.White,
                                    maxLines = 1
                                )
                                series.type?.let { type ->
                                    Text(
                                        text = type,
                                        style = MaterialTheme.typography.bodySmall,
                                        color = Color.White.copy(alpha = 0.6f),
                                        maxLines = 1
                                    )
                                }
                            }
                        }
                    }
                }
            }
        }
    }
}
