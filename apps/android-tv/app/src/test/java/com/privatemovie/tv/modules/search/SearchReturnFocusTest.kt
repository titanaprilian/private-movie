package com.privatemovie.tv.modules.search

import com.privatemovie.tv.dto.models.SeriesSummary
import com.privatemovie.tv.modules.search.internal.ResolvedSearchReturnFocus
import com.privatemovie.tv.modules.search.internal.SearchReturnFocusTarget
import com.privatemovie.tv.modules.search.internal.resolveSearchReturnFocus
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

class SearchReturnFocusTest {

    private fun series(id: String) = SeriesSummary(id = id, title = "Title $id")

    @Test
    fun `resolves exact card index on series match`() {
        val results = listOf(series("s-0"), series("s-1"), series("s-2"))
        val target = SearchReturnFocusTarget(index = 1, seriesId = "s-1")

        val resolved = resolveSearchReturnFocus(results, target)
        assertEquals(ResolvedSearchReturnFocus(index = 1), resolved)
    }

    @Test
    fun `resolves new index when series position shifted within results`() {
        val results = listOf(series("s-2"), series("s-0"), series("s-1"))
        val target = SearchReturnFocusTarget(index = 0, seriesId = "s-1")

        val resolved = resolveSearchReturnFocus(results, target)
        assertEquals(ResolvedSearchReturnFocus(index = 2), resolved)
    }

    @Test
    fun `clamps index into valid bounds when series id is missing but results exist`() {
        val results = listOf(series("s-0"), series("s-1"))
        val target = SearchReturnFocusTarget(index = 5, seriesId = "s-missing")

        val resolved = resolveSearchReturnFocus(results, target)
        assertEquals(ResolvedSearchReturnFocus(index = 1), resolved)
    }

    @Test
    fun `returns null if results list is empty`() {
        val target = SearchReturnFocusTarget(index = 0, seriesId = "s-0")
        val resolved = resolveSearchReturnFocus(emptyList(), target)
        assertNull(resolved)
    }

    @Test
    fun `returns null if target is null`() {
        val results = listOf(series("s-0"))
        val resolved = resolveSearchReturnFocus(results, null)
        assertNull(resolved)
    }
}
