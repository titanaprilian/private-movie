package com.privatemovie.tv.modules.search.internal

import com.privatemovie.tv.dto.models.SeriesSummary

/**
 * Origin-tracked focus target for returning from the Series Detail screen to the Search screen.
 *
 * Records the position and series identifier of the card selected by the user.
 */
data class SearchReturnFocusTarget(
    val index: Int,
    val seriesId: String
)

/**
 * Resolved index for return focus restoration in Search screen.
 */
data class ResolvedSearchReturnFocus(
    val index: Int
)

/**
 * Resolves a recorded [target] against current [results].
 *
 * - Returns null if [target] is null.
 * - Returns null if [results] is empty (fallback to search input / default).
 * - If the series at [target.index] matches [target.seriesId], returns that exact index.
 * - If the series shifted position within [results], returns its new index.
 * - Otherwise clamps [target.index] into range `[0, results.size - 1]`.
 */
fun resolveSearchReturnFocus(
    results: List<SeriesSummary>,
    target: SearchReturnFocusTarget?
): ResolvedSearchReturnFocus? {
    if (target == null || results.isEmpty()) return null

    val exactMatch = results.getOrNull(target.index)?.id == target.seriesId
    if (exactMatch) {
        return ResolvedSearchReturnFocus(index = target.index)
    }

    val movedIndex = results.indexOfFirst { it.id == target.seriesId }
    if (movedIndex >= 0) {
        return ResolvedSearchReturnFocus(index = movedIndex)
    }

    val clampedIndex = target.index.coerceIn(0, results.size - 1)
    return ResolvedSearchReturnFocus(index = clampedIndex)
}
