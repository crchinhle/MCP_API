# Báo cáo UI/UX EmuKey — 2026-11-06-web

Tình trạng: đã triển khai các bản sửa UI web, kiểm chứng theo bằng chứng bên dưới; chưa nghiệm thu toàn bộ kế hoạch vì luồng tích hợp mới và kiểm tra thủ công còn thiếu. Native đã hoãn theo lựa chọn của người dùng; Kotlin demo ngoài phạm vi. Báo cáo sinh từ manifest/issues/test JSON, không dùng tỷ lệ hoàn thành ước lượng.

## Phạm vi và bằng chứng

- 44 route pattern/view được phát hiện từ source; 5 ngữ cảnh: GUEST, CUSTOMER, PROVIDER_ADMIN, SUPPORT_STAFF, SYSTEM_ADMIN.
- 465 tổ hợp role/route/state/viewport đã chụp sau sửa; 0 tổ hợp đang bị chặn trong manifest.
- Theo trạng thái: normal: 180; forbidden: 12; error: 111; empty: 51; loading: 111.
- Bộ before/after: [manifest trước](../../artifacts/ui-audit/2026-11-06-web/manifest-before.json), [manifest sau ban đầu](../../artifacts/ui-audit/2026-11-06-web/manifest-after.json), [capture toàn route](../../artifacts/ui-audit/2026-11-06-web-final/manifest-after.json), [kiểm tra lại sau sửa cuối](../../artifacts/ui-audit/2026-11-06-web-correction/manifest-after.json). Capture sau cùng chỉ thay đúng tổ hợp trùng.
- API thật và CONTROLLED_FIXTURE được ghi riêng trong từng record. Chụp được màn hình không tự chứng minh thao tác hoặc tích hợp bên ngoài thành công.
- Ảnh và JSON kết quả gốc ở artifacts/ui-audit được giữ local và ignore khỏi Git. Kho Git lưu source, test, báo cáo và coverage đã tổng hợp; bản clone mới cần tái chạy để tạo lại các artifact được liên kết.

## Vấn đề và thay đổi

- Số issue theo mức: P0: 0; P1: 6; P2: 6; P3: 0.
- Đã nghiệm thu theo issue: 12/12.

- **UI-0001 — Menu mobile không quản lý focus** (VERIFIED): Đã thêm modal semantics, nút đóng, focus ban đầu/vòng Tab và trả focus.
- **UI-0002 — Mục Mua sắm không active ở catalog người mua** (VERIFIED): Giữ href canonical /catalog và thêm trạng thái active/aria-current cho alias người mua.
- **UI-0003 — Tiêu đề và đích bỏ qua nội dung chưa nhất quán** (VERIFIED): Dùng PageHeader cho tổng quan/đơn hàng; main public có id/tabIndex, CustomerLayout sở hữu đích ổn định cho cả loading/error/normal, RoleShell có skip link.
- **UI-0004 — Ảnh sản phẩm lỗi không có hình thay thế** (VERIFIED): Thêm trạng thái failed URL và fallback local, đổi URL mới vẫn thử tải lại.
- **UI-0005 — Khoảng trống lớn và chọn gói khó quét trên tablet** (VERIFIED): align-content:start cho main, grid thật cho comparison hero, responsive một cột và spacing chung.
- **UI-0006 — Hàng đợi trống bị đẩy xuống thấp; entry bàn giao rời tiêu đề** (VERIFIED): Cố định row header auto/content 1fr; đưa toggle bàn giao vào header, thêm aria-expanded/controls.
- **UI-0007 — Tên đọc của nút tài khoản/menu lệch chữ hiển thị** (VERIFIED): Dùng computeInitials hiện có, thêm tên/initials và khoảng trắng; nhãn menu mobile là Menu.
- **UI-0008 — Chấm chuyển trang sản phẩm quá nhỏ trên mobile** (VERIFIED): Nút 32×32px với chấm ::before 12px, cho phép wrap ở màn hẹp và giữ reduced motion.
- **UI-0009 — Nút sidebar nhân viên thiếu tương phản và tràn nhãn** (VERIFIED): Màu chữ lấy semantic token, profile chiếm một hàng và footer wrap.
- **UI-0010 — Nhãn trạng thái hồ sơ và tích hợp thiếu tương phản** (VERIFIED): Tái sử dụng StatusChip success/warning/neutral từ WorkspacePrimitives cho cả hai owner. Tab tích hợp dùng thêm section-card để có khoảng đệm 20px như các form hiện hữu, tránh chữ/control chạm viền.
- **UI-0011 — Chữ bộ lọc thời gian và bảng rỗng quá nhạt** (VERIFIED): Override đúng selector hiển thị bằng token muted; không thay màu disabled toàn theme.
- **UI-0012 — Bàn giao không phân biệt lỗi với rỗng và tạo vùng cuộn thừa** (VERIFIED): Tái sử dụng PageLoading/Empty; render Table khi có dữ liệu; lỗi giữ nút tải lại; không hiện phân trang ở trang đầu rỗng.

