package com.privatemovie.tv.modules.config

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.material3.Button
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp

@Composable
fun BackendUrlOverrideScreen(
    urlStore: BackendUrlStore,
    onBack: () -> Unit,
    modifier: Modifier = Modifier
) {
    val currentUrl by urlStore.activeUrl.collectAsState()
    var inputUrl by remember(currentUrl) { mutableStateOf(currentUrl) }
    var errorMessage by remember { mutableStateOf<String?>(null) }
    var successMessage by remember { mutableStateOf<String?>(null) }

    Column(
        modifier = modifier
            .fillMaxSize()
            .background(MaterialTheme.colorScheme.background)
            .padding(48.dp),
        horizontalAlignment = Alignment.Start
    ) {
        Text(
            text = "Developer Settings — Backend URL Override",
            style = MaterialTheme.typography.headlineMedium,
            color = MaterialTheme.colorScheme.onBackground
        )

        Spacer(modifier = Modifier.height(16.dp))

        Text(
            text = "Override the backend base URL for local testing (emulator or LAN device).",
            style = MaterialTheme.typography.bodyLarge,
            color = Color.LightGray
        )

        Spacer(modifier = Modifier.height(32.dp))

        Text(
            text = "Active URL: $currentUrl",
            style = MaterialTheme.typography.titleMedium,
            color = MaterialTheme.colorScheme.primary
        )

        Spacer(modifier = Modifier.height(16.dp))

        OutlinedTextField(
            value = inputUrl,
            onValueChange = {
                inputUrl = it
                errorMessage = null
                successMessage = null
            },
            label = { Text("Backend Base URL") },
            modifier = Modifier.fillMaxWidth(0.8f),
            singleLine = true
        )

        errorMessage?.let { err ->
            Spacer(modifier = Modifier.height(8.dp))
            Text(text = err, color = MaterialTheme.colorScheme.error)
        }

        successMessage?.let { msg ->
            Spacer(modifier = Modifier.height(8.dp))
            Text(text = msg, color = Color.Green)
        }

        Spacer(modifier = Modifier.height(24.dp))

        Row {
            Button(
                onClick = {
                    if (urlStore.setUrl(inputUrl)) {
                        successMessage = "URL updated successfully!"
                        errorMessage = null
                    } else {
                        errorMessage = "Invalid URL. Must start with http:// or https://"
                        successMessage = null
                    }
                }
            ) {
                Text("Save URL")
            }

            Spacer(modifier = Modifier.width(16.dp))

            Button(
                onClick = {
                    urlStore.resetToDefault()
                    inputUrl = urlStore.getUrl()
                    successMessage = "Reset to default: ${urlStore.getUrl()}"
                    errorMessage = null
                }
            ) {
                Text("Reset Default")
            }

            Spacer(modifier = Modifier.width(16.dp))

            Button(onClick = onBack) {
                Text("Back")
            }
        }
    }
}
