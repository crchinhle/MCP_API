# Tiến độ audit UI/UX EmuKey

## Review bổ sung popup — 06/11/2026

Đã kiểm kê 41 vị trí overlay trong frontend và mở các nhóm Modal, Drawer, Dropdown, Popover, Popconfirm, menu dialog và xác nhận bỏ thay đổi. Có 130 capture tổng quát ở ba viewport và 59 quan sát bổ sung, dùng CONTROLLED_FIXTURE; đây là số quan sát, không phải số test đạt.

Sau yêu cầu “Sửa luôn đi”, **đã sửa và kiểm chứng 7 lỗi cùng cải thiện focus OV-008**, chi tiết tại [overlay-review.md](overlay-review.md); inventory và bằng chứng theo từng lỗi tại [overlay-review.json](overlay-review.json). Đã xử lý contrast menu/placeholder, chặn AI khi menu mở, vùng cuộn tài liệu dùng bàn phím, ngắt dòng trích dẫn, thông báo responsive và trạng thái đóng khi retry pending. Focus chuyển bước mua hàng và vòng Tab hai chiều trong Modal thanh toán cũng đã kiểm tra lại.

Browser đạt **73 ca phân biệt**: 20 ca tập trung, 3 ca focus lồng và 50 ca hồi quy; hai ca thông báo trong bộ 20 được thay bằng lượt cuối mạnh hơn, không cộng trùng. Có 31 capture bổ sung, 12 lượt axe ở 320 không có violation tự động và 7 quan sát ảnh AI/menu/thông báo. Lint, typecheck và build đạt; cảnh báo chunk JS khoảng 1,65 MB vẫn còn.

Unit đầy đủ ban đầu đạt 261/262, exit 1: ca giữ quyền nâng cao khi lưu gói báo STACK_TRACE_ERROR sau 32,7 giây. Chạy lại toàn bộ provider-workspace.test.tsx đạt 19/19, exit 0; ca trên hoàn tất trong 22,6 giây, không sửa source/test hoặc tăng timeout giữa hai lượt. Kết quả cuối theo ca phân biệt là **262/262 đạt sau thay kết quả file bằng lượt kiểm tra lại**, không gọi lượt đầy đủ ban đầu là xanh. Giữ cả hai báo cáo tại `artifacts/ui-audit/2026-11-06-overlay-fixes/`; còn rủi ro test nhạy thời gian dưới tải. Hygiene và diff check hai repo đạt.

Các mã OV độc lập với 12 lỗi đã sửa của audit trang trước. Kết quả axe 192 tổ hợp trang nền dưới đây không bao gồm popup vừa mở, nên không dùng để kết luận overlay đã đạt accessibility. Native vẫn hoãn; test popup dùng CONTROLLED_FIXTURE, không thực hiện mutation API thật hoặc thanh toán mới. Đợt sửa không thay đổi backend, SQL, sơ đồ, dependency hoặc lockfile. Yêu cầu bàn giao Git ngày 07/11/2026: commit phần UI, test và báo cáo trên cả hai repo với nội dung `Chinh sua ui `; giữ các thay đổi ngoài phạm vi UI tại local.

Kế hoạch: `docs/emukey/plans/2026-11-06-full-application-ui-ux-audit-plan.md`. Cập nhật ngày 06/11/2026. Native hoãn theo yêu cầu “Tiếp tục web, để native sau”.

## Kết quả web

| Phần | Kết quả thực tế |
| --- | --- |
| Kiểm kê | 44 route/view từ App, menu role, chế độ auth và tab tích hợp |
| Capture | 465 tổ hợp phân biệt sau sửa: 180 normal, 12 forbidden, 51 empty, 111 lỗi GET, 111 loading; không còn ca chụp bị chặn |
| Lỗi đã sửa | 12/12 issue được ghi nhận và kiểm chứng trong issues.json; không suy rộng thành đã kiểm tra mọi biến thể UI |
| Browser UI/bàn giao | 31/31 đạt: 24 ca audit và 7 ca handoff có sẵn; dữ liệu CONTROLLED_FIXTURE |
| Browser luồng mở rộng | 112 ca phân biệt đạt sau thay suite system-admin bằng lượt chạy lại 19/19; không cộng trùng các ca handoff ở dòng trên |
| Unit đầy đủ | 49 suite, 262/262 test đạt, exit 0 |
| Unit tập trung sau sửa cuối | 78/78 ca phân biệt đạt sau thay file internal-consoles bằng lượt chạy lại 25/25; giữ báo cáo đầu 76 đạt/2 lỗi |
| API thật | 6/6 ranh giới quyền/ownership đạt: user admin, đơn khác customer, tài liệu khác provider |
| Browser phiên thật | Customer reload tại đơn hàng vẫn giữ phiên và đúng màn |
| Accessibility | Axe trên 192 tổ hợp normal/403, 0 violation tự động; 266 nhóm incomplete cần đánh giá thủ công |
| Build và kiểm tra tĩnh | Lint, typecheck, OpenAPI check và build exit 0; build còn cảnh báo chunk JS khoảng 1,65 MB, gzip khoảng 502 KB |
| Hygiene | Workspace guard và diff check hai repo đạt; không có dependency/lockfile mới |