Chi tiết file, nguyên nhân và bằng chứng: [issues.md](issues.md), [issues.json](issues.json).

## Kiểm thử

- Browser regression UI: 31 đạt, 0 lỗi, 0 bỏ qua.
- Browser luồng nghiệp vụ (CONTROLLED_FIXTURE): 112 đạt, 0 lỗi, 0 bỏ qua.
- Kết quả system-admin chạy lại thay toàn bộ suite system-admin của lượt đầu; không cộng trùng ca. Lượt đầu: 105 đạt/7 lỗi fixture; giữ nguyên báo cáo gốc để truy vết.
- Frontend unit: 262 đạt, 0 lỗi, 0 bỏ qua.
- Frontend unit tập trung sau thay đổi cuối (các ca trùng bộ đầy đủ): 78 đạt, 0 lỗi, 0 bỏ qua.
- Lượt unit tập trung đầu: 76 đạt/2 lỗi; hai ca đạt khi chạy riêng (10,7s và 7,2s). Đã chạy lại cả file internal-consoles; kết quả mới chỉ thay file tương ứng, báo cáo thất bại gốc được giữ.
- Boundary API thật: 6 đạt, 0 lỗi, 0 bỏ qua.
- Browser phiên thật sau reload: 1 đạt, 0 lỗi, 0 bỏ qua.
- Carousel tại 320×800, reduced motion và phím Home/End: đạt; tràn toàn trang: false; transition track/dot: 0s/0s.
- Axe: 192 trường hợp phân biệt đã chạy; 0 nhóm vi phạm; 266 nhóm cần kiểm tra thủ công. Kết quả mới thay đúng tổ hợp trùng, không nhân số lượng ca. Nguồn: [2026-11-06-a11y-final](../../artifacts/ui-audit/2026-11-06-a11y-final/manifest-after.json), [2026-11-06-a11y-correction](../../artifacts/ui-audit/2026-11-06-a11y-correction/manifest-after.json), [2026-11-06-web-final](../../artifacts/ui-audit/2026-11-06-web-final/manifest-after.json), [2026-11-06-web-correction](../../artifacts/ui-audit/2026-11-06-web-correction/manifest-after.json).

- `corepack pnpm --dir EmuKey/frontend lint`: exit 0.
- `corepack pnpm --dir EmuKey/frontend typecheck`: exit 0.
- `corepack pnpm --dir EmuKey/frontend openapi:check`: exit 0.
- `corepack pnpm --dir EmuKey/frontend build`: exit 0; Vite bundle-size warning retained; no new dependency.
- `node --check tooling/emukey/verification/frontend-scripts/ui-audit-report.mjs`: exit 0.
- `node --check tooling/emukey/verification/frontend-scripts/visual-regression.mjs`: exit 0.
- `workspace_guard.py check --baseline OS_TEMP/emukey-ui-audit-baseline.json`: exit 0.
- `git diff --check`: exit 0.
- `git -C EmuKey diff --check`: exit 0.

Kết quả build/lint/typecheck và các lệnh kiểm thử mở rộng được ghi trong progress.md cùng mã thoát thực tế. Các timeout của lượt chạy trước được giữ như giới hạn kiểm chứng, không tự chuyển thành PASS.

## Phần cần đối soát

- Các luồng được kiểm chứng và giới hạn từng nhóm nằm trong [interaction-coverage.md](interaction-coverage.md); không suy ra tương tác từ ảnh normal.
- Screen reader và các mục axe incomplete cần kiểm tra thủ công; không tuyên bố chứng nhận WCAG từ kết quả tự động.
- Luồng SePay/worker/blockchain/provider receiver mới chưa tự động được tính đã nghiệm thu chỉ từ test API giả lập hoặc bằng chứng lịch sử.
- Native hoãn theo người dùng; build đang thử đã dừng, không báo là UI Android đã kiểm chứng.

## Tái chạy

`node tooling/emukey/verification/frontend-scripts/visual-regression.mjs --audit --run-id 2026-11-06-web --phase after`

Credential file chỉ cấp qua biến AUDIT_ACCOUNTS trỏ tới OS temp. Thêm --state empty/error/loading cho trạng thái có kiểm soát, --resume để tiếp tục ảnh đã chụp hợp lệ; AUDIT_AXE_SCRIPT là đường dẫn axe-core local. Không đưa token hoặc mật khẩu vào CLI, tài liệu hoặc Git.

`node tooling/emukey/verification/frontend-scripts/ui-audit-report.mjs --run-id 2026-11-06-web --a11y-run 2026-11-06-a11y-final,2026-11-06-a11y-correction,2026-11-06-web-final,2026-11-06-web-correction`
