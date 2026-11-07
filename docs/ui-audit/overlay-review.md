# Review popup và hộp thoại EmuKey

Ngày kiểm chứng 06/11/2026. Source nền: `c70a99944198564f46896237f26d1cca125750fe`. **Đã sửa và kiểm chứng 7 lỗi cùng cải thiện focus OV-008 trước khi commit** theo yêu cầu tiếp theo của người dùng. Phần mô tả bên dưới giữ bằng chứng trước sửa; kết quả sau sửa nằm ở cuối báo cáo. Ngày 07/11/2026, người dùng yêu cầu bàn giao phần UI lên cả hai repo với commit message `Chinh sua ui `.

## Phạm vi và phương pháp

Kiểm kê bằng AST toàn bộ TSX frontend: **41 vị trí khai báo**, gồm 20 Modal, 7 Drawer, 6 Dropdown, 2 Popover, 2 Popconfirm, 2 dialog menu tự viết và 2 lời gọi xác nhận bỏ thay đổi. Một vị trí có thể phục vụ nhiều trạng thái hoặc nhiều role, nên đây không phải 41 luồng nghiệp vụ độc lập. Danh sách từng vị trí, file và dòng nằm trong [overlay-review.json](overlay-review.json).

Đã mở các nhóm trên bằng Chromium/Playwright ở 320×900, 768×1024 và 1440×900, với CUSTOMER, PROVIDER_ADMIN, SUPPORT_STAFF, SYSTEM_ADMIN và khách tùy chức năng. Có 130 bản chụp cuối của lượt tổng quát và 59 quan sát bổ sung: 30 kiểm tra trạng thái, 10 kiểm tra bàn phím, 18 kiểm tra menu/trạng thái bổ sung và 1 kiểm tra lại vị trí Popconfirm. **189 quan sát không đồng nghĩa 189 test đạt**, cũng không phải mọi biến thể đều được nghiệm thu.

Toàn bộ API trong browser được chặn bằng CONTROLLED_FIXTURE; không đổi dữ liệu thật, gửi thư, thanh toán hoặc phát hành key. Ảnh che trường password/code/pre; key và tài khoản của fixture là giả. API lỗi, pending và tài liệu dài được chủ động giả lập. Native tiếp tục hoãn theo yêu cầu; Kotlin demo ngoài phạm vi.

Bằng chứng cục bộ: `artifacts/ui-audit/2026-11-06-overlays/` (đã được Git ignore). `manifest-stable.json` có 130 CAPTURED/0 BLOCKED; `probes.json` có 30 OBSERVED; `keyboard.json` có 10 OBSERVED. `extra.json` ban đầu có 17 OBSERVED/1 BLOCKED; ca blocked được thay bằng kết quả mở thành công trong `extra-rematch.json`, không cộng trùng. `plan-position.json` là quan sát thứ 189. Lượt khám phá đầu `manifest.json` có 124 capture/6 blocked, giữ làm lịch sử và nguồn axe, không cộng vào tổng cuối.

Ảnh cuối dùng `animations: 'disabled'` để hoàn tất chuyển động khi chụp, không sửa ảnh giao diện. Với kết quả vị trí nghi ngờ, đo lại sau các frame bố trí. Axe trên lượt đầu chỉ chạy ở chiều rộng 320 và quét cả trang; báo cáo chỉ dùng node đã đối chiếu nằm trong overlay. Không quy lỗi breadcrumb nền cho Modal mua hàng.

## Các phát hiện trước sửa

P1: cản trở đọc hoặc thao tác bằng bàn phím; P2: lỗi khả dụng cần sửa; P3: cải thiện. Có **7 lỗi xác nhận và 1 đề xuất cải thiện**. Các mã OV độc lập với 12 lỗi đã sửa của audit trang trước.

