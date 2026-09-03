package com.privatemovie.tv.navigation

import org.junit.Assert.assertEquals
import org.junit.Test

class NavigationTest {

    @Test
    fun `TvScreen Home route is correct`() {
        assertEquals("home", TvScreen.Home.route)
    }

    @Test
    fun `TvScreen DevSettings route is correct`() {
        assertEquals("dev_settings", TvScreen.DevSettings.route)
    }

    @Test
    fun `TvScreen Detail route pattern and helper formatting match`() {
        assertEquals("detail/{seriesId}", TvScreen.Detail.route)
        assertEquals("detail/series-42", TvScreen.Detail.createRoute("series-42"))
    }

    @Test
    fun `TvScreen Player route pattern and helper formatting match`() {
        assertEquals("player/{episodeId}", TvScreen.Player.route)
        assertEquals("player/episode-108", TvScreen.Player.createRoute("episode-108"))
    }
}
