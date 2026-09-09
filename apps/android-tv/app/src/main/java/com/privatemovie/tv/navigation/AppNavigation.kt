package com.privatemovie.tv.navigation

import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Modifier
import androidx.navigation.NavHostController
import androidx.navigation.NavType
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.rememberNavController
import androidx.navigation.navArgument
import com.privatemovie.tv.data.network.MediaApiClient
import com.privatemovie.tv.data.repository.DefaultMediaRepository
import com.privatemovie.tv.data.repository.MediaRepository
import com.privatemovie.tv.modules.config.BackendUrlOverrideScreen
import com.privatemovie.tv.modules.config.BackendUrlStore
import com.privatemovie.tv.modules.detail.DetailScreen
import com.privatemovie.tv.modules.home.HomeScreen
import com.privatemovie.tv.modules.player.PlayerScreen
import com.privatemovie.tv.modules.player.internal.PLAYER_EPISODE_ORDER_KEY
import com.privatemovie.tv.modules.player.internal.PLAYER_EPISODE_TITLE_KEY
import com.privatemovie.tv.modules.player.internal.PLAYER_SEASON_NUMBER_KEY
import com.privatemovie.tv.modules.player.internal.PLAYER_SEASON_TITLE_KEY
import com.privatemovie.tv.modules.player.internal.PLAYER_SERIES_TITLE_KEY
import com.privatemovie.tv.modules.player.internal.PLAYER_SOURCE_TYPE_KEY
import com.privatemovie.tv.modules.player.internal.PLAYER_SOURCE_URL_KEY
import com.privatemovie.tv.modules.player.internal.PlaybackSourceRef
import com.privatemovie.tv.modules.player.internal.buildPlayerHandoff

sealed class TvScreen(val route: String) {
    object Home : TvScreen("home")
    object DevSettings : TvScreen("dev_settings")
    object Detail : TvScreen("detail/{seriesId}") {
        fun createRoute(seriesId: String) = "detail/$seriesId"
    }
    object Player : TvScreen("player/{episodeId}") {
        fun createRoute(episodeId: String) = "player/$episodeId"
    }
}