| Mã | Mức | Vấn đề | Phạm vi đã tái hiện |
| --- | --- | --- | --- |
| OV-001 | P1 | Chữ mục đang chọn gần như chìm trong nền menu mobile | Provider, Support, System ở 320 |
| OV-002 | P1 | Menu khai báo modal nhưng AI bên ngoài vẫn mở và nhận focus | Customer ở 320 và 768 |
| OV-003 | P1 | Drawer tài liệu dài không có vùng cuộn tiếp cận được bằng bàn phím | Provider ở 320 |
| OV-004 | P2 | Placeholder chọn sản phẩm trong hộp tải tài liệu quá nhạt | Provider ở 320; token dùng chung |
| OV-005 | P2 | Liên kết trích dẫn dài tràn ngang Popover AI | Customer ở cả ba cỡ |
| OV-006 | P2 | Customer không có lối mở thông báo ở mobile/tablet | 320 và 768 |
| OV-007 | P2 | Nút Hủy vẫn hoạt động về hình thức nhưng bị bỏ qua khi gửi lại pending | Provider ở cả ba cỡ |
| OV-008 | P3 | Focus chưa được đặt rõ ràng khi chuyển bước/xoay vòng hộp thoại | Mua hàng và hộp ghép lại thanh toán |

### OV-001 — Chữ mục menu đang chọn khó đọc

Mở menu ở trang tổng quan Provider, Support hoặc System, tại 320px. Mục active có chữ `#1c1c1a` trên nền `#2e2c29`, axe đo **1,22:1**. Ảnh cũng cho thấy chữ gần như biến mất. Quy tắc `.mobile-menu-panel nav a` đặt chữ tối đè lên màu chữ active của `.role-nav a.active`.

Owner: `EmuKey/frontend/src/presentation/styles.css`, các selector trên; menu tại `components/RoleShell.tsx:198`. Bằng chứng: `stable-role-menu-PROVIDER_ADMIN-320-final.png` và bản ghi cùng scene trong `manifest.json`.

Hướng sửa: khai báo màu chữ/nền active nhất quán trong menu responsive bằng token hiện có. Nghiệm thu: cả ba role, active/default/hover/focus đều đọc rõ, contrast chữ thường tối thiểu 4,5:1.

### OV-002 — Hai overlay cùng nhận tương tác dù menu là modal

Customer mở menu mobile, sau đó bấm nút trợ lý nổi. Menu vẫn mở; Popover AI xuất hiện bên ngoài; có thể đặt focus vào nút “Hỏi”. Menu đang có `aria-modal="true"`, nhưng tương tác đã ra ngoài menu. Tái hiện ở 320 và 768. Đây là lỗi phối hợp lớp giao diện, không phải bằng chứng vượt quyền API.

Owner: `components/SiteHeader.tsx:138`, `components/AiAssistantLauncher.tsx:48`, CSS backdrop/menu `z-index` 40/41. Nút nổi và Popover nằm ở lớp cao hơn. Bằng chứng: `keyboard-menu-ai-layer-320.png`, `keyboard-menu-ai-layer-768.png` và `keyboard.json` (`menuRemainsOpen=true`, `assistantVisible=true`, `focusedInsideMenu=false`).

Hướng sửa: thống nhất cách quản lý overlay; khi menu modal mở, khóa tương tác nền và nút AI hoặc đóng menu trước khi mở AI. Nghiệm thu bằng chuột và Tab/Shift+Tab: không có hai vùng tương tác cạnh tranh với một modal đang mở. Chưa khẳng định đã tái hiện cùng lỗi trên mọi role.

### OV-003 — Tài liệu dài không cuộn được từ bàn phím

Provider mở tài liệu dài tại `/provider/knowledge`, 320px. `.ant-drawer-body` có nội dung cao 1.624px, khung cao 841px, không có tabindex và không có phần tử tương tác trong nội dung. Focus ở nút đóng header; PageDown không đổi `scrollTop` (vẫn 0). Axe báo `scrollable-region-focusable`. Người dùng bàn phím không có điểm vào vùng đọc dài.

Owner: `screens/AiKnowledgeScreen.tsx:125`. Bằng chứng: `keyboard-document-scroll-320.png`, số đo `keyboard.json`, axe scene `provider-document` trong `manifest.json`.

