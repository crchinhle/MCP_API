package vn.emukey.licensedemo

import org.web3j.crypto.ECKeyPair
import org.web3j.crypto.Keys
import org.web3j.crypto.Sign
import org.web3j.utils.Numeric
import java.time.Instant

/** Dedicated installation identity; never use an Ethereum wallet holding funds. */
class DeviceProof(privateHex: String) {
    private val key = ECKeyPair.create(Numeric.toBigInt(privateHex))
    val address: String = "0x" + Keys.getAddress(key.publicKey)
    fun sign(challenge: String): String {
        val signed = Sign.signPrefixedMessage(challenge.toByteArray(Charsets.UTF_8), key)
        return Numeric.toHexString(signed.r + signed.s + signed.v)
    }
}

data class DemoAccess(val verified: Boolean, val desktop: Boolean, val expiresAt: Instant) {
    fun canExport(now: Instant): Boolean = verified && desktop && expiresAt.isAfter(now)
}
