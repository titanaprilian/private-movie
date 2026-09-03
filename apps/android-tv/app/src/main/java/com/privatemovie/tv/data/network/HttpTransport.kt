package com.privatemovie.tv.data.network

import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.io.BufferedReader
import java.io.InputStreamReader
import java.net.HttpURLConnection
import java.net.URL

data class HttpResponse(
    val statusCode: Int,
    val body: String
)

interface HttpTransport {
    suspend fun get(urlString: String): HttpResponse
}

class DefaultHttpTransport(
    private val connectTimeoutMs: Int = 10000,
    private val readTimeoutMs: Int = 10000
) : HttpTransport {
    override suspend fun get(urlString: String): HttpResponse = withContext(Dispatchers.IO) {
        val url = URL(urlString)
        val connection = url.openConnection() as HttpURLConnection
        try {
            connection.requestMethod = "GET"
            connection.connectTimeout = connectTimeoutMs
            connection.readTimeout = readTimeoutMs
            connection.setRequestProperty("Accept", "application/json")

            val statusCode = connection.responseCode
            val stream = if (statusCode in 200..299) {
                connection.inputStream
            } else {
                connection.errorStream
            }

            val body = stream?.use { inputStream ->
                BufferedReader(InputStreamReader(inputStream)).use { reader ->
                    reader.readText()
                }
            } ?: ""

            HttpResponse(statusCode = statusCode, body = body)
        } finally {
            connection.disconnect()
        }
    }
}