Hướng sửa: cung cấp vùng nội dung cuộn có thể focus, tên truy cập rõ ràng và thứ tự focus hợp lý; bảo đảm Arrow/PageDown/End thực sự cuộn nội dung. Không che hoặc cắt bớt tài liệu để tránh overflow. Với fixture hiện tại ở desktop/tablet, nội dung vừa khung nên chưa chứng minh lỗi cuộn ở hai cỡ đó.

### OV-004 — Placeholder quá nhạt trong hộp tải tài liệu

Mở “Tải tài liệu sản phẩm”. Select “Chọn sản phẩm” dùng chữ `#94a3b8` trên nền trắng, cỡ 16px; axe đo **2,56:1**. Đây là hướng dẫn cần đọc để chọn sản phẩm, không phải một giá trị của control bị disabled. Select đã có aria-label; không phải lỗi thiếu tên truy cập.

Owner: `screens/AiKnowledgeScreen.tsx:71` và token `colorTextPlaceholder` trong theme. Bằng chứng: `stable-provider-upload-320-final.png`, axe `.ant-select-placeholder` trong `manifest.json`.

Hướng sửa: dùng token placeholder đủ tương phản, bổ sung nhãn hiển thị nếu cần để người dùng không phụ thuộc placeholder. Kiểm tra các form overlay dùng cùng token trước khi đổi dùng chung; không đổi màu trạng thái disabled một cách đồng loạt thiếu phân biệt.

### OV-005 — Trích dẫn dài tràn khỏi Popover AI

Customer hỏi AI bằng fixture trả về tên tài liệu “Tài liệu hướng dẫn kiểm thử · phiên bản 1”. Liên kết trích dẫn không xuống dòng, tràn khỏi panel. Ở 320px: popup `clientWidth=280`, `scrollWidth=337`; ở 768/1440: `clientWidth=304`, `scrollWidth=337`. Lỗi vẫn tồn tại sau khi chuyển động đã kết thúc.

Owner: `components/AiAssistantLauncher.tsx:48`, `components/KnowledgeCitations.tsx:15` và `.ai-assistant-panel`. Bằng chứng: `probe-ai-overflow-320.png`, các số đo trong `probes.json`.

Hướng sửa: cho tên trích dẫn xuống dòng, kiểm soát min-width của phần tử flex và giới hạn chiều rộng panel theo viewport. Nội dung dài cần cuộn có chủ đích; không chỉ dùng overflow hidden khiến mất chữ. Nghiệm thu với tên tài liệu dài và chuỗi không có khoảng trắng ở cả ba cỡ.

### OV-006 — Thiếu lối mở thông báo trên màn nhỏ

Customer ở 320 hoặc 768: cụm header chứa NotificationCenter bị ẩn; menu responsive có Hồ sơ/Đăng xuất nhưng không có Thông báo. Probe xác nhận nút thông báo không hiển thị và trong menu không có mục tương đương. Đây là mất đường vào chức năng khi đổi kích thước màn hình. Việc Dropdown tài khoản desktop biến mất không phải lỗi riêng, vì menu mobile vẫn có Hồ sơ.

Owner: `components/SiteHeader.tsx:100` và nhánh mobile actions tại khoảng dòng 152; CSS responsive của `.header-actions`. Bằng chứng: `extra-notification-reachability-320.png`, `extra-notification-reachability-768.png`, `extra.json`.

Hướng sửa: bổ sung lối mở NotificationCenter hiện có trên responsive, giữ trạng thái chưa đọc và quyền hiện tại; không cần tạo màn thông báo thứ hai. Nghiệm thu mở/xem/đóng bằng bàn phím và chạm ở cả hai cỡ, cùng trạng thái rỗng/lỗi.

### OV-007 — Nút Hủy gây hiểu nhầm khi gửi lại đang xử lý

Mở “Gửi lại bản quyền”, nhập lý do rồi xác nhận với API pending. Nút Hủy vẫn enabled nhưng bấm không đóng. Source dùng `confirmLoading={retry.isPending}`, trong khi onCancel bỏ qua khi pending. Tái hiện cả ba cỡ, `cancelEnabled=true` và dialog còn mở sau bấm.

