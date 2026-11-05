package vn.emukey.licensedemo

import android.content.Context
import android.security.keystore.KeyGenParameterSpec
import android.security.keystore.KeyProperties
import android.util.Base64
import org.json.JSONObject
import org.bouncycastle.asn1.sec.SECNamedCurves
import org.web3j.utils.Numeric
import java.math.BigInteger
import java.security.KeyStore
import java.security.SecureRandom
import java.util.UUID
import javax.crypto.Cipher
import javax.crypto.KeyGenerator
import javax.crypto.SecretKey
import javax.crypto.spec.GCMParameterSpec

/** Android Keystore wraps the software secp256k1 key; secp256k1 is not a Keystore curve. */
class DeviceIdentity(context: Context) {
    private val preferences = context.getSharedPreferences("emukey_device", Context.MODE_PRIVATE)
    private val alias = "emukey_installation_wrap"
    private val keyStore = KeyStore.getInstance("AndroidKeyStore").apply { load(null) }

    private fun wrappingKey(): SecretKey {
        (keyStore.getKey(alias, null) as? SecretKey)?.let { return it }
        return KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, "AndroidKeyStore").apply {
            init(KeyGenParameterSpec.Builder(alias, KeyProperties.PURPOSE_ENCRYPT or KeyProperties.PURPOSE_DECRYPT)
                .setBlockModes(KeyProperties.BLOCK_MODE_GCM).setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE).build())
        }.generateKey()
    }

    private fun read(): JSONObject {
        val stored = preferences.getString("identity", null)
        if (stored == null) {
            var scalar: BigInteger
            do { scalar = BigInteger(256, SecureRandom()) } while (scalar.signum() <= 0 || scalar >= SECNamedCurves.getByName("secp256k1").n)
            return JSONObject().put("privateKey", Numeric.toHexStringNoPrefixZeroPadded(scalar, 64))
                .put("deviceRef", UUID.randomUUID().toString()).also { write(it) }
        }
        val envelope = JSONObject(stored)
        val cipher = Cipher.getInstance("AES/GCM/NoPadding")
        cipher.init(Cipher.DECRYPT_MODE, wrappingKey(), GCMParameterSpec(128, Base64.decode(envelope.getString("iv"), Base64.NO_WRAP)))
        return JSONObject(String(cipher.doFinal(Base64.decode(envelope.getString("ciphertext"), Base64.NO_WRAP)), Charsets.UTF_8))
    }

    private fun write(identity: JSONObject) {
        val cipher = Cipher.getInstance("AES/GCM/NoPadding")
        cipher.init(Cipher.ENCRYPT_MODE, wrappingKey())
        val ciphertext = cipher.doFinal(identity.toString().toByteArray(Charsets.UTF_8))
        val stored = JSONObject().put("iv", Base64.encodeToString(cipher.iv, Base64.NO_WRAP))
            .put("ciphertext", Base64.encodeToString(ciphertext, Base64.NO_WRAP))
        check(preferences.edit().putString("identity", stored.toString()).commit())
    }

    fun proof(): DeviceProof = DeviceProof(read().getString("privateKey"))
    fun deviceRef(): String = read().getString("deviceRef")
    fun binding(api: String): Pair<String, String>? {
        val state = read()
        return if (state.optString("api") == api && state.has("licenseId") && state.has("deviceId"))
            state.getString("licenseId") to state.getString("deviceId") else null
    }
    fun bind(api: String, licenseId: String, deviceId: String) {
        write(read().put("api", api).put("licenseId", licenseId).put("deviceId", deviceId))
    }
    fun forgetBinding() {
        val state = read()
        state.remove("api"); state.remove("licenseId"); state.remove("deviceId")
        write(state)
    }
}
