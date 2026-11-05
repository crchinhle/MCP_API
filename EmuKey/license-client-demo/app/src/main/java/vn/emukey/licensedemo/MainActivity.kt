package vn.emukey.licensedemo

import android.os.Bundle
import android.view.WindowManager
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.unit.dp
import java.time.Instant
import java.util.concurrent.Executors

/** Test utility outside the thesis product boundary. */
class MainActivity : ComponentActivity() {
    private val work = Executors.newSingleThreadExecutor()
    private var busy by mutableStateOf(false)
    private var status by mutableStateOf("Nhập mã đã bàn giao để kiểm tra tại máy chủ nhà cung cấp.")
    private var endpoint by mutableStateOf(if (BuildConfig.DEBUG) "http://10.0.2.2:4123" else "https://provider.example")
    private var productId by mutableStateOf("")
    private var licenseKey by mutableStateOf("")

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        window.addFlags(WindowManager.LayoutParams.FLAG_SECURE)
        setContent {
            MaterialTheme {
                Surface(Modifier.fillMaxSize()) {
                    Column(Modifier.fillMaxSize().windowInsetsPadding(WindowInsets.safeDrawing).padding(24.dp).verticalScroll(rememberScrollState()), verticalArrangement = Arrangement.spacedBy(16.dp)) {
                        Text("Kiểm tra key — công cụ demo", style = MaterialTheme.typography.headlineSmall)
                        Text("Kết nối máy chủ nhà cung cấp. Công cụ này nằm ngoài phạm vi sản phẩm EmuKey.")
                        OutlinedTextField(endpoint, { endpoint = it; status = "Chưa kiểm tra lại." }, enabled = !busy, label = { Text("URL máy chủ nhà cung cấp") }, modifier = Modifier.fillMaxWidth(), singleLine = true)
                        OutlinedTextField(productId, { productId = it; status = "Chưa kiểm tra lại." }, enabled = !busy, label = { Text("Mã sản phẩm") }, modifier = Modifier.fillMaxWidth(), singleLine = true)
                        OutlinedTextField(licenseKey, { licenseKey = it; status = "Chưa kiểm tra lại." }, enabled = !busy, label = { Text("Mã bản quyền") }, visualTransformation = PasswordVisualTransformation(), modifier = Modifier.fillMaxWidth(), singleLine = true)
                        Button(onClick = {
                            val key = licenseKey.trim()
                            val product = productId.trim()
                            val server = endpoint
                            busy = true
                            work.execute {
                                val result = try {
                                    val access = LicenseApi(server).verify(key, product)
                                    if (access.verified && access.expiresAt.isAfter(Instant.now())) "Key hợp lệ tại nhà cung cấp. Hết hạn: ${access.expiresAt}"
                                    else "Key không hợp lệ cho sản phẩm này, đã hết hạn hoặc không còn được phép sử dụng."
                                } catch (_: Exception) { "Không thể kiểm tra trực tuyến. Kiểm tra kết nối và URL; chưa xác nhận key hợp lệ." }
                                runOnUiThread { if (!isDestroyed) { status = result; busy = false } }
                            }
                        }, enabled = !busy && licenseKey.isNotBlank() && productId.isNotBlank()) { Text("Kiểm tra key") }
                        if (busy) LinearProgressIndicator(Modifier.fillMaxWidth())
                        Text(status)
                        Text("Key chỉ giữ trong bộ nhớ của lần mở ứng dụng. Không có chế độ xác thực ngoại tuyến.")
                    }
                }
            }
        }
    }
    override fun onStop() { licenseKey = ""; status = "Chưa kiểm tra lại."; super.onStop() }
    override fun onDestroy() { work.shutdown(); super.onDestroy() }
}
