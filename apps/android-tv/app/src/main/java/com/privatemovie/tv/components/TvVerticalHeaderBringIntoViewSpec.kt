package com.privatemovie.tv.components

import androidx.compose.foundation.ExperimentalFoundationApi
import androidx.compose.foundation.gestures.BringIntoViewSpec
import androidx.compose.foundation.lazy.LazyListState

/**
 * BringIntoView specification for vertical [LazyColumn] containers with a
 * full-viewport header item at index 0 (e.g. hero banner / detail backdrop).
 *
 * Suppresses vertical auto-scroll when the header is the first visible item
 * and the focused element already fits entirely within the viewport. This keeps
 * full-bleed banner images pinned at the top when CTA buttons inside the
 * header receive D-pad focus.
 *
 * When the header has been scrolled past ([LazyListState.firstVisibleItemIndex] != 0),
 * standard bring-into-view distances are returned so rows/episodes below the
 * header scroll normally.
 */
@OptIn(ExperimentalFoundationApi::class)
class TvVerticalHeaderBringIntoViewSpec(
    private val lazyListState: LazyListState
) : BringIntoViewSpec {

    override fun calculateScrollDistance(offset: Float, size: Float, containerSize: Float): Float {
        val isHeaderVisible = run {
            val visible = lazyListState.layoutInfo.visibleItemsInfo
            if (visible.isNotEmpty()) {
                visible.first().index == 0
            } else {
                lazyListState.firstVisibleItemIndex == 0
            }
        }

        if (isHeaderVisible) {
            // Focused child already fully inside the viewport — suppress scroll so
            // the banner/banner-backed CTA does not cause the column to nudge.
            if (offset >= 0f && offset + size <= containerSize) {
                return 0f
            }
        }

        return when {
            offset < 0f -> offset
            offset + size > containerSize -> offset + size - containerSize
            else -> 0f
        }
    }
}
