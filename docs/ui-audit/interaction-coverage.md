# Đối soát tương tác và giới hạn nghiệm thu web

Ảnh normal chỉ chứng minh màn đã render. Bảng dưới ghi kiểm thử hành vi riêng; dữ liệu giả lập được đánh dấu CONTROLLED_FIXTURE, không thay bằng chứng tích hợp thật.

| Nhóm | Bằng chứng trong lượt này | Kết luận và giới hạn |
| --- | --- | --- |
| Điều hướng / keyboard | `ui-audit.spec.ts`, `workspace-navigation.spec.ts`, `system-admin.spec.ts`: menu mobile, Tab/Shift+Tab/Escape, dropdown tài khoản, skip link, deep link, history/reload, active view | Browser thật với fixture; phiên customer sau reload có thêm REAL_API. Native back gesture hoãn. |
| Catalog / so sánh | UI regression ảnh lỗi, khoảng trống tablet, error/retry; buyer recovery kiểm tra search và history; unit bộ catalog/so sánh trong 262 ca | Có dữ liệu thật ở capture. Không dùng thời gian capture làm số đo hiệu năng tải. |
| Auth / hồ sơ | Các chế độ auth có ảnh ba viewport; system-admin kiểm tra lời mời, dirty/save failure/password; buyer recovery kiểm tra password/session header; unit auth | Không gửi email thật. Liên kết reset/invite thiếu token được kiểm tra như trạng thái thiếu token; thành công lời mời dùng fixture. Screen reader thực chưa kiểm tra. |
| Mua hàng | `purchase-modal-flow.spec.ts`: 320/390/768/1024/1440px, giữ lựa chọn, điều khoản, submit, hủy, đổi gói, đơn hết hạn, đã trả ở tab khác | CONTROLLED_FIXTURE. Không tạo giao dịch SePay mới hoặc coi redirect là bằng chứng nhận tiền. |
| Thanh toán / gia hạn / key | `payment-status-flow.spec.ts`, `provider-key-handoff.spec.ts`, `buyer-ui-recovery.spec.ts`: retry cần backend đồng ý, renewal chờ command riêng, pending/review/reorg, không nhận lại key sau reload, lưu key, quay về đơn hàng | CONTROLLED_FIXTURE; key trong test là dữ liệu giả. Chưa chạy một hành trình mua và gia hạn xuyên worker/blockchain/provider receiver mới trong audit này. |
| Nhà cung cấp | `provider-dashboard.spec.ts`, `provider-licenses.spec.ts`: metric/filter/history, Drawer keyboard, xác nhận lifecycle, reason retry, projection; provider integration/handoff: config/save/test/enable/reload, credential không hiện lại | Các mutation dùng fixture. REAL_API xác nhận provider A đọc tài liệu B nhận 404. Không gọi receiver thật từ nút test cấu hình trong đợt audit. |
| Support | `workspace-navigation.spec.ts`: gửi lỗi giữ draft, claim generation, hai tab; UI regression: hàng đợi trống, mở panel bàn giao; unit internal consoles: 409, heartbeat/retry | Không thêm quyền gửi lại cho nhân viên. Không phát thông báo tới người thật. Các tình huống lease hiếm dùng fixture. |
| Quản trị | `system-admin.spec.ts`: bảng/Drawer/mobile, mời provider, khóa/mở, rà soát thanh toán, đối soát lỗi/retry, công bố tài liệu, profile | 19 ca chạy lại đạt sau cập nhật fixture theo DTO thật. REAL_API: customer/provider/support đọc danh sách user nhận 403; admin nhận 200. Không khóa tài khoản thật hoặc chạy reconciliation mutation thật. |
| Trạng thái dữ liệu | Runner mở rộng: normal, empty, lỗi GET 503, giữ GET để chụp loading | Empty chỉ áp dụng màn có danh sách. Profile không có GET riêng nên không có empty/error GET; lỗi submit được test riêng. Verify là mutation theo mã; không gán GET 503 cho trạng thái chưa tra cứu. Checkout chưa chọn gói là trạng thái riêng không có GET để giữ. |
| Accessibility | Axe WCAG tags theo từng role/view/viewport, test focus/skip/contrast/target size, review ảnh | Carousel đã kiểm tra thêm ở 320×800 với reduced motion: không tràn trang, Home/End đổi trang, transition track/dot = 0s. Không đồng nghĩa chứng nhận WCAG. Các nhóm incomplete, screen reader, zoom 200% và reduced-motion toàn ứng dụng còn cần kiểm tra thủ công riêng. |

## Lịch sử sửa test

Lượt browser mở rộng đầu: 105 đạt, 7 lỗi trong system-admin. Đối chiếu source xác nhận ba fixture/expectation cũ: request health được dùng tại view blockchain; account trigger không còn nhãn role `small`; ReviewPaymentDto nhận `resolution=NO_ACTION` và trả CLOSED_NO_ACTION. Chạy lại toàn bộ 19 ca system-admin đạt. Báo cáo gốc được giữ, kết quả mới thay suite tương ứng, không cộng trùng.

## Phần chưa đủ để đóng toàn bộ kế hoạch

- Native hoãn theo yêu cầu người dùng; Kotlin demo ngoài phạm vi.
- Mua/gia hạn mới qua SePay → IPN → worker → blockchain → receiver thật chưa nghiệm thu trong lượt UI này.
- Chưa chạy screen reader hoặc mọi kết hợp zoom/font scaling/reduced motion; axe incomplete không được tự chuyển PASS.
- Ảnh ba viewport và test hiện có không bao phủ mọi biến thể tài khoản BUSINESS/INDIVIDUAL/STUDENT, mọi độ dài dữ liệu hoặc mọi kết hợp filter cùng lúc.
- Chỉ review contact sheet không đủ nghiệm thu chi tiết toàn bộ ảnh full-page. Review lỗi tập trung và cặp trước/sau được ghi trong issues; các ảnh còn lại giữ trạng thái CAPTURED.
