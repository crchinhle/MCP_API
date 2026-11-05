# Công cụ demo ngoài phạm vi đồ án

Không đưa ứng dụng này vào sơ đồ hoặc thuyết minh sản phẩm EmuKey. Màn hình hiện tại kiểm tra key trực tiếp qua máy chủ nhà cung cấp; không kích hoạt thiết bị hoặc xin entitlement tại EmuKey.

## Luồng demo hiện tại

1. Chạy receiver độc lập theo `tooling/emukey/fixtures/provider-license-server.md` trong workspace kiểm thử, dùng database riêng.
2. Cấu hình provider trên EmuKey, mua/phát hành và chờ bàn giao thành công.
3. Trong app debug emulator, nhập URL `http://10.0.2.2:4123`, product UUID và key đã nhận. Nhấn **Kiểm tra key**. App gọi `POST /verify` của receiver, không có token máy chủ trong client.
4. Thử key tự bịa, sai sản phẩm và key sau thu hồi. Mỗi lần kiểm tra cần mạng; key chỉ ở memory và được xóa khi app dừng.

Build/test bằng JDK 17 và Android SDK 36:

```powershell
./gradlew.bat --offline -PemukeyTestSources=D:/TLHT/KLTN/UY/tests/emukey/license-client-demo testDebugUnitTest assembleDebug
```

Các helper EIP-191 cũ còn được giữ cho regression kỹ thuật legacy, không được màn hình demo hiện tại gọi. Phần tham chiếu dưới đây mô tả quy trình cũ, không dùng để thử license thuộc mode PROVIDER_HANDOFF.

Ca integration Android legacy chỉ chạy khi chỉ định cả emulator qua `EMUKEY_ANDROID_SERIAL` và đường dẫn APK cũ qua `EMUKEY_LEGACY_ANDROID_APK`. Không dùng APK hiện tại cho ca activation/CSV này; việc build thành công chưa chứng minh demo đã chạy trên emulator với receiver.

## Tham chiếu lịch sử: client kích hoạt thiết bị trước cutover

`license-client-demo/` là ứng dụng Android riêng, không phải mobile quản lý. Cần JDK 17, Android SDK 36/build tools 36.0.0 và biến `ANDROID_HOME`.

```sh
cd license-client-demo
bash ./gradlew :app:lintDebug :app:assembleDebug
```

Windows dùng `gradlew.bat`. APK debug ở `app/build/outputs/apk/debug/app-debug.apk` (không commit). Trong app: lưu URL API `/api/v1`, nhập key, kích hoạt, kiểm tra quyền, xuất báo cáo CSV. Plan phải có entitlement `desktop: true`. App xác minh quyền trước khi mở hộp chọn nơi lưu và xác minh lại sau khi chọn, ngay trước khi ghi; mất mạng, hết hạn, suspend/revoke hoặc thiết bị bị thu hồi sẽ chặn xuất. Thời gian hiệu lực hiển thị là của phản hồi entitlement, không phải ngày hết hạn gói. Demo không có offline grace và không phải giải pháp chống sửa binary.

Bouncy Castle `bcprov-jdk18on` 1.86 được pin riêng; Gradle distribution có SHA-256 từ kênh phát hành chính thức. Tra cứu OSV ngày 01/11/2026 không trả advisory khớp cho ba dependency crypto đã chọn; vẫn cần kiểm tra lại khi phát hành. Kiểm thử chữ ký đối chiếu viem và Android lint/build đã chạy trong workspace; nghiệm thu thành công xuyên suốt dịch vụ thật là gate riêng.

Khóa thiết bị secp256k1 được bọc bằng AES-GCM trong Android Keystore, không gửi private key lên server; activation key/token không lưu lâu dài. Tắt backup/transfer dữ liệu khóa; đổi máy cần thu hồi thiết bị cũ. Bản debug chỉ cho phép HTTP tới `10.0.2.2`, `localhost`, `127.0.0.1`; bản release yêu cầu HTTPS. Web3j crypto/utils 4.12.3 (Apache-2.0) dùng riêng phần EIP-191, không kéo native KZG/wallet/RPC; đây là bản bytecode Java 17 đã kiểm tra. Compose BOM 2025.08.01 tương thích SDK 36 đã chọn. Đối chiếu [Web3j signing](https://docs.web3j.io/4.12.3/advanced/message_signing/), [Keystore](https://developer.android.com/privacy-and-security/keystore), [AGP 9.4](https://developer.android.com/build/releases/agp-9-4-0-release-notes).
