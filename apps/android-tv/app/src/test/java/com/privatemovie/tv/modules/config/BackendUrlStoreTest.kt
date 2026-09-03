package com.privatemovie.tv.modules.config

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test

class BackendUrlStoreTest {

    private lateinit var store: InMemoryBackendUrlStore

    @Before
    fun setUp() {
        store = InMemoryBackendUrlStore("http://10.0.2.2:3000")
    }

    @Test
    fun `default URL is active on initialization`() {
        assertEquals("http://10.0.2.2:3000", store.getUrl())
        assertEquals("http://10.0.2.2:3000", store.activeUrl.value)
    }

    @Test
    fun `setUrl updates active URL when URL is valid`() {
        val success = store.setUrl("http://192.168.1.100:3000")
        assertTrue(success)
        assertEquals("http://192.168.1.100:3000", store.getUrl())
        assertEquals("http://192.168.1.100:3000", store.activeUrl.value)
    }

    @Test
    fun `setUrl rejects invalid URL scheme`() {
        val success = store.setUrl("ftp://192.168.1.100")
        assertFalse(success)
        assertEquals("http://10.0.2.2:3000", store.getUrl())
    }

    @Test
    fun `setUrl rejects empty or blank input`() {
        val success = store.setUrl("   ")
        assertFalse(success)
        assertEquals("http://10.0.2.2:3000", store.getUrl())
    }

    @Test
    fun `resetToDefault restores default URL`() {
        store.setUrl("https://api.my-custom-domain.com")
        assertEquals("https://api.my-custom-domain.com", store.getUrl())

        store.resetToDefault()
        assertEquals("http://10.0.2.2:3000", store.getUrl())
    }
}
