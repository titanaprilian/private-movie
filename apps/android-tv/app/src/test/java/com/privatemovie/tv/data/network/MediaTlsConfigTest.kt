package com.privatemovie.tv.data.network

import org.junit.Assert.assertNotNull
import org.junit.Assert.assertTrue
import org.junit.Assert.fail
import org.junit.Test
import java.io.ByteArrayInputStream
import java.net.Socket
import java.security.cert.CertificateException
import java.security.cert.CertificateFactory
import java.security.cert.X509Certificate
import javax.net.ssl.HttpsURLConnection
import javax.net.ssl.SSLEngine
import javax.net.ssl.X509ExtendedTrustManager
import javax.net.ssl.X509TrustManager

class MediaTlsConfigTest {

    private val mockGoDaddyCertPem = """
        -----BEGIN CERTIFICATE-----
        MIIDpzCCAo+gAwIBAgIUc/QUX3p7H7n3bZIkcScp3Hq/R4EwDQYJKoZIhvcNAQEL
        BQAwYzExMC8GA1UECwwoR28gRGFkZHkgQ2xhc3MgMiBDZXJ0aWZpY2F0aW9uIEF1
        dGhvcml0eTEhMB8GA1UECgwYVGhlIEdvIERhZGR5IEdyb3VwLCBJbmMuMQswCQYD
        VQQGEwJVUzAeFw0yNjA5MTgwMjUzMzVaFw0yNzA5MTgwMjUzMzVaMGMxMTAvBgNV
        BAsMKEdvIERhZGR5IENsYXNzIDIgQ2VydGlmaWNhdGlvbiBBdXRob3JpdHkxITAf
        BgNVBAoMGFRoZSBHbyBEYWRkeSBHcm91cCwgSW5jLjELMAkGA1UEBhMCVVMwggEi
        MA0GCSqGSIb3DQEBAQUAA4IBDwAwggEKAoIBAQCjQrNYZSbqPwxp4cIWiYycfXTP
        PUOxZqokLhyGDa37AgWqYC3GrsJdElwsbrasz19wZ/JGTz70YoMVijCc17CoW+8K
        NBAebELQnkf5vS93ESzbSesWIQb+U+nLuOqd2AUc82Qu+37UKpyLu5d5Kipdbjgm
        TLLK2me5zfZQB45D4pz7qr1HL8c7NDJVJ+haAIvIYEJsJWPYdrqd5eU7t1ZEJ1lP
        5YIY4gXdMWeolGVLPrGlpV5QN/KBUpc51u2JyIBYHP3hsdmhpuxYCcn4ky5Aw7aY
        hrAg4R+gARZCsmc2iin89bhX3OQwHE98ysYShbsMegWMdV4JIrn3SQBNflXJAgMB
        AAGjUzBRMB0GA1UdDgQWBBSAwUK93HmYvYR8o7ZrxyoHmPwg5DAfBgNVHSMEGDAW
        gBSAwUK93HmYvYR8o7ZrxyoHmPwg5DAPBgNVHRMBAf8EBTADAQH/MA0GCSqGSIb3
        DQEBCwUAA4IBAQBE0G7Kf6/JbDMI+cjQcMY2ceGx/fys4az+rdPSUaPUXF5zjoG8
        IS6Zfu6IBHKlzBfZuFQAg9Hp7JS6FygFpFbYnR6wnTgLRIkaUr1q3W11vF2822JM
        WizIuvXuwwTR0zDcAMofrX5ycrVVIIYrIONEeS/+3yrojYASYSsquFQ+0irQ33FV
        3Pr/xyAztJMqOMQIPvzCSc2/fM/Zs7OOkCGLYTwn59cp47O8gEv0YLoII72zLfen
        3/io6j0SILEkDdk/YDP3ULo59IPafo12KdsWuRQn0mrRfdQMv0YJQzNq88bo4Xu0
        YW1eAAvokS88f9L0iseJy66dtF2Vb5dG8Zc8
        -----END CERTIFICATE-----
    """.trimIndent()

    private fun parseCert(pem: String): X509Certificate {
        val cf = CertificateFactory.getInstance("X.509")
        return cf.generateCertificate(ByteArrayInputStream(pem.toByteArray())) as X509Certificate
    }

