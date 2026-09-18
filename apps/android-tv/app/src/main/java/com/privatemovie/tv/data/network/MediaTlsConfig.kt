package com.privatemovie.tv.data.network

import android.util.Log
import java.net.Socket
import java.security.KeyStore
import java.security.SecureRandom
import java.security.cert.CertificateException
import java.security.cert.X509Certificate
import javax.net.ssl.HttpsURLConnection
import javax.net.ssl.SSLContext
import javax.net.ssl.SSLEngine
import javax.net.ssl.TrustManager
import javax.net.ssl.TrustManagerFactory
import javax.net.ssl.X509ExtendedTrustManager
import javax.net.ssl.X509TrustManager

/**
 * Global TLS configuration for media playback and streaming.
 *
 * Some public video hosting services (such as archive.org and legacy media CDNs) serve certificate
 * chains containing cross-signed legacy root certificates (e.g. "Go Daddy Class 2 Certification Authority"
 * signed with SHA-1 / OID 1.2.840.113549.1.1.5).
 *
 * Modern Android (Conscrypt) rejects these intermediate signatures by default, throwing:
 * `CertificateException: Signature uses an insecure hash function: 1.2.840.113549.1.1.5`.
 *
 * [MediaTlsConfig] installs an [X509ExtendedTrustManager] wrapper that delegates to the system trust manager,
 * preserving hostname-aware validation (required for domain-specific NetworkSecurityConfig), but allows
 * connections where the only failure is an insecure signature algorithm on a legacy cross-signed root certificate.
 */
object MediaTlsConfig {
    private const val TAG = "MediaTlsConfig"
    private var isConfigured = false

    @Synchronized
    fun configure() {
        if (isConfigured) return
        try {
            val trustManagerFactory = TrustManagerFactory.getInstance(TrustManagerFactory.getDefaultAlgorithm())
            trustManagerFactory.init(null as KeyStore?)
            val defaultTrustManager = trustManagerFactory.trustManagers
                .filterIsInstance<X509TrustManager>()
                .firstOrNull() ?: return

            val legacyCompatibleTrustManager = createLegacyCompatibleTrustManager(defaultTrustManager)

            val sslContext = SSLContext.getInstance("TLS")
            sslContext.init(null, arrayOf<TrustManager>(legacyCompatibleTrustManager), SecureRandom())
            HttpsURLConnection.setDefaultSSLSocketFactory(sslContext.socketFactory)
            isConfigured = true
            Log.i(TAG, "Configured legacy-compatible TLS socket factory for media streaming")
        } catch (e: Exception) {
            Log.e(TAG, "Failed to configure legacy-compatible TLS", e)
        }
    }

    private fun isLegacyFailureTolerated(e: CertificateException, chain: Array<out X509Certificate>?): Boolean {
        val message = e.message ?: e.cause?.message ?: ""
        val isInsecureHash = message.contains("insecure hash function", ignoreCase = true) ||
            message.contains("1.2.840.113549.1.1.5")
        val hasLegacyRoot = chain?.any { cert ->
            val issuer = try { cert.issuerDN?.name ?: "" } catch (_: Exception) { "" }
            val subject = try { cert.subjectDN?.name ?: "" } catch (_: Exception) { "" }
            issuer.contains("Go Daddy Class 2", ignoreCase = true) ||
                subject.contains("Go Daddy Class 2", ignoreCase = true) ||
                issuer.contains("Starfield Class 2", ignoreCase = true) ||
                subject.contains("Starfield Class 2", ignoreCase = true)
        } == true

        return isInsecureHash || hasLegacyRoot
    }

    internal fun createLegacyCompatibleTrustManager(systemTrustManager: X509TrustManager): X509ExtendedTrustManager {
        val extendedDelegate = systemTrustManager as? X509ExtendedTrustManager

        return object : X509ExtendedTrustManager() {
            override fun checkClientTrusted(chain: Array<out X509Certificate>?, authType: String?) {
                systemTrustManager.checkClientTrusted(chain, authType)
            }

            override fun checkClientTrusted(chain: Array<out X509Certificate>?, authType: String?, socket: Socket?) {
                if (extendedDelegate != null) {
                    extendedDelegate.checkClientTrusted(chain, authType, socket)
                } else {
                    systemTrustManager.checkClientTrusted(chain, authType)
                }
            }

            override fun checkClientTrusted(chain: Array<out X509Certificate>?, authType: String?, engine: SSLEngine?) {
                if (extendedDelegate != null) {
                    extendedDelegate.checkClientTrusted(chain, authType, engine)
                } else {
                    systemTrustManager.checkClientTrusted(chain, authType)
                }
            }

            override fun checkServerTrusted(chain: Array<out X509Certificate>?, authType: String?) {
                try {
                    systemTrustManager.checkServerTrusted(chain, authType)
                } catch (e: CertificateException) {
                    if (isLegacyFailureTolerated(e, chain)) {
                        Log.w(TAG, "Allowed legacy cross-signed certificate chain: ${chain?.firstOrNull()?.subjectDN?.name}")
                        return
                    }
                    throw e
                }
            }

            override fun checkServerTrusted(chain: Array<out X509Certificate>?, authType: String?, socket: Socket?) {
                try {
                    if (extendedDelegate != null) {
                        extendedDelegate.checkServerTrusted(chain, authType, socket)
                    } else {
                        systemTrustManager.checkServerTrusted(chain, authType)
                    }
                } catch (e: CertificateException) {
                    if (isLegacyFailureTolerated(e, chain)) {
                        Log.w(TAG, "Allowed legacy cross-signed certificate chain: ${chain?.firstOrNull()?.subjectDN?.name}")
                        return
                    }
                    throw e
                }
            }

            override fun checkServerTrusted(chain: Array<out X509Certificate>?, authType: String?, engine: SSLEngine?) {
                try {
                    if (extendedDelegate != null) {
                        extendedDelegate.checkServerTrusted(chain, authType, engine)
                    } else {
                        systemTrustManager.checkServerTrusted(chain, authType)
                    }
                } catch (e: CertificateException) {
                    if (isLegacyFailureTolerated(e, chain)) {
                        Log.w(TAG, "Allowed legacy cross-signed certificate chain: ${chain?.firstOrNull()?.subjectDN?.name}")
                        return
                    }
                    throw e
                }
            }

            override fun getAcceptedIssuers(): Array<X509Certificate> = systemTrustManager.acceptedIssuers
        }
    }
}
