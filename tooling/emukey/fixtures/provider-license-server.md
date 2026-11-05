# Máy chủ nhà cung cấp mẫu — chỉ kiểm thử tích hợp

Fixture này nằm ngoài sản phẩm và ngoài kiến trúc đồ án. Nó dùng PostgreSQL riêng, nhận snapshot qua HTTP loopback, lưu key hash/receipt trước ACK và kiểm tra key theo sản phẩm, trạng thái, thời hạn. Không đọc database EmuKey và không được trỏ `PROVIDER_DATABASE_URL` vào database nghiệp vụ.

Từ workspace root, đặt `PROVIDER_DATABASE_URL`, `PROVIDER_RECEIVER_TOKEN` (ít nhất 24 ký tự), `PROVIDER_RECEIVER_ID` (UUID provider thực trong môi trường test) và `PROVIDER_RECEIVER_PORT` (mặc định 4123), sau đó:

```powershell
node tooling/emukey/fixtures/provider-license-server.mjs
```

Backend test/development cần `PROVIDER_TEST_ORIGIN=http://127.0.0.1:4123`. Trong tab Tích hợp của provider, lưu URL `http://127.0.0.1:4123/receive` và token cùng giá trị phía receiver, probe rồi bật. Ngoại lệ HTTP chỉ dành đúng origin loopback đó; production từ chối cấu hình ngoại lệ này.

Sản phẩm mẫu gọi `POST /verify` với JSON `{licenseKey,productId}`; không gửi token máy chủ vào client. Key không tồn tại hoặc sai sản phẩm trả `{valid:false}`; key đã nhận còn hiệu lực trả `{valid:true,expiresAt,rights}`. Receiver này không cung cấp device quota hay bảo vệ chống sửa ứng dụng.

Integration test gọi factory `createProviderLicenseServer` để tạo port tạm và database tách biệt; có fault injection `DROP_AFTER_COMMIT`, `HOLD_AFTER_COMMIT` và `MALFORMED_RECEIPT` chỉ qua object trong tiến trình kiểm thử, không mở API điều khiển qua mạng. `HOLD_AFTER_COMMIT` giữ phản hồi sau khi receiver commit, dùng để kill worker thật trước khi EmuKey ghi ACK. Receiver phải đóng và DB test phải được dọn bởi test harness.

Đây không phải dịch vụ nhận key sẵn sàng production: chưa có onboarding product allowlist, rate limit `/verify`, monitoring và cơ chế vận hành nhiều máy chủ. Kết quả fixture chỉ chứng minh hợp đồng tích hợp và lỗi được xử lý ở boundary.