Owner: `components/ProviderDeliveryPanel.tsx:111`. Bằng chứng: `probe-delivery-pending-320.png` và các record `delivery-pending` trong `probes.json`.

Hướng sửa: biểu đạt nhất quán trạng thái xử lý: disable nút Hủy/đóng và giải thích ngắn khi chưa thể đóng, hoặc cho đóng nếu nghiệp vụ cho phép tiếp tục theo dõi bên ngoài. Không coi đóng hộp thoại là hủy tác vụ backend. Nghiệm thu phản hồi nút, X, Escape và khôi phục thao tác sau lỗi.

### OV-008 — Cải thiện focus khi nội dung hộp thoại thay đổi

Sau bước “Tiếp tục” của Modal mua hàng, `document.activeElement` có lúc là BODY (768/1440); Tab tiếp theo quay vào nút đóng, Escape vẫn đóng đúng ở cả ba cỡ. Trong hộp ghi kết quả thanh toán REMATCHED, vòng Tab 14 bước cũng có điểm focus BODY sau nút Hủy, rồi quay vào nút đóng; vì vậy **không đánh dấu vòng focus đạt toàn bộ**. Chưa quan sát thao tác điều khiển nền qua Tab trong các ca này.

Owner: `components/PurchaseFlowModal.tsx:292` và Modal trong `components/PaymentReviewPanel.tsx:51`; cần xác định thêm phần hành vi của thư viện trước khi sửa cơ chế focus chung. Bằng chứng: `probes.json`, `keyboard.json`, `extra-rematch.json` (`tabLoopInside=false`), log đo bổ sung của probe focus. Không diễn giải thành Escape bị hỏng hoặc người dùng bị kẹt hoàn toàn.

Hướng cải thiện: đưa focus đến tiêu đề bước hoặc trường đầu phù hợp sau chuyển bước; kiểm tra lại Shift+Tab/Tab và thông báo đổi bước bằng screen reader. Chỉ đổi hành vi dùng chung sau khi có regression test tái hiện đúng phiên bản thư viện.

## Các hành vi đã quan sát hoạt động

- Modal xác nhận khóa user/công bố tài liệu/ghi kết quả nằm trên Drawer cha đúng lớp. Với ghép lại thanh toán, chọn kết quả mở thêm các trường UUID; Escape đóng Modal con và giữ Drawer cha. Vòng focus còn điểm cần kiểm tra như OV-008.
- Hộp cảnh báo bỏ thay đổi của cả sản phẩm và gói: chọn “Tiếp tục chỉnh sửa” giữ dữ liệu đã nhập ở cả ba cỡ.
- Form đổi mật khẩu khi API trả 503 giữ dữ liệu đã nhập và hiện lỗi. LoadingOverlay dùng chung đã được mở bằng request pending; client có timeout 10 giây, không có cơ sở kết luận khóa vô thời hạn.
- Hộp tải tài liệu giữ file được chọn khi đóng rồi mở lại ở cả ba cỡ.
- Hai vị trí hiển thị mã bản quyền (trang bản quyền và trạng thái thanh toán) đã được mở bằng key giả. Đây là kiểm tra UI, không nghiệm thu phát hành key thật.
- Menu tài khoản Provider nhận focus vào item khi mở bằng Enter tại 768/1440. AI ở Provider hiển thị trợ giúp đúng phạm vi và không có ô hỏi dành cho Customer.
- Thông báo desktop đã mở được ở trạng thái rỗng và lỗi; không khắc phục được việc thiếu đường vào responsive nêu tại OV-006.
- Modal trích dẫn dài có wrapper cuộn và chạm tới footer được; chiều cao lớn hơn viewport tự nó không phải lỗi.

## Các nghi vấn đã loại trừ hoặc chưa kết luận

Ảnh khám phá đầu có ghost trong lúc Modal/Drawer đang chuyển động; không dùng làm bằng chứng sai lớp. Các ca tạo gói bị blocked ban đầu do runner tìm nhãn “Thêm gói” thay vì “Tạo gói” đã được mở lại bằng nhãn đúng, không phải lỗi app. Ca mở REMATCHED đầu bị blocked do runner chưa mở Select, cũng đã kiểm tra lại thành công.

