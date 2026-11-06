# Môi trường audit

- Workspace: `MCP_API`, sản phẩm: `EmuKey/`, nested Git được giữ nguyên.
- Node: 22.21.0; pnpm: 11.25.0.
- Web: Vite tại `http://127.0.0.1:5173`; API: `http://127.0.0.1:3000/api/v1`.
- PostgreSQL: cấu hình sẵn trong backend `.env`, truy cập đọc được. Không khởi tạo lại, không seed hoặc xóa dữ liệu.
- Redis: container `emukey-redis-1` healthy trước audit.
- Worker: chưa khởi động trong bước capture chỉ đọc; kiểm thử xử lý nền cần ghi bằng chứng riêng.
- Accounts: tài khoản demo có sẵn thuộc CUSTOMER, PROVIDER_ADMIN, SUPPORT_STAFF, SYSTEM_ADMIN; mật khẩu/token không nằm trong tài liệu, ảnh hoặc manifest.
- Android: SDK/adb/emulator có sẵn; AVD `emukey-phase8-api35`. Đã hoãn native theo yêu cầu người dùng; emulator do agent mở đã tắt.
- Baseline Git: lưu ở OS temp; source/schema/docs/sơ đồ đang có thay đổi từ trước, không tính là thay đổi của audit.

## Nguyên tắc chạy

Không chạy initializer/destructive seed. Dùng cùng host cho login, cookie và browser. Chỉ thao tác tài nguyên demo; không phát email/push tới người thật. Capture dùng ba viewport web 1440×900, 768×1024 và 390×844; kiểm tra thêm 320px ở các luồng có nguy cơ tràn.

Ảnh sinh trong `artifacts/ui-audit/` đã được ignore. Browser auth state chỉ ở OS temp. Mọi trạng thái giả lập phải ghi `CONTROLLED_FIXTURE`.

## Công cụ accessibility

Chromium 151.0.7922.34 qua Playwright 1.62.1. Axe-core 4.14.0 tải từ registry chính thức, kiểm tra integrity và giữ trong OS temp; không thêm dependency hoặc đổi lockfile. Kết quả axe chỉ là kiểm tra tự động theo tag WCAG, không phải chứng nhận accessibility.
