# Issue UI/UX đã xác minh

Nguồn máy đọc: [issues.json](issues.json). Các cặp ảnh fixture giữ nguyên dữ liệu trước/sau; ảnh REAL_API ghi trong manifest được làm mờ trường nhạy cảm. VERIFIED chỉ áp dụng lỗi cụ thể và phạm vi kiểm tra đã ghi.

## UI-0001 — Menu mobile không quản lý focus

- Mức: P1; trạng thái: VERIFIED.
- Hiện trạng: SiteHeader mở dialog không aria-modal, không đưa focus vào và không giữ vòng Tab.
- Mong đợi: Focus bắt đầu trong menu, Tab không thoát ra nền, Escape trả focus.
- Sửa: Đã thêm modal semantics, nút đóng, focus ban đầu/vòng Tab và trả focus.
- File: `EmuKey/frontend/src/presentation/components/SiteHeader.tsx`.
- Kiểm chứng: Playwright ui-audit.spec.ts: mobile public navigation; review ảnh after; 15/15 regression đạt; đối chiếu cặp ảnh cùng fixture từ source gốc và working tree.
- [Trước](../../artifacts/ui-audit/2026-11-06-web/before-fixture-original/menu-mobile.png) / [Sau 1](../../artifacts/ui-audit/2026-11-06-web/after-fixture-original/menu-mobile.png).

## UI-0002 — Mục Mua sắm không active ở catalog người mua

- Mức: P2; trạng thái: VERIFIED.
- Hiện trạng: NavLink trỏ /catalog nên không khớp route /buyer/products và route chi tiết con.
- Mong đợi: Menu Mua sắm active ở toàn bộ khu vực sản phẩm của người mua.
- Sửa: Giữ href canonical /catalog và thêm trạng thái active/aria-current cho alias người mua.
- File: `EmuKey/frontend/src/presentation/components/CustomerLayout.tsx`.
- Kiểm chứng: Playwright ui-audit.spec.ts: customer shopping navigation; review ảnh after; 15/15 regression đạt; đối chiếu cặp ảnh cùng fixture từ source gốc và working tree.
- [Trước](../../artifacts/ui-audit/2026-11-06-web/before-fixture-original/buyer-shopping.png) / [Sau 1](../../artifacts/ui-audit/2026-11-06-web/after-fixture-original/buyer-shopping.png).

## UI-0003 — Tiêu đề và đích bỏ qua nội dung chưa nhất quán

- Mức: P2; trạng thái: VERIFIED.
- Hiện trạng: BuyerHome và BuyerOrders không có h1, main không có id mà skip link của header đang trỏ tới. Các màn public và một số màn Customer cũng thiếu đích skip.
- Mong đợi: Có tiêu đề rõ và đúng một đích #main-content.
- Sửa: Dùng PageHeader cho tổng quan/đơn hàng; main public có id/tabIndex, CustomerLayout sở hữu đích ổn định cho cả loading/error/normal, RoleShell có skip link.
- File: `EmuKey/frontend/src/presentation/screens/BuyerHomeScreen.tsx`, `EmuKey/frontend/src/presentation/screens/BuyerOrdersScreen.tsx`, `EmuKey/frontend/src/presentation/components/RoleShell.tsx`, `EmuKey/frontend/src/presentation/components/CustomerLayout.tsx`, `EmuKey/frontend/src/presentation/components/SiteHeader.tsx`, `EmuKey/frontend/src/presentation/screens/CatalogScreen.tsx`, `EmuKey/frontend/src/presentation/screens/ComparePlansScreen.tsx`, `EmuKey/frontend/src/presentation/screens/ProductDetailScreen.tsx`, `EmuKey/frontend/src/presentation/screens/PublicHomeScreen.tsx`, `EmuKey/frontend/src/presentation/screens/PublicHelpScreen.tsx`, `EmuKey/frontend/src/presentation/screens/PublicVerificationScreen.tsx`.
- Kiểm chứng: 7 ca skip navigation FAIL trước sửa, đạt sau sửa; bộ UI/bàn giao 31/31 đạt; focus đến đúng đích qua Enter..
- [Trước](../../artifacts/ui-audit/2026-11-06-web/before-fixture-original/buyer-overview.png) / [Sau 1](../../artifacts/ui-audit/2026-11-06-web/after-fixture-original/buyer-overview.png) / [Sau 2](../../artifacts/ui-audit/2026-11-06-web/after-fixture-original/buyer-orders.png).

## UI-0004 — Ảnh sản phẩm lỗi không có hình thay thế

