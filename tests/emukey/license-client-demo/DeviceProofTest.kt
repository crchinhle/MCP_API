package vn.emukey.licensedemo

import org.junit.Assert.*
import org.junit.Test
import java.time.Instant

class DeviceProofTest {
    @Test fun `provider API base does not require an EmuKey API path`() {
        assertEquals("https://provider.example", LicenseApi.normalize("https://provider.example/"))
        assertEquals("http://10.0.2.2:4123", LicenseApi.normalize("http://10.0.2.2:4123"))
    }
    @Test fun `EIP-191 UTF-8 signature matches the backend viem vector`() {
        val proof = DeviceProof("22".repeat(32))
        assertEquals("0x1563915e194d8cfba1943570603f7606a3115508", proof.address)
        assertEquals("0x50cdbeae6799698bfca99dc173960674ed9c270d2ef4b3fad8f64f2822a7b3ae61eddd097644e91dce04dc44596283a9cdf87088e777c8f1a54ab7cfb856b6991b", proof.sign("EmuKey challenge: kiểm tra 123"))
    }

    @Test fun `report export requires verified current rights and an unexpired response`() {
        val now = Instant.parse("2026-11-01T00:00:00Z")
        assertTrue(DemoAccess(true, true, now.plusSeconds(30)).canExport(now))
        assertFalse(DemoAccess(false, true, now.plusSeconds(30)).canExport(now))
        assertFalse(DemoAccess(true, false, now.plusSeconds(30)).canExport(now))
        assertFalse(DemoAccess(true, true, now).canExport(now))
        assertFalse(DemoAccess(true, true, now.minusSeconds(1)).canExport(now))
    }
}
