package com.privatemovie.tv.config

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertTrue
import org.junit.Test
import org.w3c.dom.Element
import java.io.File
import javax.xml.parsers.DocumentBuilderFactory

class NetworkSecurityConfigTest {

    @Test
    fun `manifest references network security config`() {
        val manifestFile = File("src/main/AndroidManifest.xml")
        assertTrue("AndroidManifest.xml should exist", manifestFile.exists())

        val builder = DocumentBuilderFactory.newInstance().newDocumentBuilder()
        val doc = builder.parse(manifestFile)
        val applicationNodes = doc.getElementsByTagName("application")
        assertTrue("Should contain application tag", applicationNodes.length > 0)

        val applicationElement = applicationNodes.item(0) as Element
        val networkSecurityConfig = applicationElement.getAttribute("android:networkSecurityConfig")
        assertEquals("@xml/network_security_config", networkSecurityConfig)
    }

    @Test
    fun `network security config permits cleartext only for 10_0_2_2`() {
        val configFile = File("src/main/res/xml/network_security_config.xml")
        assertTrue("network_security_config.xml should exist", configFile.exists())

        val builder = DocumentBuilderFactory.newInstance().newDocumentBuilder()
        val doc = builder.parse(configFile)

        val domainConfigNodes = doc.getElementsByTagName("domain-config")
        assertEquals("Should have exactly one domain-config", 1, domainConfigNodes.length)

        val domainConfigElement = domainConfigNodes.item(0) as Element
        assertEquals("true", domainConfigElement.getAttribute("cleartextTrafficPermitted"))

        val domainNodes = domainConfigElement.getElementsByTagName("domain")
        assertEquals("Should have exactly one domain entry", 1, domainNodes.length)

        val domainElement = domainNodes.item(0) as Element
        assertEquals("10.0.2.2", domainElement.textContent.trim())

        // Check base-config or other configs do not permit general cleartext
        val baseConfigNodes = doc.getElementsByTagName("base-config")
        if (baseConfigNodes.length > 0) {
            val baseConfigElement = baseConfigNodes.item(0) as Element
            val permitted = baseConfigElement.getAttribute("cleartextTrafficPermitted")
            assertTrue(permitted.isEmpty() || permitted == "false")
        }
    }
}