Các thay đổi tập trung vào menu/focus/skip link, trạng thái điều hướng, heading người mua, ảnh lỗi, bố cục so sánh và hàng đợi mobile, tương phản/vùng chạm, form tích hợp, trạng thái rỗng/lỗi bàn giao. Tái sử dụng PageHeader, StatusChip, PageLoading, Empty và token hiện có. Không thay schema, API hoặc quy tắc nghiệp vụ trong đợt UI này.

## Bằng chứng và lịch sử kiểm tra

- `artifacts/ui-audit/2026-11-06-web/`: baseline, loading/empty/error, test JSON, API boundary, session reload và ảnh fixture trước/sau.
- `2026-11-06-web-final/`: capture normal/axe toàn route. Một số lần chụp lỗi do ảnh lazy chưa tải được giữ trong manifest lịch sử.
- `2026-11-06-web-correction/`: 45 tổ hợp kiểm tra lại sau sửa cuối, gồm toàn bộ các ca lazy/contrast trước đó. Báo cáo chọn record mới nhất theo đúng role/route/state/viewport, không đếm trùng.
- Cặp ảnh trước/sau tập trung dùng cùng fixture. Frontend gốc lấy từ HEAD vì frontend sạch lúc bắt đầu; snapshot và metadata nằm ngoài source. Một số ảnh normal cũ còn skeleton chỉ là capture lịch sử, không chứng minh dữ liệu đã tải xong.
- Runner cuối đợi skeleton và text loading biến mất, tải ảnh lazy cho ảnh full-page, phân biệt GET giả lập với API thật, xác minh role sau refresh và làm mờ trường nhạy cảm.
- Lượt browser mở rộng đầu: 105 đạt/7 lỗi trong system-admin. Fixture cũ cấm health cả ở Blockchain, tìm nhãn role đã bỏ và dùng payload status thay vì DTO resolution. Đã đối chiếu source/backend, sửa test, chạy lại toàn bộ 19 ca đạt.
- Lượt unit tập trung đầu sau sửa cuối có một timeout 30 giây và một lỗi chờ nội dung; hai ca đạt khi chạy riêng, cả file internal-consoles chạy lại đạt 25/25. Không đổi timeout hay source nghiệp vụ để làm test xanh; giữ kết quả đầu và ghi nhận sự thiếu ổn định của unit dưới tải.
- Lượt unit đầu bị timeout khi chạy cùng Gradle/nhiều browser. Sau giảm tải, bộ đầy đủ đạt 262/262; không tăng timeout cấu hình để che lỗi. Cảnh báo jsdom về pseudo-element không thay cho kiểm tra contrast bằng browser thật.
- Kiểm tra carousel 320×800 với reduced motion: không tràn toàn trang, Home/End hoạt động, transition track/dot = 0s. Bằng chứng motion-results.json.
- Các ca skip navigation và empty delivery đã tái hiện FAIL trước sửa rồi đạt sau sửa; báo cáo red/green được giữ trong artifacts.

## Chưa nghiệm thu toàn bộ kế hoạch

1. Native CUSTOMER hoãn; emulator do agent mở đã tắt, build native thử nghiệm đã dừng, không sửa source native. Kotlin demo ngoài phạm vi.
2. Chưa chạy một lượt mua và gia hạn mới qua SePay → IPN → worker → blockchain → receiver thật trong audit này. Không dùng fixture hoặc bằng chứng lịch sử để đánh dấu tích hợp mới đã đạt.
3. Screen reader, zoom/font scaling và reduced motion toàn ứng dụng chưa được kiểm tra thủ công đầy đủ. Axe incomplete không tự chuyển thành PASS.
4. Ảnh ba viewport và test hiện có chưa bao phủ mọi kết hợp dữ liệu dài, loại customer, bộ lọc và modal. Chi tiết từng nhóm: interaction-coverage.md.

final-report.md và coverage.json có trạng thái PARTIALLY_VERIFIED; số ảnh không phải số màn đã nghiệm thu đầy đủ. Ưu tiên tiếp theo là nghiệm thu thủ công accessibility, sau đó mua/gia hạn sandbox xuyên hệ thống; native thực hiện ở đợt riêng theo lựa chọn của người dùng.

## Dịch vụ và bảo toàn workspace

- Đã lưu baseline Git ngoài repo, giữ các thay đổi source/schema/docs/sơ đồ có trước. Đợt UI không chỉnh KLTN.drawio.
- Node 22.21.0, pnpm 11.25.0; Redis Compose đã healthy từ trước. Không chạy initializer, seed, drop DB hoặc đổi tài khoản.
- API PID 13028 và Vite PID 6980 do agent khởi động cho audit. Không mở worker để tránh xử lý tác vụ tồn đọng ngoài phạm vi UI. Hai server giữ chạy để xem các bản sửa tại http://127.0.0.1:5173.
- 30 tài khoản demo sẵn có thuộc đủ bốn role; credential chỉ lưu trong OS temp. Log/process metadata: OS temp emukey-ui-audit; không ghi mật khẩu/token vào Git/tài liệu.
- Server frontend gốc ở cổng 5175 đã dừng. Người dùng đã yêu cầu commit/push phần UI/UX cùng tài liệu lên nhánh main của hai repo; thay đổi ngoài phạm vi audit vẫn giữ local. Không deploy.
