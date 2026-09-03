package com.privatemovie.tv

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import com.privatemovie.tv.modules.config.SharedPreferencesBackendUrlStore
import com.privatemovie.tv.navigation.AppNavigation
import com.privatemovie.tv.theme.PrivateMovieTVTheme

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        val urlStore = SharedPreferencesBackendUrlStore(applicationContext)

        setContent {
            PrivateMovieTVTheme {
                AppNavigation(urlStore = urlStore)
            }
        }
    }
}