Một record tổng quát Popconfirm “Xóa gói nháp” ở 768 cho box vượt mép phải. Đo lại sau bố trí cho thấy `innerWidth=768`, `scrollX=538`, popup x=484 và mép phải=767,89; nút Xóa kết thúc tại 755,89, vẫn trong viewport. **Không ghi nhận lỗi Popconfirm tràn dựa vào record trước đó**. Trang nền lúc mở bảng gói có chiều rộng tài liệu 1.306px và tự cuộn ngang khi click; đây là ghi nhận bố cục nền cần đánh giá riêng, không cộng thành lỗi popup thứ tám.

Kết quả axe 0 violation trên 192 tổ hợp trang normal/403 của audit trước không bao gồm các popup vừa mở trong lượt này. Hai phạm vi khác nhau; không sử dụng kết quả trang nền để kết luận overlay đã đạt accessibility.

## Thứ tự xử lý và giới hạn

Thứ tự sửa đã chọn: OV-001/002/003 trước vì ảnh hưởng đọc và thao tác; tiếp theo OV-004 đến OV-007 và OV-008. Các ca tái hiện và trạng thái lồng/pending/error liên quan được chạy lại; không suy rộng kết quả thành mọi trạng thái của ứng dụng đã đạt.

Chưa nghiệm thu screen reader thật, touch trên thiết bị thật, zoom/font scaling toàn bộ, mọi biến thể role/status, mọi response và mọi chuỗi dữ liệu dài. Dropdown Select, calendar, tooltip do thư viện sinh không được kiểm kê từng instance như macro overlay; có mở Select kết quả xử lý thanh toán để kiểm tra lồng lớp. Toast/message cũng chưa được kiểm kê đầy đủ theo mọi mutation. Các phép thử này không thay cho end-to-end API thật hoặc kiểm thử WCAG đầy đủ.

Đợt review ban đầu chỉ thêm báo cáo/inventory và cập nhật tiến độ. Đợt sửa tiếp theo chỉ thay đổi frontend, test browser và báo cáo; giữ nguyên backend, SQL, sơ đồ, dependency và lockfile. Các cờ commit/push trong JSON mô tả thời điểm kiểm chứng trước bàn giao Git.

## Kết quả sửa theo yêu cầu tiếp theo

| Mã | Trạng thái | Thay đổi và kiểm chứng |
| --- | --- | --- |
| OV-001 | VERIFIED | Màu active trong menu responsive dùng cặp token sidebar; test contrast ≥4,5:1 cả default/hover cho Provider, Support, System ở 320. |
| OV-002 | VERIFIED | Ẩn launcher và Popover AI khỏi hiển thị/tương tác khi menu responsive đang mở; kiểm tra AI đã mở rồi mở menu, đóng bằng Escape và dùng lại AI ở 320/768. Không bổ sung store/context overlay mới. |
| OV-003 | VERIFIED | Drawer có region “Nội dung tài liệu” nhận Tab và sở hữu vùng cuộn; test Tab từ nút đóng đến region rồi PageDown làm tăng scrollTop. Chụp lại Provider và xác nhận công bố trên Drawer System. |
| OV-004 | VERIFIED | Placeholder dùng token muted thay vì disabled, giữ nguyên token chữ disabled; thêm nhãn hiển thị liên kết với Select sản phẩm. Contrast browser đạt, axe ca upload không còn violation trước đó. |
| OV-005 | VERIFIED | Link trích dẫn xuống dòng, kể cả chuỗi không có khoảng trắng; panel giới hạn chiều cao và cuộn nội dung. Ba cỡ đều không có scrollWidth vượt clientWidth. |
| OV-006 | VERIFIED | Chuông thông báo nằm ngoài cụm account bị ẩn trên responsive, tái sử dụng một NotificationCenter. Popover đổi từ bottomRight sang bottom để tự dịch trong viewport. Test có thông báo dài và đo cả mép trái/phải ở 320/768. |
| OV-007 | VERIFIED | Khi retry pending, Hủy và X disabled, Escape/mask không đóng; có lời nhắc đang xử lý. Sau 503, Hủy được bật lại và đóng được. Test cả ba cỡ; không thay đổi tác vụ backend. |
| OV-008 | VERIFIED | Tiêu đề bước mua là heading nhận focus khi mở/chuyển bước. ModalFocusBoundary trong WorkspacePrimitives hỗ trợ vòng Tab tại hai Modal mua hàng/rà soát, giữ popup Select và Modal con tự quản lý. Vòng Tab/Shift+Tab 14 lần mỗi chiều đạt ở 320/768/1440; Escape đóng Modal con và trả focus về nút mở trong Drawer. |

