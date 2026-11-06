# Role và quyền trong phạm vi UI

Nguồn role: `EmuKey/backend/src/modules/identity-access/identity.types.ts`. Route guard: `frontend/src/presentation/app/App.tsx`; menu: `RoleShell.tsx`, `CustomerLayout.tsx`. Quyền cụ thể phải được kiểm tra thêm qua API thật, không kết luận từ menu bị ẩn.

| Ngữ cảnh | Màn hình chính | Thao tác/ranh giới |
| --- | --- | --- |
| GUEST | Home, catalog/detail/compare, verify/help, auth | Đọc catalog công khai; không xem đơn, bản quyền hoặc dữ liệu quản trị |
| CUSTOMER | Buyer và các màn public | Quản lý đơn/bản quyền/hỗ trợ của chính mình; không quản trị provider hoặc hệ thống |
| PROVIDER_ADMIN | Provider dashboard/catalog/licenses/operations/knowledge/profile | Sản phẩm, gói, dữ liệu và tích hợp thuộc provider; không dùng console quản trị hệ thống |
| SUPPORT_STAFF | Support queue/active/resolved/profile | Xem trước, nhận/trả/hoàn tất hội thoại theo lease; theo dõi bàn giao có quyền xem, không mặc định có quyền retry |
| SYSTEM_ADMIN | System console/users/payments/blockchain/knowledge/profile | Quản trị theo API; retry/đối soát chỉ với tài nguyên test trong audit |
| Native CUSTOMER | App quản lý React Native | Cùng tài khoản customer; không có màn provider/support/system native |

## Điểm cần kiểm tra bằng browser/API

- URL trực tiếp sai role trả 403, không flash dữ liệu của màn đích và không đẩy phiên hợp lệ về đăng nhập.
- Hai customer không đọc đơn/license của nhau; hai provider không đọc tài nguyên private của nhau.
- Cùng màn public khi đăng nhập có navigation/account khác guest, cần kiểm tra riêng.
- Bàn giao là dữ liệu/panel trong console hiện hữu; không tạo thêm actor hoặc quyền từ tên use case.
- Customer type BUSINESS/INDIVIDUAL/STUDENT không phải ba role khác nhau.
