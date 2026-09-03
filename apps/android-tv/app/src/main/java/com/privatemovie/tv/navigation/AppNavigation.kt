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
                onPlayEpisode = { episodeId ->
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
            PlayerScreen(
                episodeId = episodeId,
                onExitPlayer = {
                    navController.popBackStack()
                }
            )
        }
    }
}
