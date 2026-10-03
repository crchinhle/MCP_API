# EmuKey — Review UI/UX vòng 4 và kết quả sửa trực tiếp

> Historical record: implementation status and commands below describe the dated review, not current acceptance. Current device authority is PostgreSQL; blockchain receives aggregate device-count/version sync only. Repository paths are updated where the referenced files moved.

Ngày rà soát: 21/09/2026.

File: [KLTN — 04_Screens_Web](https://www.figma.com/design/ys1A2io0Ozz1TvR2o9S4Nb/KLTN?node-id=47-96).

**Kết luận:** Đã sửa trực tiếp trong Figma, kiểm tra cấu trúc và kiểm tra ảnh hai vòng, đồng thời sửa tiếp những lỗi phát hiện khi kiểm tra. **Chưa nghiệm thu toàn bộ sản phẩm hoặc toàn bộ prototype.** Các phần còn mở được ghi rõ tại mục 6.

Phạm vi: 20 màn hình web ban đầu, mở rộng thành 36 màn hình/trạng thái web; các mẫu điều hướng desktop/tablet/mobile. Bổ sung mẫu drawer mobile cho Provider, Support, System. Không sửa page Android native. Không có repository hoặc chính sách phân quyền backend để đối chiếu.

## 1. Kiểm tra lại các vùng bị lỗi

### Đính chính báo cáo vòng 3

Không coi mọi kết luận cũ là hiện trạng. Ngay lần đọc đầu của vòng này, W19 — chi tiết SecureDesk trong Customer shell và W20 — đăng ký đã tồn tại.

| Nhận định cũ | Hiện trạng khi bắt đầu vòng này | Xử lý |
|---|---|---|
| Customer sai điều hướng hàng loạt | Các link chính đã đúng; mục active thường không có reaction | Giữ cách hoạt động đúng và kiểm tra lại đích; không gắn self-navigation |
| Đăng ký dẫn sai trang | W02/W03/W04 đã dẫn tới W20 | Ghi nhận đã đúng trước vòng này |
| Provider lặp ba tầng menu trên giao diện | Menu cũ đã ẩn nhưng layer dư còn tồn tại | Xóa đúng layer cũ được xác định; không nhầm lỗi cấu trúc với lỗi hiển thị |
| Hero Customer Catalog bị cắt | Hero đã bị ẩn khỏi W18 | Không tính đây là một lỗi hero vừa được sửa |
| W18 đưa SecureDesk sang public shell | SecureDesk đã đi tới W19; CloudStudio/DataGuard bị ẩn hành động | Bổ sung luồng CloudStudio và giải thích trạng thái SDK |
| System có nhiều mục không có trang | Các mục thừa đã ẩn, còn một mục giám sát hiển thị | Dọn cấu trúc cũ, tổ chức bộ lọc trong workspace |

### Những lỗi xác nhận và đã sửa

| Vùng | Vấn đề | Thay đổi trực tiếp |
|---|---|---|
| W13 | Drawer tạo gói mở sẵn, che danh sách | Tách Default/Create; Tạo gói mở drawer; Đóng, nền và Escape quay lại |
| W08 | Chi tiết đơn mở sẵn | Tách List/Detail; dòng ORD-2026-0218 mở chi tiết; Đóng/Thanh toán có vùng bấm riêng |
| W13 | Tab chưa có trạng thái tương ứng; số 6/14 không khớp mẫu | Thêm Products, nối tab; thống nhất 3 sản phẩm, 4 gói, 3 công bố, 1 nháp |
| Bảng dùng chung | Cột số tiền/trạng thái nằm ngoài khung | Sửa component Data/Table Row gốc; cột gói co giãn; đồng bộ header |
| Tổng thanh toán | Giá, đơn vị tiền và số thiết bị bị cắt | Sửa component Commerce/Price Summary gốc và đọc lại instance |
| Tài khoản | Hồ sơ/Tài khoản và Đăng xuất gộp một dòng nhỏ | Menu riêng theo role, nút Đăng xuất riêng; Provider có Hồ sơ doanh nghiệp → W12 |
| CloudStudio | Thiếu luồng riêng và hành động trên card | Thêm public detail, customer detail, checkout, payment; minh họa đúng sản phẩm |
| Mua hàng public | CTA đi thẳng tới checkout đã đăng nhập | Login/register giữ ngữ cảnh từng sản phẩm và tiếp tục đúng checkout |
| Catalog | Hai CTA cùng đích; card CloudStudio thiếu CTA | Gộp “Xem gói & chi tiết”; khôi phục CloudStudio; hero public cuộn tới vùng sản phẩm |
| DataGuard | Không có hành động hoặc lời giải thích | Ghi “Chưa mở bán”, theo gói SDK v2 nháp trong mẫu |
| Public support | Không có đích hoặc đi vào Customer shell | Cửa sổ hỗ trợ khách vãng lai, hướng dẫn đăng nhập |
| Support | Không rõ danh sách chung/người phụ trách/trạng thái | All/Mine, Đang xử lý, người phụ trách, Hoàn tất/Resolved/Mở lại |
| Support | Gợi ý thu hồi thiết bị dù còn 11 chỗ | Chuyển sang kiểm tra kết nối, mã thiết bị và trạng thái kích hoạt |
| Support | “Mở license” đổi sang Customer shell | Bỏ hành động trùng với ngữ cảnh đang hiển thị; không đổi role ngầm |
| System | Tên trang không phản ánh nhật ký; bộ lọc chưa hoạt động | “Giám sát & nhật ký”; Users/Payments/Blockchain; empty state thanh toán |
| System | Thời gian và actor dính nhau | Tăng gap, căn hàng sự kiện |
| Dashboard | 18/25 thiết bị không có phạm vi rõ | Bỏ mẫu số sai; thống nhất mẫu 3 bản quyền, 19 thiết bị = 14 + 4 + 1 |
| Provider readiness | Chưa sẵn sàng bán nhưng đã có doanh thu | Giới hạn vào DataGuard SDK; checklist 3/5, sản phẩm/gói chưa công bố |
| Responsive | Chữ tablet chồng nhau; không có cách đóng rõ | Content stack, scrim, nút đóng, Escape, mẫu mở/đóng; menu 44 px |
| Responsive roles | Chỉ có Customer | Thêm mobile drawer mở/đóng Provider, Support, System; footer tài khoản co giãn |
| Badge/icon | Nhãn vượt khung, icon vượt kích thước instance | Badge hug; icon SCALE; đọc lại xác nhận 16/20 px |

## 2. Kế hoạch chi tiết và prompt sửa

Mỗi vùng theo đúng chuỗi: **kiểm tra → viết yêu cầu sửa → kiểm tra cấu trúc → kiểm tra ảnh và sửa tiếp**. Các prompt dưới đây ghi lại yêu cầu sửa và dùng được khi tái thực hiện/tiếp tục.

### Câu hỏi bắt buộc trước khi thiết kế

1. Người dùng muốn hoàn thành việc gì ở đây?
2. Thành phần này có giúp quyết định hoặc thao tác ngay lúc này không?
3. Nó có lặp menu, tab, thông tin hay CTA khác không?
4. Nội dung chỉ để đọc có bị trình bày như ô nhập không?
5. Nếu là ô nhập, nhãn có cần để hiểu và sử dụng bằng bàn phím không?
6. Các trường có quan hệ gì để nhóm chúng hợp lý?
7. Bấm vào có đúng sản phẩm, role và trạng thái không?
8. Kết quả thao tác và cách quay lại có rõ không?

Không loại bỏ nhãn input máy móc. Email, mật khẩu, giá, thời hạn và số thiết bị vẫn cần nhãn. Cần tránh biến mọi thông tin thành chuỗi nhãn–ô nhập hoặc dùng nhiều điều khiển cho cùng một quyết định.

### Prompt A — Điều hướng và kiến trúc thông tin

> Đọc characters, visible của toàn bộ tổ tiên và reactions. Giữ một cấp sidebar theo role; xóa đúng submenu cũ đã xác nhận. Phân biệt trang, tab và bộ lọc. Mọi đích phải tồn tại; mục active không cần self-navigation. Không cho Public/Support nhảy vào Customer shell ngầm. Giữ IBM Plex Sans và token hiện có. Đọc lại destinationId và chụp sidebar đại diện sau sửa.

Điều kiện kiểm tra: 88 mục Customer/Provider được rà; không có link sidebar sai đích; không còn submenu cũ được xác định hoặc Selected Indicator trực tiếp trên page.

### Prompt B — Catalog và mua hàng

> Mỗi sản phẩm giữ đúng tên, giá, thời hạn, thiết bị và minh họa qua tất cả bước. Nếu hai CTA cùng đích thì giữ một CTA rõ. Public mua hàng qua login/register có ngữ cảnh; submit tiếp tục đúng checkout. Customer giữ authenticated shell. Không dùng màn SecureDesk cho CloudStudio. Gói chưa công bố phải có lời giải thích, không để khoảng hành động trống.

Kiểm tra: catalog → detail → auth nếu cần → checkout → payment. Dữ liệu là mẫu thiết kế, chưa phải bảng giá thương mại được xác nhận.

### Prompt C — Form và drawer

> Màn mặc định là danh sách; form chỉ mở khi cần. Nhóm Tên gói–Sản phẩm, Chu kỳ–Giá, Thời hạn–Thiết bị theo quan hệ sử dụng. Dùng từ dễ hiểu thay YEARLY, Entitlements, Terms binding. Cảnh báo ngắn và đặt gần quyết định công bố. Có Đóng/nền/Escape. Không gắn reaction đóng lên toàn bộ drawer.

Kiểm tra: danh sách không bị che mặc định; cảnh báo/footer không bị cắt; click nội dung không tự đóng. Lưu nháp/Công bố còn cần trạng thái xác thực và phản hồi riêng, xem mục 6.

### Prompt D — Bảng và tổng thanh toán

> Đo tổng cột, padding và gap. Giữ mã, tiền, trạng thái đọc được ở bảng hẹp; cho sản phẩm/gói co giãn. Header phải khớp dữ liệu. Nhãn không chiếm hết chiều rộng khiến đơn vị tiền hoặc số thiết bị bị cắt. Nếu override instance không được giữ, sửa component gốc rồi kiểm tra các màn dùng chung.

Kiểm tra hai lần: đọc kích thước trong một lần gọi mới và xem ảnh. Không kết luận thành công chỉ vì lệnh resize đã chạy.

### Prompt E — Support và System

> Support là một workspace với All/Mine, trạng thái và người phụ trách rõ. Có Hoàn tất/Mở lại; ẩn ô soạn và chèn nội dung khi kết thúc. Gợi ý AI phải phù hợp hạn mức thực. System phân biệt giám sát với bộ lọc sự kiện; Users không phải màn phân quyền. Bộ lọc rỗng cần empty state. Không tự cấp quyền retry/đối soát từ suy luận UI.

### Prompt F — Tài khoản và responsive

> Tài khoản mở menu; Đăng xuất là nút riêng. Drawer phủ nội dung bằng scrim, không đẩy tiêu đề vào cột hẹp. Có mở/đóng, nút đóng, nền và Escape; menu cao ít nhất 44 px. Footer dùng spacer co giãn để không ra khỏi đáy. Focus dùng stroke token, phân biệt hover/active. Kiểm tra bốn role.

Giới hạn: mẫu navigation responsive không thay thế layout mobile/tablet hoàn chỉnh cho toàn bộ nghiệp vụ.

## 3. Tự kiểm tra vòng 1 — Cấu trúc, nội dung, điều hướng

| Kiểm tra | Kết quả và phạm vi |
|---|---|
| Frame web | 36 frame mang tiền tố Screens/Web |
| Sidebar | 88 mục Customer/Provider; không phát hiện destination sai so với bảng đích thiết kế |
| Đăng ký public | W02/W03/W04 → W20, đúng từ đầu vòng này |
| SecureDesk public | W03 → login/register SecureDesk → W06 → W07 |
| CloudStudio public | W24 → login/register CloudStudio → W22 → W23 |
| CloudStudio Customer | W18 → W21 → W22 → W23 |
| Order detail | W08 → ORD-2026-0218; Đóng → W08; Thanh toán → W07 |
| Tạo gói | W13 Default → Create; Đóng/nền/Escape → Default |
| Support | All ↔ Mine; Hoàn tất → Resolved; Mở lại → đang xử lý |
| System | All ↔ Users/Payments/Blockchain; cảnh báo → Blockchain |
| Cấu trúc cũ | Không còn submenu cũ đã xác định hoặc indicator trực tiếp trên page |
| Tràn text | Lần cuối không phát hiện text có nội dung và tổ tiên visible vượt khung cha quá 2 px trên 36 frame web |
| Dở dang | Không còn placeholder/shimmer trên page tại thời điểm kiểm tra |

Phép đo tràn khung không chứng minh toàn bộ accessibility, tương phản, responsive hay tương tác đã đạt.

## 4. Tiếp tục tự kiểm tra vòng 2 — Ảnh và tính nhất quán

Đã xem ảnh các vùng chính: catalog public/Customer, product detail, auth có ngữ cảnh, checkout/payment, danh sách/drawer đơn, dashboard, hồ sơ Provider, sản phẩm/gói, drawer tạo gói, vận hành, Support, System và navigation responsive.

Các lỗi phát hiện trong vòng hai và đã sửa tiếp:

- Override chiều rộng instance không được giữ: sửa component gốc.
- Header lệch cột sau khi đổi component: căn lại Customer/Provider.
- Cảnh báo tạo gói quá dài: rút gọn.
- Reaction đóng gắn lên toàn order drawer: xóa khỏi panel, gắn đúng nút đóng/thanh toán.
- CloudStudio vẫn có khiên SecureDesk: thay minh họa.
- All events dùng chip như nút: thay Button.
- Hội thoại hoàn tất vẫn cho Chèn gợi ý: ẩn cùng ô soạn.
- Bộ số liệu dashboard không khớp W09: thống nhất mẫu 3 bản quyền/19 thiết bị.
- Hai hàng đơn gần đây Provider tràn dọc: tăng chiều cao.
- Footer tài khoản Provider mobile ra khỏi khung: spacer co giãn, chụp lại xác nhận.
- Badge dài và icon vượt biên: hug/SCALE, đọc lại kích thước.

Reactions được kiểm tra bằng cấu trúc; các vùng chính được xem bằng screenshot. Chưa chạy bài kiểm thử tương tác đầy đủ trong trình phát prototype, chưa kiểm thử screen reader/focus trap của ứng dụng thật.

## 5. Menu → trang → chức năng → phạm vi role

Đây là bản đồ thiết kế, **không phải bằng chứng phân quyền backend**.

| Role / menu | Trang | Chức năng | Phạm vi UI |
|---|---|---|---|
| Customer / Trang chủ | W05 | Tổng quan và việc cần làm | Tài khoản hiện tại |
| Customer / Sản phẩm & gói | W18; W19/W21 | Duyệt/chọn gói | Customer shell |
| Customer / Đơn hàng & thanh toán | W08; W06/W07/W22/W23 | Đơn và thanh toán | Đơn khách hàng |
| Customer / Bản quyền & thiết bị | W09 | Theo dõi bản quyền/thiết bị | Tài khoản khách hàng |
| Customer / Hỗ trợ & AI | W10 | Hội thoại | Khách hàng |
| Provider / Trang chủ | W11 | Doanh thu, hàng đợi | Doanh nghiệp |
| Provider / Sản phẩm & gói | W13 Products/Default/Create | Sản phẩm, gói, tạo gói | Danh mục doanh nghiệp |
| Provider / Đơn hàng & vận hành | W15 | Đơn, tác vụ, giao dịch cần xem | Quyền thực thi cần đối chiếu |
| Provider / Kho tri thức AI | W14 | Tài liệu | Doanh nghiệp |
| Provider / Tài khoản → Hồ sơ doanh nghiệp | W12 | Hồ sơ và sẵn sàng mở bán | Doanh nghiệp |
| Support / Trung tâm hỗ trợ | W16 All/Mine/Resolved | Hội thoại | Workspace Support, không đổi role ngầm |
| System / Giám sát & nhật ký | W17 All/Users/Payments/Blockchain | Dịch vụ và sự kiện | Quan sát/tra cứu; không suy ra quyền đổi License/Device |
| Public / Hỗ trợ | Public Help | Hướng dẫn đăng nhập | Khách vãng lai |

Screen Spec đã làm rõ /customer/products và các route chi tiết/checkout theo sản phẩm. Đây là **ý định thiết kế**, chưa xác nhận route trong ứng dụng hiện có.

## 6. Các vấn đề còn mở — không đánh dấu hoàn tất

### R1 — Quyền vận hành/đối soát cần nguồn nghiệp vụ hoặc repository

Chưa xác nhận ai được retry, đối soát, phê duyệt và phạm vi doanh nghiệp. W15 dùng ngôn ngữ chỉ xem trạng thái, “Xem giao dịch lệch”; không thêm quyền thực thi giả định. Màn quản lý người dùng/phân quyền độc lập chưa được thiết kế; Users ở W17 chỉ là bộ lọc sự kiện.

**Việc tiếp theo:** đối chiếu policy/API trước, rồi thiết kế quyền xem/thực thi, xác nhận, lỗi và audit cho từng hành động.

### R2 — Prototype nghiệp vụ chưa hoàn chỉnh

Các luồng chính đã sửa không đồng nghĩa mọi nút đều hoạt động.

| Nhóm | Phần còn cần làm |
|---|---|
| W04 | Xóa/Xác minh; initial/loading/not found/network error |
| Product detail | Nội dung/đích của tab Tài liệu |
| W08/W09 | Bộ lọc, chi tiết các bản ghi khác, sao chép và quản lý thiết bị |
| W10/W16 | Gửi/Chèn gợi ý; tiếp nhận, phân công, chuyển giao đầy đủ |
| W12/W13 | Lưu hồ sơ, nháp, công bố; validation; xác nhận; success/error |
| W14 | Upload/chọn file; xem tài liệu/phiên bản; tiến trình/lỗi |
| W15 | Hàng đợi/giao dịch lệch chi tiết, bộ lọc dữ liệu, xuất báo cáo |
| Chung | Thông báo, tìm kiếm/filter thực, export/download, clipboard, phản hồi mạng |

Không nối các nút này tới màn không liên quan chỉ để có reaction. Nút đang active không có reaction là bình thường và không được tính như một hành động lỗi.

**Prompt tiếp tục:**

> Với từng nhóm, xác định đầu vào, kết quả và lỗi. Tạo đủ empty/loading/success/error cần thiết, nối cả đường đi và quay lại. Không giả lập thành công thanh toán/công bố như dữ liệu thật. Không thay tác vụ bằng điều hướng dashboard. Kiểm tra cấu trúc rồi ảnh; chỉ đóng issue khi cả trạng thái và phản hồi tồn tại.

### R3 — Nội dung và fixture cần chốt

- CloudStudio 1.890.000 ₫ lấy từ catalog; Starter 1 tháng/3 thiết bị từ danh mục gói. Đã nối nhất quán trong luồng mẫu nhưng chưa có bảng giá chính thức để xác nhận tổ hợp thương mại này.
- DataGuard chưa mở bán theo v2 nháp; cần xác nhận quy tắc khi còn đơn/bản quyền lịch sử.
- Cần fixture chung theo mốc thời gian. Ví dụ ORD-2026-0218 ở Support nói đã thanh toán, trong luồng mua mẫu đang chờ; các snapshot chưa được giải thích thời điểm đầy đủ.
- Điều khoản, hoàn tiền, phiên bản và cơ chế chấp thuận cần nguồn được duyệt. Checkbox/đọc điều khoản chưa được nghiệm thu bằng prototype.

**Prompt tiếp tục:**

> Lập fixture chung cho sản phẩm, gói, đơn, thanh toán, bản quyền, hội thoại. Một ID có một trạng thái tại cùng thời điểm; nếu mô tả nhiều thời điểm phải đặt tên trạng thái rõ. Chỉ cập nhật giá/quyền/điều khoản từ nguồn được duyệt, không suy ra hợp đồng thương mại bằng cách ghép hai màn.

### R4 — Responsive/accessibility chưa nghiệm thu toàn ứng dụng

- Đã có drawer bốn role và Customer tablet; chưa có layout tablet/mobile đầy đủ cho mọi bảng, form, checkout, workspace.
- Menu mobile còn dẫn tới màn nghiệp vụ desktop: đây là mẫu navigation, không phải luồng mobile hoàn chỉnh.
- Đã gắn Escape/nền/nút đóng; chưa kiểm thử focus trap, trả focus, khóa cuộn nền, thứ tự Tab, screen reader trên ứng dụng thật.
- Có ví dụ focus ring; chưa có toàn bộ bộ state cho mọi sidebar/button/input.

**Prompt tiếp tục:**

> Thiết kế theo breakpoint thay vì thu nhỏ desktop. Chọn cột ưu tiên, đưa thông tin phụ vào detail, giữ CTA chính dễ chạm. Kiểm thử bàn phím/screen reader trên bản chạy thật. Figma là đặc tả hình ảnh và luồng, không thay kiểm thử accessibility.

## 7. Acceptance gates

| Gate | Kết quả |
|---|---|
| Điều hướng sai đích trong audit | Đã kiểm tra/sửa đường chính; nghiệp vụ toàn diện còn R2 |
| Menu trùng/cấu trúc cũ | Đã dọn các submenu được xác định; phân biệt tab/filter chính |
| Bản đồ menu/trang/chức năng/quyền | Có bản đồ thiết kế; quyền backend chưa xác minh |
| Provider/System retry/đối soát | Chưa đạt — R1 |
| Navigation state/responsive | Có mẫu bốn role, mở/đóng/focus; chưa nghiệm thu toàn ứng dụng — R4 |
| Visual | Hai vòng, không tràn text trong phép đo đã nêu; không suy rộng thành toàn bộ accessibility đạt |

**Trạng thái chốt: đã sửa trực tiếp đáng kể; chưa nghiệm thu toàn bộ.** Giữ R1–R4 mở cho tới khi có bằng chứng tương ứng.

## 8. Mở nhanh các vùng đã sửa

| Vùng | Figma |
|---|---|
| Customer Catalog | [W18](https://www.figma.com/design/ys1A2io0Ozz1TvR2o9S4Nb/KLTN?node-id=418-697) |
| CloudStudio detail/checkout/payment | [W21](https://www.figma.com/design/ys1A2io0Ozz1TvR2o9S4Nb/KLTN?node-id=452-908) · [W22](https://www.figma.com/design/ys1A2io0Ozz1TvR2o9S4Nb/KLTN?node-id=452-1016) · [W23](https://www.figma.com/design/ys1A2io0Ozz1TvR2o9S4Nb/KLTN?node-id=452-1301) |
| Danh sách đơn | [W08](https://www.figma.com/design/ys1A2io0Ozz1TvR2o9S4Nb/KLTN?node-id=51-453) |
| Tạo gói | [W13 Create](https://www.figma.com/design/ys1A2io0Ozz1TvR2o9S4Nb/KLTN?node-id=450-729) |
| Sản phẩm Provider | [W13 Products](https://www.figma.com/design/ys1A2io0Ozz1TvR2o9S4Nb/KLTN?node-id=456-1205) |
| Support | [W16](https://www.figma.com/design/ys1A2io0Ozz1TvR2o9S4Nb/KLTN?node-id=54-838) · [Resolved](https://www.figma.com/design/ys1A2io0Ozz1TvR2o9S4Nb/KLTN?node-id=463-1281) |
| System | [W17](https://www.figma.com/design/ys1A2io0Ozz1TvR2o9S4Nb/KLTN?node-id=54-965) |
| Responsive Customer | [Navigation](https://www.figma.com/design/ys1A2io0Ozz1TvR2o9S4Nb/KLTN?node-id=418-1018) |
| Responsive các role | [Provider](https://www.figma.com/design/ys1A2io0Ozz1TvR2o9S4Nb/KLTN?node-id=471-1174) · [Support](https://www.figma.com/design/ys1A2io0Ozz1TvR2o9S4Nb/KLTN?node-id=471-1344) · [System](https://www.figma.com/design/ys1A2io0Ozz1TvR2o9S4Nb/KLTN?node-id=471-1386) |

---

# Phụ lục — Báo cáo vòng 3 nguyên bản

Giữ làm lịch sử. Các nhận định hiện trạng phía dưới có thể đã lỗi thời; ưu tiên kết quả vòng 4 phía trên.


# Audit vòng 3 — Bới lông tìm vết menu EmuKey

Mình đã truy cập lại được file Figma và phát hiện một vấn đề nghiêm trọng hơn chuyện đặt tên: cấu trúc layer, nội dung hiển thị và phân cấp menu đang không khớp nhau.

Lần này mình chưa sửa hay tinh gọn menu. Mục tiêu là tìm lỗi, xác định nguyên nhân và chỉ ra điều kiện cần đạt trước khi thiết kế tiếp.

Lỗi nghiêm trọng đã xác nhận

Provider: nhiều mục khác nhau đang dùng cùng một nội dung text.

Trong các frame Provider, layer tên `Subnav/Sản phẩm & gói`, `Subnav/Đơn hàng`, `Subnav/Thanh toán`, `Subnav/Bản quyền`, `Subnav/Kho tri thức` đều chứa text được ghi là `Giao dịch cần xử lý`.

Ngoài ra, frame W13 và W15 vẫn giữ thêm submenu cũ bên dưới cấu trúc mới, khiến cùng một chức năng xuất hiện hai lần.

Đây là lỗi của chính bản thiết kế hiện tại, không phải đề xuất cải tiến mang tính chủ quan.

Đính chính sau khi kiểm tra sâu: text thực sự hiển thị trên Provider là đúng (`Sản phẩm & gói`, `Đơn hàng`, `Thanh toán`...). Lỗi nằm ở tên các text layer vẫn giữ nội dung cũ. Vì vậy, đây là lỗi cấu trúc và khả năng bảo trì, không phải lỗi người dùng nhìn thấy toàn bộ menu bị lặp chữ.

Tuy nhiên, các submenu cũ còn sót và vấn đề trùng chức năng vẫn cần kiểm tra riêng ở mức hiển thị.

## 1. Lỗi chặn nghiệm thu — P0

P0.1 — Điều hướng Customer sai hàng loạt

Đã xác minh

Đọc trực tiếp các prototype reactions trong 7 sidebar Customer.

|
Người dùng bấm

|

Prototype đang mở

|

Đích cần có

|
\| --- | --- | --- |
|

Sản phẩm & gói

|

W08 — Đơn hàng

|

W18 — Customer Catalog

|
|

Đơn hàng & thanh toán

|

W09 — Bản quyền

|

W08 — Đơn hàng

|
|

Bản quyền & thiết bị

|

W10 — Hỗ trợ

|

W09 — Bản quyền

|
|

Hỗ trợ & AI

|

Chưa gắn liên kết

|

W10 — Hỗ trợ

|

Các lỗi này xuất hiện trên nhiều màn hình. Ở W18, bấm chính mục `Sản phẩm & gói` đang được active cũng chuyển sang Đơn hàng.

Ngoài ra, `Trang chủ` trong W18 chưa có liên kết quay lại W05.

P0.2 — Đăng ký dẫn sai màn hình

Đã xác minh

|
Vị trí

|

Đích của nút Đăng ký

|
\| --- | --- |
|

W02 — Public Catalog

|

W03 — Chi tiết sản phẩm

|
|

W03 — Product Detail

|

W06 — Checkout

|
|

W04 — Verification

|

W03 — Chi tiết sản phẩm

|

Nút Đăng ký không dẫn đến trạng thái đăng ký trong Auth. Một người chưa đăng nhập có thể bị đẩy thẳng đến quy trình mua hàng trong prototype.

P0.3 — Luồng mua sản phẩm trỏ sai ngữ cảnh

Đã xác minh

- Trong Customer Catalog W18, nút `Xem chi tiết` của cả SecureDesk và CloudStudio đều trỏ đến W03, là màn hình chi tiết SecureDesk dùng public header.
- `Chọn gói` của nhiều sản phẩm cùng trỏ đến W06, nơi screen spec đang đặt theo gói Business.
- Nút `So sánh gói` tại W03 lại dẫn thẳng đến Checkout.

Điều này gây nguy cơ chọn CloudStudio nhưng xem chi tiết hoặc mua nhầm SecureDesk. Luồng đi từ Customer Catalog sang màn hình public cũng phá vỡ tính nhất quán của authenticated shell trong prototype.

P0.4 — Provider, Support, System thiếu điều hướng prototype

Đã xác minh

Provider Dashboard W11 có `Trang chủ` trỏ nhầm W12 — Cài đặt doanh nghiệp. Hầu hết các mục Provider còn lại chưa có prototype reaction.

Hai menu Support và các mục System Admin cũng chưa được gắn liên kết. `Hồ sơ · Đăng xuất` trong authenticated header là text hiển thị, chưa có các vùng tương tác riêng.

Đây là kết quả kiểm tra prototype Figma; chưa thể từ đó kết luận các route trong ứng dụng thật có lỗi tương ứng.

## 2. Lỗi kiến trúc thông tin — P1

Đây là những vấn đề khiến người dùng khó hiểu menu, ngay cả sau khi sửa toàn bộ liên kết.

P1.1 — Provider có ba tầng điều hướng trùng nhau

Đã xác minh

Không dùng ảnh minh họa này làm bằng chứng; kết luận dựa trên việc kiểm tra trực tiếp frame W13 và W15.

Trong W15, cùng lúc xuất hiện:

|
Vị trí

|

Nội dung

|
\| --- | --- |
|

Sidebar chính

|

Đơn hàng, Thanh toán, Bản quyền, Blockchain, Báo cáo

|
|

Submenu cũ

|

Lặp lại năm chức năng trên

|
|

Tab trong trang

|

Tiếp tục lặp lại năm chức năng

|

W13 cũng có tình trạng tương tự: `Sản phẩm & gói` ở sidebar, `Sản phẩm / Gói bản quyền` ở submenu cũ, rồi tiếp tục có hai tab tương ứng trong nội dung.

Vấn đề: cùng một chức năng đang có nhiều điểm truy cập nhưng không xác định được điểm nào là navigation chính, điểm nào là tab trạng thái.

P1.2 — Nhóm chức năng chưa nhất quán

|
Nhóm hiện tại

|

Vấn đề

|
\| --- | --- |
|

BÁN HÀNG

|

Chứa cả quản lý vòng đời bản quyền, không chỉ bán sản phẩm

|
|

NỘI DUNG AI

|

Chỉ chứa Kho tri thức; thêm một tiêu đề nhưng chưa tạo phân cấp thực sự

|
|

HỆ THỐNG

|

Chứa cả Báo cáo kinh doanh và Blockchain

|
|

Blockchain & tác vụ

|

Gộp thông tin giám sát với hành động vận hành

|

Các tiêu đề nhóm thực chất là text tĩnh, không phải menu cha có khả năng mở/đóng. Việc đặt tên layer `Subnav` không biến chúng thành submenu thực sự.

P1.3 — Ranh giới quyền Provider/System chưa rõ

Provider W15 đang hiển thị hàng đợi lệnh Blockchain và đối soát thanh toán. System Admin cũng có các mục tác vụ, retry và đối soát.

Cần xác định ai được xem, ai được thực hiện và ai được phê duyệt những thao tác này. Đặc biệt, không nên quyết định vị trí của chức năng retry trước khi xác minh quyền thực tế trong repository.

P1.4 — System Admin hứa nhiều hơn số màn hình đã thiết kế

Cần đối chiếu

Trong page web hiện tại, System Admin có một screen W17, nhưng sidebar đưa ra nhiều đích riêng:

|
Menu

|

Mức độ được thể hiện

|
\| --- | --- |
|

Giám sát hệ thống

|

Có screen

|
|

Người dùng & phân quyền

|

Chưa xác minh được screen quản lý riêng

|
|

Cần xử lý / Đối soát

|

Chưa xác minh được screen riêng

|
|

RPC & finality

|

Có thông tin trạng thái trong console

|
|

Tác vụ & retry

|

Có thông tin liên quan, chưa xác minh giao diện riêng

|
|

Nhật ký kiểm toán

|

Đang xuất hiện ngay trong màn hình giám sát

|

Phần lớn diện tích W17 hiện dành cho Audit Stream, trong khi tên trang là Giám sát hệ thống và sidebar còn có mục Nhật ký kiểm toán riêng.

Cần phân biệt rõ trang nghiệp vụ, tab lọc sự kiện và trang chi tiết, tránh khiến ba loại này trở thành các đích điều hướng ngang hàng.

P1.5 — Support thiếu mô hình trạng thái hội thoại

Cần xác định

W16 có hai menu `Hàng đợi hỗ trợ` và `Hội thoại của tôi`, nhưng cả hai dường như cùng phục vụ một workspace. Màn hình đang active ở Hàng đợi vẫn hiển thị hội thoại có nhân viên đang trả lời.

Thiết kế chưa thể hiện rõ điểm chuyển giữa tiếp nhận, phân công, xử lý và hoàn tất. Nếu hai menu chỉ thay đổi bộ lọc của một danh sách thì nên xem chúng là trạng thái trong workspace, không phải hai trang toàn cục.

P1.6 — Public và Customer thiếu thống nhất thuật ngữ

Cần chuẩn hóa

|
Chức năng

|

Các nhãn đang dùng

|
\| --- | --- |
|

Kiểm tra License

|

Xác thực bản quyền / Xác minh License

|
|

Catalog

|

Sản phẩm / Sản phẩm & gói / Khám phá sản phẩm

|
|

Hỗ trợ

|

Hỗ trợ / Hỗ trợ & AI / Trợ lý AI & hỗ trợ

|
|

Vòng đời bản quyền

|

License / Bản quyền

|

Public có nút `Hỗ trợ`, nhưng chưa có liên kết và chưa thấy màn hình hỗ trợ khách vãng lai trong nhóm web hiện tại.

Một điểm nữa: W02 và W18 cùng ghi route `/products` trong Screen Spec. Điều này có thể hợp lệ nếu ứng dụng chọn shell theo trạng thái đăng nhập, nhưng quy tắc đó chưa được xác minh.

## 3. Lỗi UI và khả năng bảo trì — P2

Mình còn phát hiện những điểm nhỏ nhưng có thể tạo lỗi khi đưa thiết kế sang code.

|
Phát hiện

|

Bằng chứng

|

Mức độ

|
\| --- | --- | --- |
|

Customer Catalog bị cắt card

|

Trust Card vượt giới hạn hero 13 px; mép phải bị cắt trong screenshot

|

P1

|
|

CTA tự lặp

|

Đã ở Catalog nhưng hero vẫn có nút “Khám phá sản phẩm”; thực tế lại mở chi tiết SecureDesk

|

P1

|
|

Tablet bị cắt tiêu đề

|

Tiêu đề vượt khỏi frame 480 px

|

P1

|
|

Responsive chưa phủ mọi role

|

Chỉ có ví dụ drawer Customer, thiếu Provider/Support/System

|

P2

|
|

Thiếu trạng thái tương tác

|

Chưa có đặc tả đầy đủ cho focus, expanded/collapsed và thao tác đóng drawer

|

P2

|
|

Account chưa tách hành động

|

“Tài khoản · Đăng xuất” nằm chung trong text

|

P1

|
|

Email còn trong sidebar cũ

|

W07, W08 và một số frame Provider vẫn chứa email dù đã có account header

|

P2

|
|

Layer đặt tên cũ

|

Nhiều layer vẫn mang tên nội dung trước khi sửa, dù text hiển thị đã đúng

|

P2

|
|

Node rơi ngoài cấu trúc

|

Bốn Selected Indicator còn nằm trực tiếp ở page, không thuộc sidebar nào

|

P2

|

Riêng responsive, mình chưa thể xác nhận khả năng đóng drawer bằng Escape, giữ focus, khóa cuộn nền hay trở về trang trước. Đây hiện là bản mô tả ý định thiết kế, chưa phải prototype đủ điều kiện nghiệm thu accessibility.

## 4. Vậy “Trang chủ” hiện đã hợp lý chưa?

Sau khi xem nội dung thật, mình xác nhận Customer Trang chủ đã có mục đích khá rõ: việc cần làm, License đang sử dụng, đơn gần đây và hỗ trợ nhanh.

Tuy nhiên, một điểm dữ liệu cần giải thích: KPI ghi `18/25 thiết bị`, trong khi các License bên dưới có `14/25` và `4/10`. Nếu đây là tổng tài khoản, mẫu số cần được định nghĩa; nếu tính theo từng License, không nên cộng hai mẫu số khác nhau một cách mơ hồ.

Provider Trang chủ cũng có doanh thu, đơn hàng, hàng đợi và trạng thái Blockchain. Nhưng thông báo “Còn 2 bước để sẵn sàng publish” xuất hiện cùng doanh thu và 186 License đang hoạt động. Cần cho biết thông báo áp dụng cho sản phẩm mới, tài khoản hay một quy trình cụ thể.

Như vậy, vấn đề không còn đơn thuần là tên `Trang chủ` mà là dữ liệu và hành động trên trang phải chỉ rõ chúng thuộc phạm vi nào.

## 5. Điều kiện bắt buộc trước khi tinh gọn

## Acceptance gates

0/6

Sửa toàn bộ prototype navigation sai đích

Đặc biệt là Customer, Đăng ký và luồng chọn sản phẩm.

Xóa hoặc hợp nhất menu trùng

W13 và W15 không được đồng thời có nhiều tầng menu cho cùng một chức năng.

Lập bảng menu → trang → chức năng → quyền

Mọi menu phải có đích được chứng minh; phân biệt route, tab và filter.

Xác định quyền Provider/System

Đối soát, retry và các lệnh Blockchain phải có chủ thể rõ ràng.

Đặc tả trạng thái navigation

Active, hover, focus, expanded, collapsed, mobile drawer và account menu.

Sửa lỗi visual và kiểm tra lại

Không crop nội dung, không còn node thừa; review desktop/tablet/mobile.

Đây là checklist kiểm soát tiến độ; việc đánh dấu không thay thế kiểm thử Figma và repository.

## Kết luận kiểm toán

Chưa đạt nghiệm thu

Thiết kế hiện tại có lỗi điều hướng thực tế, trùng chức năng, thiếu định nghĩa trang đích và chưa hoàn chỉnh trên responsive.

Kết quả PASS của các vòng trước không còn đủ cơ sở để dùng làm kết luận cuối cùng. Mình chưa thay đổi canvas trong vòng audit này. Cần xử lý các lỗi P0 và chốt quyền, trang đích trước khi tiếp tục quyết định mục nào nên giữ, gộp hoặc chuyển thành submenu.