- Mức: P2; trạng thái: VERIFIED.
- Hiện trạng: ProductArtwork chỉ fallback khi không có URL; URL trả 404 vẫn render img lỗi.
- Mong đợi: Ảnh không tải được chuyển artwork SVG local, giữ tên/CTA.
- Sửa: Thêm trạng thái failed URL và fallback local, đổi URL mới vẫn thử tải lại.
- File: `EmuKey/frontend/src/presentation/components/ProductArtwork.tsx`.
- Kiểm chứng: Playwright ui-audit.spec.ts: failed product image; review ảnh after; 15/15 regression đạt; đối chiếu cặp ảnh cùng fixture từ source gốc và working tree.
- [Trước](../../artifacts/ui-audit/2026-11-06-web/before-fixture-original/image-error.png) / [Sau 1](../../artifacts/ui-audit/2026-11-06-web/after-fixture-original/image-error.png).

## UI-0005 — Khoảng trống lớn và chọn gói khó quét trên tablet

- Mức: P2; trạng thái: VERIFIED.
- Hiện trạng: Grid main bị giãn track theo min-height; comparison-hero khai báo grid columns nhưng vẫn display flex.
- Mong đợi: Heading và chọn gói bắt đầu gần đầu trang, xếp lại rõ ở màn nhỏ.
- Sửa: align-content:start cho main, grid thật cho comparison hero, responsive một cột và spacing chung.
- File: `EmuKey/frontend/src/presentation/styles.css`.
- Kiểm chứng: Playwright ui-audit.spec.ts: tablet comparison; review ảnh after; 15/15 regression đạt; đối chiếu cặp ảnh cùng fixture từ source gốc và working tree.
- [Trước](../../artifacts/ui-audit/2026-11-06-web/before-fixture-original/compare-tablet.png) / [Sau 1](../../artifacts/ui-audit/2026-11-06-web/after-fixture-original/compare-tablet.png).

## UI-0006 — Hàng đợi trống bị đẩy xuống thấp; entry bàn giao rời tiêu đề

- Mức: P2; trạng thái: VERIFIED.
- Hiện trạng: Grid role có hai auto row chia khoảng dư; nút bàn giao nằm trước PageHeader như một bước tách biệt.
- Mong đợi: Nội dung sát dưới header; bàn giao là panel thao tác trong cùng console.
- Sửa: Cố định row header auto/content 1fr; đưa toggle bàn giao vào header, thêm aria-expanded/controls.
- File: `EmuKey/frontend/src/presentation/styles.css`, `EmuKey/frontend/src/presentation/screens/SupportConsoleScreen.tsx`.
- Kiểm chứng: Playwright ui-audit.spec.ts: empty support queue; review ảnh after; 15/15 regression đạt; đối chiếu cặp ảnh cùng fixture từ source gốc và working tree.
- [Trước](../../artifacts/ui-audit/2026-11-06-web/before-fixture-original/support-empty.png) / [Sau 1](../../artifacts/ui-audit/2026-11-06-web/after-fixture-original/support-empty.png).

## UI-0007 — Tên đọc của nút tài khoản/menu lệch chữ hiển thị

- Mức: P1; trạng thái: VERIFIED.
- Hiện trạng: aria-label bỏ tên và initials của tài khoản; menu ghi Điều hướng nhưng tên đọc là Mở menu vai trò.
- Mong đợi: Tên đọc chứa nhãn hiển thị để hỗ trợ voice control.
- Sửa: Dùng computeInitials hiện có, thêm tên/initials và khoảng trắng; nhãn menu mobile là Menu.
- File: `EmuKey/frontend/src/presentation/components/SiteHeader.tsx`, `EmuKey/frontend/src/presentation/components/RoleShell.tsx`.
- Kiểm chứng: 3 ca nhãn tài khoản, 1 ca menu và axe correction: 0 violation.
- [Trước](../../artifacts/ui-audit/2026-11-06-web/before-fixture/account-label-PROVIDER_ADMIN.png) / [Sau 1](../../artifacts/ui-audit/2026-11-06-web/after-fixture/account-label-PROVIDER_ADMIN.png).

## UI-0008 — Chấm chuyển trang sản phẩm quá nhỏ trên mobile

- Mức: P1; trạng thái: VERIFIED.
- Hiện trạng: Vùng bấm của mỗi tab chỉ 12×12px.
- Mong đợi: Vùng chạm đủ lớn, vẫn giữ hình chấm nhỏ.
- Sửa: Nút 32×32px với chấm ::before 12px, cho phép wrap ở màn hẹp và giữ reduced motion.
- File: `EmuKey/frontend/src/presentation/screens/PublicHomeScreen.tsx`.
- Kiểm chứng: Playwright đo từng vùng bấm; axe target-size không còn vi phạm.
- [Trước](../../artifacts/ui-audit/2026-11-06-web/before-fixture/featured-touch-mobile.png) / [Sau 1](../../artifacts/ui-audit/2026-11-06-web/after-fixture/featured-touch-mobile.png).

## UI-0009 — Nút sidebar nhân viên thiếu tương phản và tràn nhãn