Trong quá trình nghiệm thu OV-006, mở được thông báo nhưng popup bottomRight vẫn có x=-48 tại 320. Test đo viewport đã thất bại trước chỉnh placement rồi đạt sau sửa. Đây là phần hoàn thiện của OV-006, không tính thêm một mã lỗi mới. Ảnh cuối kiểm tra sau khi lớp chuyển động của Popover kết thúc để không nhầm số đo scale/hoạt ảnh với vị trí cuối.

Kiểm tra browser: 20 ca sửa trực tiếp đạt; 3 ca focus lồng đạt; 50 ca hồi quy liên quan đạt. Hai ca thông báo trong bộ 20 đã được thay bằng lượt kiểm tra cuối mạnh hơn (có nội dung dài và kiểm tra biên viewport), đạt 2/2. **Tổng cuối là 73 ca phân biệt**, không cộng trùng hai ca này. Lượt red giữ 20 lỗi tái hiện ban đầu; lượt notification-red riêng giữ 1 lỗi/1 đạt trước sửa placement.

Bằng chứng sau sửa tại `artifacts/ui-audit/2026-11-06-overlay-fixes/`: `red.json`, `green.json`, `focus.json`, `regression.json`, `notification-red.json`, `notification-green.json`; `capture/manifest-stable.json` có 31 capture/0 blocked và 12 lượt axe ở 320, không có violation tự động trong các lượt đó. `after-probes.json` có 7 quan sát ảnh bổ sung về AI/menu/thông báo. Các ảnh/báo cáo kiểm tra là output bị ignore, không đưa vào source Git.

Lint, typecheck và build đạt trên source cuối. Build còn cảnh báo chunk JS khoảng 1,65 MB (gzip khoảng 503 KB). Unit đầy đủ (`unit.json`) ban đầu đạt 261/262, exit 1: test giữ quyền nâng cao khi lưu gói báo STACK_TRACE_ERROR sau 32,7 giây, trong khi timeout cấu hình là 30 giây. Chạy lại cả file provider-workspace.test.tsx (`unit-provider-recheck.json`) đạt 19/19, exit 0; test đó hoàn tất trong 22,6 giây. Không sửa source/test hoặc tăng timeout giữa hai lượt. Kết quả cuối theo từng ca là 262/262 sau thay kết quả file bằng lượt kiểm tra lại; giữ nguyên báo cáo thất bại ban đầu và ghi nhận độ nhạy thời gian, không khẳng định đã loại bỏ hoàn toàn tính thiếu ổn định của unit dưới tải. Workspace guard và diff check cả hai repo đạt; không có file source hoặc dependency mới.

Nguồn kỹ thuật: React 19.2.8 và Ant Design 6.6.2 theo package cài đặt; đã đối chiếu khai báo/implementation hiện có cho modalRender, closable.disabled, cancelButtonProps và drawer. [Modal API](https://ant.design/components/modal/), [Drawer API](https://ant.design/components/drawer/) và [quy tắc placement dùng chung](https://ant.design/components/tooltip/#faq) là tài liệu đối chiếu; placement cạnh bottomRight chỉ flip, còn bottom hỗ trợ shift. Không nâng phiên bản hoặc thêm dependency để sửa các lỗi này.
