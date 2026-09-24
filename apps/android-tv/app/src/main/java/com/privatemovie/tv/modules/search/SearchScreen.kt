package com.privatemovie.tv.modules.search

import android.view.KeyEvent.ACTION_DOWN
import android.view.KeyEvent.KEYCODE_DPAD_DOWN
import androidx.activity.compose.BackHandler
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.foundation.lazy.grid.itemsIndexed
import androidx.compose.foundation.lazy.grid.rememberLazyGridState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
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
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import com.privatemovie.tv.components.isRepeatKeyEvent
import com.privatemovie.tv.components.requestFocusSafely
import com.privatemovie.tv.data.repository.MediaRepository
import com.privatemovie.tv.modules.genre.internal.GenrePosterCard
import kotlinx.coroutines.launch

private const val SEARCH_GRID_COLUMNS = 5

/**
 * Public seam for the dedicated TV Search Screen (`search`).
 *
 * Renders a prominent TV-friendly search text field with IME keyboard support
 * at the top and a 5-column vertical results grid of series poster cards.
 * Queries are debounced (300ms) inside [SearchViewModel] with `limit = 20`.
 * D-pad Down from the search field moves focus into the first result card;
 * selecting a card navigates via [onSelectSeries]; remote Back navigates
 * to Home via [onNavigateHome].
 */
@Composable
fun SearchScreen(
    activeBackendUrl: String,
    mediaRepository: MediaRepository,
    onSelectSeries: (String) -> Unit,
    onNavigateHome: () -> Unit,
    modifier: Modifier = Modifier,
    viewModel: SearchViewModel = remember(mediaRepository) {
        SearchViewModel(mediaRepository = mediaRepository)
    },
    onFocusDrawer: () -> Unit = {}
) {
    val uiState by viewModel.uiState.collectAsState()
    val fieldFocus = remember { FocusRequester() }
    val firstResultFocus = remember { FocusRequester() }
    val coroutineScope = rememberCoroutineScope()
    val gridState = rememberLazyGridState()
    var isFieldFocused by remember { mutableStateOf(false) }

    BackHandler {
        onNavigateHome()
    }

    LaunchedEffect(Unit) {
        requestFocusSafely(fieldFocus)
    }

    Column(
        modifier = modifier
            .fillMaxSize()
            .background(MaterialTheme.colorScheme.background)
            .padding(horizontal = 48.dp, vertical = 24.dp)
    ) {
        BasicTextField(
            value = uiState.query,
            onValueChange = { viewModel.onQueryChange(it) },
            singleLine = true,
            textStyle = TextStyle(
                color = Color.White,
                fontSize = MaterialTheme.typography.titleMedium.fontSize,
                fontWeight = FontWeight.SemiBold
            ),
            cursorBrush = SolidColor(Color.White),
            keyboardOptions = KeyboardOptions(imeAction = ImeAction.Search),
            keyboardActions = KeyboardActions(
                onSearch = {
                    uiState.results.firstOrNull()?.let { onSelectSeries(it.id) }
                }
            ),
            decorationBox = { innerTextField ->
                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .background(
                            if (isFieldFocused) Color.White.copy(alpha = 0.22f)
                            else Color.White.copy(alpha = 0.12f),
                            RoundedCornerShape(12.dp)
                        )
                        .padding(horizontal = 20.dp, vertical = 16.dp)
                ) {
                    if (uiState.query.isEmpty()) {
                        Text(
                            text = "Search series",
                            style = MaterialTheme.typography.titleMedium,
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
                    if (keyEvent.nativeKeyEvent.keyCode == KEYCODE_DPAD_DOWN &&
                        uiState.results.isNotEmpty()
                    ) {
                        coroutineScope.launch {
                            requestFocusSafely(firstResultFocus)
                        }
                        true
                    } else {
                        false
                    }
                }
        )

        Spacer(modifier = Modifier.height(24.dp))

        when {
            uiState.isLoading -> {
                Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                    CircularProgressIndicator(
                        color = MaterialTheme.colorScheme.primary,
                        strokeWidth = 3.dp,
                        modifier = Modifier.size(48.dp)
                    )
                }
            }
            uiState.query.isNotBlank() && uiState.hasSearched && uiState.results.isEmpty() -> {
                Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                    Column(horizontalAlignment = Alignment.CenterHorizontally) {
                        Text(
                            text = "No series found",
                            style = MaterialTheme.typography.titleLarge.copy(fontWeight = FontWeight.Bold),
                            color = MaterialTheme.colorScheme.onBackground
                        )
                        Spacer(modifier = Modifier.height(8.dp))
                        Text(
                            text = "Try a different search term.",
                            style = MaterialTheme.typography.bodyMedium,
                            color = Color.LightGray,
                            textAlign = TextAlign.Center
                        )
                    }
                }
            }
            else -> {
                LazyVerticalGrid(
                    columns = GridCells.Fixed(SEARCH_GRID_COLUMNS),
                    state = gridState,
                    modifier = Modifier.fillMaxSize(),
                    contentPadding = PaddingValues(bottom = 48.dp),
                    verticalArrangement = Arrangement.spacedBy(24.dp),
                    horizontalArrangement = Arrangement.spacedBy(20.dp)
                ) {
                    itemsIndexed(uiState.results, key = { _, item -> item.id }) { index, item ->
                        GenrePosterCard(
                            series = item,
                            baseUrl = activeBackendUrl,
                            onSelect = { onSelectSeries(item.id) },
                            focusRequester = if (index == 0) firstResultFocus else null,
                            onLeft = if (index % SEARCH_GRID_COLUMNS == 0) onFocusDrawer else null
                        )
                    }
                }
            }
        }
    }
}
