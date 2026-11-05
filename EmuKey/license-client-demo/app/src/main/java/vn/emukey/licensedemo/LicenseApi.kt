package vn.emukey.licensedemo

import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URI
import java.time.Instant

/** Developer-only client of the provider whitelist API. */
class LicenseApi(endpoint: String) {
    val endpoint: String = normalize(endpoint)

    fun verify(licenseKey: String, productId: String): DemoAccess {
        require(licenseKey.isNotBlank() && productId.isNotBlank()) { "Nhập mã bản quyền và mã sản phẩm." }
        val connection = URI("$endpoint/verify").toURL().openConnection() as HttpURLConnection
        try {
            connection.requestMethod = "POST"
            connection.connectTimeout = 8_000
            connection.readTimeout = 8_000
            connection.instanceFollowRedirects = false
            connection.doOutput = true
            connection.setRequestProperty("Content-Type", "application/json")
            val input = JSONObject().put("licenseKey", licenseKey.trim()).put("productId", productId.trim())
            connection.outputStream.use { it.write(input.toString().toByteArray(Charsets.UTF_8)) }
            if (connection.responseCode != 200) throw LicenseRequestException(connection.responseCode)
            val body = connection.inputStream.bufferedReader(Charsets.UTF_8).use { reader ->
                val text = StringBuilder()
                val buffer = CharArray(1024)
                var count = reader.read(buffer)
                while (count != -1) {
                    require(text.length + count <= 65_536) { "Phản hồi máy chủ quá lớn." }
                    text.append(buffer, 0, count)
                    count = reader.read(buffer)
                }
                text.toString()
            }
            val response = JSONObject(body)
            if (!response.optBoolean("valid", false)) return DemoAccess(false, false, Instant.EPOCH)
            return DemoAccess(true, response.optJSONObject("rights")?.optBoolean("desktop", false) ?: false,
                Instant.parse(response.getString("expiresAt")))
        } finally { connection.disconnect() }
    }

    companion object {
        fun normalize(value: String): String {
            val normalized = value.trim().trimEnd('/')
            val uri = URI(normalized)
            require(uri.host != null && uri.userInfo == null && uri.query == null && uri.fragment == null) { "URL không được chứa thông tin đăng nhập hoặc tham số." }
            val localDebug = BuildConfig.DEBUG && uri.scheme == "http" && uri.host in setOf("10.0.2.2", "localhost", "127.0.0.1")
            require(uri.scheme == "https" || localDebug) { "Máy chủ phải dùng HTTPS. Bản debug chỉ cho phép HTTP tới máy phát triển." }
            return normalized
        }
    }
}

class LicenseRequestException(val status: Int) : Exception("Máy chủ nhà cung cấp chưa thể kiểm tra bản quyền.")