@Composable
fun AppNavigation(
    urlStore: BackendUrlStore,
    modifier: Modifier = Modifier,
    navController: NavHostController = rememberNavController(),
    mediaRepository: MediaRepository = remember(urlStore) {
        DefaultMediaRepository(
            apiClient = MediaApiClient(baseUrlProvider = { urlStore.getUrl() })
        )
    }
) {
    val activeUrl by urlStore.activeUrl.collectAsState()

    NavHost(
        navController = navController,
        startDestination = TvScreen.Home.route,
        modifier = modifier
    ) {
        composable(TvScreen.Home.route) {
            HomeScreen(
                activeBackendUrl = activeUrl,
                mediaRepository = mediaRepository,
                onSelectSeries = { seriesId ->
                    navController.navigate(TvScreen.Detail.createRoute(seriesId))
                },
                onOpenDevSettings = {
                    navController.navigate(TvScreen.DevSettings.route)
                }
            )
        }

        composable(TvScreen.DevSettings.route) {
            BackendUrlOverrideScreen(
                urlStore = urlStore,
                onBack = {
                    navController.popBackStack()
                }
            )
        }

        composable(
            route = TvScreen.Detail.route,
            arguments = listOf(navArgument("seriesId") { type = NavType.StringType })
        ) { backStackEntry ->
            val seriesId = backStackEntry.arguments?.getString("seriesId") ?: "unknown"
            DetailScreen(
                seriesId = seriesId,
                activeBackendUrl = activeUrl,
                mediaRepository = mediaRepository,
                onPlayEpisode = { episodeId, metadata ->
                    navController.currentBackStackEntry?.savedStateHandle?.apply {
                        remove<String>(PLAYER_SOURCE_TYPE_KEY)
                        remove<String>(PLAYER_SOURCE_URL_KEY)
                        metadata.seriesTitle?.let { set(PLAYER_SERIES_TITLE_KEY, it) }
                            ?: remove<String>(PLAYER_SERIES_TITLE_KEY)
                        metadata.seasonTitle?.let { set(PLAYER_SEASON_TITLE_KEY, it) }
                            ?: remove<String>(PLAYER_SEASON_TITLE_KEY)
                        metadata.seasonNumber?.let { set(PLAYER_SEASON_NUMBER_KEY, it) }
                            ?: remove<Int>(PLAYER_SEASON_NUMBER_KEY)
                        metadata.episodeOrder?.let { set(PLAYER_EPISODE_ORDER_KEY, it) }
                            ?: remove<Int>(PLAYER_EPISODE_ORDER_KEY)
                        metadata.episodeTitle?.let { set(PLAYER_EPISODE_TITLE_KEY, it) }
                            ?: remove<String>(PLAYER_EPISODE_TITLE_KEY)
                    }
                    navController.navigate(TvScreen.Player.createRoute(episodeId))
                },
                onPlaySource = { episodeId, source, metadata ->
                    val handoff = buildPlayerHandoff(
                        episodeId = episodeId,
                        source = PlaybackSourceRef(type = source.type, url = source.url),
                        metadata = metadata
                    )
                    navController.currentBackStackEntry?.savedStateHandle?.apply {
                        handoff.sourceTypeName?.let { set(PLAYER_SOURCE_TYPE_KEY, it) }
                            ?: remove<String>(PLAYER_SOURCE_TYPE_KEY)
                        handoff.sourceUrl?.let { set(PLAYER_SOURCE_URL_KEY, it) }
                            ?: remove<String>(PLAYER_SOURCE_URL_KEY)
                        handoff.seriesTitle?.let { set(PLAYER_SERIES_TITLE_KEY, it) }
                            ?: remove<String>(PLAYER_SERIES_TITLE_KEY)
                        handoff.seasonTitle?.let { set(PLAYER_SEASON_TITLE_KEY, it) }
                            ?: remove<String>(PLAYER_SEASON_TITLE_KEY)
                        handoff.seasonNumber?.let { set(PLAYER_SEASON_NUMBER_KEY, it) }
                            ?: remove<Int>(PLAYER_SEASON_NUMBER_KEY)
                        handoff.episodeOrder?.let { set(PLAYER_EPISODE_ORDER_KEY, it) }
                            ?: remove<Int>(PLAYER_EPISODE_ORDER_KEY)
                        handoff.episodeTitle?.let { set(PLAYER_EPISODE_TITLE_KEY, it) }
                            ?: remove<String>(PLAYER_EPISODE_TITLE_KEY)
                    }
                    navController.navigate(TvScreen.Player.createRoute(episodeId))
                },
                onBack = {
                    navController.popBackStack()
                }
            )
        }

        composable(
            route = TvScreen.Player.route,
            arguments = listOf(navArgument("episodeId") { type = NavType.StringType })
        ) { backStackEntry ->
            val episodeId = backStackEntry.arguments?.getString("episodeId") ?: "unknown"
            val playbackHandle = navController.previousBackStackEntry?.savedStateHandle
            PlayerScreen(
                episodeId = episodeId,
                onExitPlayer = {
                    navController.popBackStack()
                },
                playbackSourceTypeName = playbackHandle?.get<String>(PLAYER_SOURCE_TYPE_KEY),
                playbackUrl = playbackHandle?.get<String>(PLAYER_SOURCE_URL_KEY),
                seriesTitle = playbackHandle?.get<String>(PLAYER_SERIES_TITLE_KEY),
                seasonTitle = playbackHandle?.get<String>(PLAYER_SEASON_TITLE_KEY),
                seasonNumber = playbackHandle?.get<Int>(PLAYER_SEASON_NUMBER_KEY),
                episodeOrder = playbackHandle?.get<Int>(PLAYER_EPISODE_ORDER_KEY),
                episodeTitle = playbackHandle?.get<String>(PLAYER_EPISODE_TITLE_KEY),
                backendBaseUrl = activeUrl
            )
        }
    }
}