    @Test
    fun `configure initializes default SSL socket factory without crashing`() {
        MediaTlsConfig.configure()
        assertNotNull(HttpsURLConnection.getDefaultSSLSocketFactory())
    }

    @Test
    fun `legacyCompatibleTrustManager allows insecure hash function certificate exceptions`() {
        val mockSystemTrustManager = object : X509TrustManager {
            override fun checkClientTrusted(chain: Array<out X509Certificate>?, authType: String?) {}
            override fun checkServerTrusted(chain: Array<out X509Certificate>?, authType: String?) {
                throw CertificateException("Signature uses an insecure hash function: 1.2.840.113549.1.1.5")
            }
            override fun getAcceptedIssuers(): Array<X509Certificate> = emptyArray()
        }

        val wrapper = MediaTlsConfig.createLegacyCompatibleTrustManager(mockSystemTrustManager)
        try {
            wrapper.checkServerTrusted(emptyArray(), "RSA")
            assertTrue(true)
        } catch (e: CertificateException) {
            fail("Expected legacy SHA-1 insecure hash exception to be tolerated, but caught: ${e.message}")
        }
    }

    @Test
    fun `legacyCompatibleTrustManager allows chains containing Go Daddy Class 2 root`() {
        val cert = parseCert(mockGoDaddyCertPem)

        val mockSystemTrustManager = object : X509TrustManager {
            override fun checkClientTrusted(chain: Array<out X509Certificate>?, authType: String?) {}
            override fun checkServerTrusted(chain: Array<out X509Certificate>?, authType: String?) {
                throw CertificateException("Certificate not trusted by system")
            }
            override fun getAcceptedIssuers(): Array<X509Certificate> = emptyArray()
        }

        val wrapper = MediaTlsConfig.createLegacyCompatibleTrustManager(mockSystemTrustManager)
        try {
            wrapper.checkServerTrusted(arrayOf(cert), "RSA")
            assertTrue(true)
        } catch (e: CertificateException) {
            fail("Expected Go Daddy Class 2 certificate exception to be tolerated, but caught: ${e.message}")
        }
    }

    @Test
    fun `legacyCompatibleTrustManager forwards socket and engine calls to extended delegate`() {
        var socketChecked = false
        var engineChecked = false

        val mockExtendedTrustManager = object : X509ExtendedTrustManager() {
            override fun checkClientTrusted(chain: Array<out X509Certificate>?, authType: String?) {}
            override fun checkServerTrusted(chain: Array<out X509Certificate>?, authType: String?) {}
            override fun getAcceptedIssuers(): Array<X509Certificate> = emptyArray()
            override fun checkClientTrusted(chain: Array<out X509Certificate>?, authType: String?, socket: Socket?) {}
            override fun checkClientTrusted(chain: Array<out X509Certificate>?, authType: String?, engine: SSLEngine?) {}

            override fun checkServerTrusted(chain: Array<out X509Certificate>?, authType: String?, socket: Socket?) {
                socketChecked = true
            }

            override fun checkServerTrusted(chain: Array<out X509Certificate>?, authType: String?, engine: SSLEngine?) {
                engineChecked = true
            }
        }

        val wrapper = MediaTlsConfig.createLegacyCompatibleTrustManager(mockExtendedTrustManager)
        wrapper.checkServerTrusted(emptyArray(), "RSA", null as Socket?)
        wrapper.checkServerTrusted(emptyArray(), "RSA", null as SSLEngine?)

        assertTrue(socketChecked)
        assertTrue(engineChecked)
    }

    @Test
    fun `legacyCompatibleTrustManager rethrows standard untrusted certificate exceptions`() {
        val mockSystemTrustManager = object : X509TrustManager {
            override fun checkClientTrusted(chain: Array<out X509Certificate>?, authType: String?) {}
            override fun checkServerTrusted(chain: Array<out X509Certificate>?, authType: String?) {
                throw CertificateException("Untrusted certificate authority: self-signed")
            }
            override fun getAcceptedIssuers(): Array<X509Certificate> = emptyArray()
        }

        val wrapper = MediaTlsConfig.createLegacyCompatibleTrustManager(mockSystemTrustManager)
        try {
            wrapper.checkServerTrusted(emptyArray(), "RSA")
            fail("Expected untrusted certificate exception to be rethrown")
        } catch (e: CertificateException) {
            assertTrue(e.message?.contains("Untrusted certificate authority") == true)
        }
    }
}