- Mức: P1; trạng thái: VERIFIED.
- Hiện trạng: Màu chữ sáng trên nền trắng; Hồ sơ tràn khỏi nút khi chia cùng hàng với thông báo và đăng xuất.
- Mong đợi: Chữ >=4.5:1 và nhãn nằm trong biên nút.
- Sửa: Màu chữ lấy semantic token, profile chiếm một hàng và footer wrap.
- File: `EmuKey/frontend/src/presentation/styles.css`.
- Kiểm chứng: Playwright đo contrast và biên nhãn; axe correction 0 violation; review ảnh sidebar.
- [Trước](../../artifacts/ui-audit/2026-11-06-web/before-fixture/support-logout-contrast.png) / [Sau 1](../../artifacts/ui-audit/2026-11-06-web/after-fixture/support-logout-contrast.png).

## UI-0010 — Nhãn trạng thái hồ sơ và tích hợp thiếu tương phản

- Mức: P1; trạng thái: VERIFIED.
- Hiện trạng: Tag green mặc định có tương phản 3.37:1 trên nền #f6ffed ở cỡ chữ 14px. Cùng preset green cũng được dùng ở trạng thái tích hợp nhà cung cấp.
- Mong đợi: Chữ thường đạt ít nhất 4.5:1; dùng màu semantic nhất quán.
- Sửa: Tái sử dụng StatusChip success/warning/neutral từ WorkspacePrimitives cho cả hai owner. Tab tích hợp dùng thêm section-card để có khoảng đệm 20px như các form hiện hữu, tránh chữ/control chạm viền.
- File: `EmuKey/frontend/src/presentation/screens/AccountProfileScreen.tsx`, `EmuKey/frontend/src/presentation/components/ProviderIntegrationPanel.tsx`.
- Kiểm chứng: Bộ UI/bàn giao 31/31 đạt; axe kiểm tra lại 45 tổ hợp: 0 violation; review ảnh profile và integration sau sửa..
- [Trước](../../artifacts/ui-audit/2026-11-06-web/before-fixture/profile-status.png) / [Sau 1](../../artifacts/ui-audit/2026-11-06-web-correction/manifest-after.json) / [Sau 2](../../artifacts/ui-audit/2026-11-06-web-correction/after/PROVIDER_ADMIN/_provider_operations_tab_integration/tablet/normal.png) / [Sau 3](../../artifacts/ui-audit/2026-11-06-web-correction/after/CUSTOMER/_buyer_profile/mobile/normal.png).

## UI-0011 — Chữ bộ lọc thời gian và bảng rỗng quá nhạt

- Mức: P1; trạng thái: VERIFIED.
- Hiện trạng: Axe ghi nhận chữ phân cách DatePicker và thông báo bảng rỗng chỉ đạt 2.56:1 vì nhận màu disabled.
- Mong đợi: Thông tin đang hiển thị có thể đọc với tương phản ít nhất 4.5:1.
- Sửa: Override đúng selector hiển thị bằng token muted; không thay màu disabled toàn theme.
- File: `EmuKey/frontend/src/presentation/styles.css`.
- Kiểm chứng: Bộ UI/bàn giao 31/31 đạt; axe kiểm tra lại 45 tổ hợp: 0 violation; review ảnh profile và integration sau sửa..
- [Trước](../../artifacts/ui-audit/2026-11-06-web-final/manifest-after.json) / [Sau 1](../../artifacts/ui-audit/2026-11-06-web-correction/manifest-after.json) / [Sau 2](../../artifacts/ui-audit/2026-11-06-web-correction/after/PROVIDER_ADMIN/_provider_operations_tab_integration/tablet/normal.png).

## UI-0012 — Bàn giao không phân biệt lỗi với rỗng và tạo vùng cuộn thừa

- Mức: P2; trạng thái: VERIFIED.
- Hiện trạng: ProviderDeliveryPanel luôn render Table scroll 720px; bảng rỗng không có phần tử focus và lỗi API vẫn kèm thông báo chưa có bản quyền.
- Mong đợi: Loading, lỗi, rỗng tách biệt; rỗng không tạo bảng ngang vô ích.
- Sửa: Tái sử dụng PageLoading/Empty; render Table khi có dữ liệu; lỗi giữ nút tải lại; không hiện phân trang ở trang đầu rỗng.
- File: `EmuKey/frontend/src/presentation/components/ProviderDeliveryPanel.tsx`.
- Kiểm chứng: Bộ UI/bàn giao 31/31 đạt; axe kiểm tra lại 45 tổ hợp: 0 violation; review ảnh profile và integration sau sửa..
- [Trước](../../artifacts/ui-audit/2026-11-06-web-final/manifest-after.json) / [Sau 1](../../artifacts/ui-audit/2026-11-06-web-correction/manifest-after.json) / [Sau 2](../../artifacts/ui-audit/2026-11-06-web-correction/after/PROVIDER_ADMIN/_provider_operations_tab_integration/tablet/normal.png).
