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
import com.privatemovie.tv.modules.player.PLAYER_NAV_ARGS_KEY
import com.privatemovie.tv.modules.player.PlaybackMetadataHandoff
import com.privatemovie.tv.modules.player.PlaybackSourceRef
import com.privatemovie.tv.modules.player.PlayerNavArgs
import com.privatemovie.tv.modules.player.PlayerScreen
import com.privatemovie.tv.modules.player.PlaylistEpisodeItem

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
                    val playerNavArgs = PlayerNavArgs(
                        episodeId = episodeId,
                        metadata = metadata
                    )
                    navController.currentBackStackEntry?.savedStateHandle?.set(PLAYER_NAV_ARGS_KEY, playerNavArgs)
                    navController.navigate(TvScreen.Player.createRoute(episodeId))
                },
                onPlaySource = { episodeId, source, metadata ->
                    val playerNavArgs = PlayerNavArgs(
                        episodeId = episodeId,
                        source = PlaybackSourceRef(type = source.type, url = source.url),
                        metadata = metadata
                    )
                    navController.currentBackStackEntry?.savedStateHandle?.set(PLAYER_NAV_ARGS_KEY, playerNavArgs)
                    navController.navigate(TvScreen.Player.createRoute(episodeId))
                },
                onPlayNavArgs = { playerNavArgs ->
                    navController.currentBackStackEntry?.savedStateHandle?.set(PLAYER_NAV_ARGS_KEY, playerNavArgs)
                    navController.navigate(TvScreen.Player.createRoute(playerNavArgs.episodeId))
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
            val playerNavArgs = navController.previousBackStackEntry?.savedStateHandle?.get<PlayerNavArgs>(PLAYER_NAV_ARGS_KEY)

            val playlist = playerNavArgs?.playlist ?: emptyList()
            val currentIndex = playlist.indexOfFirst { it.episodeId == episodeId }
            val prevItem = if (currentIndex > 0) playlist.getOrNull(currentIndex - 1) else null
            val nextItem = if (currentIndex >= 0 && currentIndex < playlist.size - 1) playlist.getOrNull(currentIndex + 1) else null

            fun playNeighbor(target: PlaylistEpisodeItem) {
                val nextNavArgs = PlayerNavArgs(
                    episodeId = target.episodeId,
                    source = if (target.sourceTypeName != null && target.sourceUrl != null) {
                        PlaybackSourceRef(type = target.sourceTypeName, url = target.sourceUrl)
                    } else null,
                    metadata = PlaybackMetadataHandoff(
                        seriesTitle = target.seriesTitle,
                        seasonTitle = target.seasonTitle,
                        seasonNumber = target.seasonNumber,
                        episodeOrder = target.episodeOrder,
                        episodeTitle = target.episodeTitle
                    ),
                    playlist = playlist
                )
                navController.currentBackStackEntry?.savedStateHandle?.set(PLAYER_NAV_ARGS_KEY, nextNavArgs)
                navController.navigate(TvScreen.Player.createRoute(target.episodeId)) {
                    popUpTo(TvScreen.Player.route) { inclusive = true }
                }
            }

            PlayerScreen(
                episodeId = episodeId,
                playerNavArgs = playerNavArgs,
                onExitPlayer = {
                    navController.popBackStack()
                },
                hasPrevious = prevItem != null,
                hasNext = nextItem != null,
                onPlayPreviousEpisode = prevItem?.let { prev -> { playNeighbor(prev) } },
                onPlayNextEpisode = nextItem?.let { next -> { playNeighbor(next) } },
                backendBaseUrl = activeUrl
            )
        }
    }
}
