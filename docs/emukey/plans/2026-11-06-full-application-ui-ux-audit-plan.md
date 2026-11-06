# Kế hoạch kiểm tra, cải thiện và nghiệm thu UI/UX toàn ứng dụng EmuKey

> Dành cho người thực hiện: dùng workflow `executing-plans`, làm lần lượt từng đợt và cập nhật bằng chứng. Chỉ dùng subagent khi có quyền và công cụ phù hợp. Các ô chưa đánh dấu bên dưới là công việc tương lai, chưa thực hiện.

**Mục tiêu:** cải thiện giao diện và khả năng hoàn thành tác vụ của từng vai trò, trên web và app quản lý, có ảnh thực tế và kiểm thử trước/sau để chứng minh.

**Kiến trúc thực hiện:** giữ React + Ant Design + TanStack Query, mở rộng các layout/component/token đang có. Audit bằng trình duyệt thật, sửa theo nhóm có phạm vi rõ ràng; không thiết kế lại từng trang một cách độc lập.

**Công nghệ đã thấy trong manifest:** React 19.2.8, React Router 7.18.3, Ant Design 6.6.2, TanStack Query 5.102.8, Vite 8.2.2, Playwright 1.62.1; mobile React Native 0.86.3 và Expo `~57.0.32`. Khi bắt đầu thực hiện phải đối chiếu lockfile và phiên bản thực sự cài.

**Đặc tả:** nội dung “AUTONOMOUS FULL-APPLICATION UI/UX AUDIT, REDESIGN & VERIFICATION” người dùng gửi ngày 06/11/2026. Bản nguồn: `C:/Users/thong/.codex/attachments/597fd620-85fa-4026-a5bc-a750a505416f/Pasted text.txt`. Tài liệu này giữ đầy đủ phạm vi và điều kiện nghiệm thu cần thiết để không phụ thuộc vào tuổi thọ attachment.

**Giới hạn lượt hiện tại:** chỉ viết kế hoạch. Chưa mở ứng dụng để audit, chưa chụp ảnh UI ứng dụng, chưa chạy bộ test và chưa sửa source theo kế hoạch này. Không suy diễn chất lượng UI hiện tại từ việc đọc code.

## 1. Phạm vi và nguyên tắc

- Repo ngoài có remote `crchinhle/MCP_API`; sản phẩm nằm trong `EmuKey/`, có Git repo riêng. Không clone thêm một ứng dụng hoặc tạo frontend mới.
- Audit toàn bộ web: khách chưa đăng nhập và bốn vai trò thực tế `CUSTOMER`, `PROVIDER_ADMIN`, `SUPPORT_STAFF`, `SYSTEM_ADMIN`.
- Audit app quản lý `EmuKey/mobile` thành đợt riêng; hiện API client native chỉ nhận `CUSTOMER`. Không thêm chức năng quản trị cho mobile vì tên gọi “manager”.
- App Kotlin `license-client` là demo ngoài phạm vi đồ án theo quyết định của người dùng; không đưa vào lần redesign này hoặc sơ đồ.
- Kiểm tra mọi route, biến thể query/tab và trạng thái có ý nghĩa. Không coi dùng chung component là đã kiểm tra đủ mọi vai trò.
- Giữ thương hiệu, tính năng, hợp đồng API, quyền truy cập và quy tắc nghiệp vụ hiện hành. Chỉ đề xuất sửa backend khi có lỗi UI đã tái hiện và chứng minh nguyên nhân nằm ở backend; tách công việc đó thành mục riêng.
- Không reset/drop DB để có dữ liệu đẹp. Không chạy initializer trên DB hiện có; chỉ khởi tạo DB test rỗng, riêng biệt nếu cần.
- Không sửa `KLTN.drawio` trong kế hoạch UI/UX này. Nếu cách điều hướng thực sự thay đổi sau triển khai, ghi yêu cầu đồng bộ tài liệu vào báo cáo cuối.
- Không tự commit, push, deploy, thay quyền người thật hoặc gửi email/thông báo tới người thật. Tài khoản và thao tác có tác dụng phụ phải thuộc fixture/test sandbox.
- Mọi thay đổi đang có ở cả hai repo là baseline người dùng; không đưa chúng vào kết luận là kết quả của audit UI.

**Hướng triển khai được chọn:** audit toàn phạm vi trước, sau đó sửa thành phần dùng chung và từng luồng. Cách chỉ đổi CSS nhanh sẽ không giải quyết điều hướng/trạng thái; cách thay toàn bộ UI một lượt có phạm vi hồi quy quá rộng. Kế hoạch này cho phép nghiệm thu từng đợt độc lập.

## 2. Căn cứ đã đọc và những điểm cần kiểm tra

| Nguồn đang có | Vai trò trong kế hoạch |
| --- | --- |
| `EmuKey/frontend/src/presentation/app/App.tsx` | Route thực tế, guard, màn 403/404, bootstrap phiên |
| `EmuKey/frontend/src/presentation/components/RoleShell.tsx` | Menu theo vai trò, query `view`, menu mobile |
| `EmuKey/frontend/src/presentation/components/CustomerLayout.tsx` | Khung người mua |
| `EmuKey/frontend/src/presentation/theme.ts`, `styles.css` | Nguồn token/style cần mở rộng |
| `EmuKey/backend/src/modules/identity-access/identity.types.ts` | Bốn role, trạng thái tài khoản; đối chiếu thêm guard/controller của từng thao tác |
| `EmuKey/mobile/src/presentation/EmuKeyMobileApp.tsx`, `infrastructure/api/client.ts` | Native navigation, xác thực và ranh giới CUSTOMER |
| `tests/emukey/frontend/`, `tests/emukey/e2e/web/` | Bộ kiểm thử chức năng có sẵn |
| `tooling/emukey/verification/frontend-scripts/visual-regression.mjs` | Công cụ chụp hiện có, mở rộng thay vì viết runner song song |
| `docs/emukey/evidence/visual-regression/route-map.json` | Danh mục lịch sử để đối chiếu; không phải bằng chứng hiện hành |
| `EmuKey/README.md`, `context/current/HDSD.md` | Cách chạy, môi trường, các giới hạn nghiệp vụ cần kiểm tra lại theo source |

Các khoảng trống đã thấy ở công cụ, chưa phải lỗi UI đã xác nhận:

- Runner visual hiện lọc bỏ route chứa `:`; cần gắn ID/slug fixture để chụp chi tiết, thanh toán, gia hạn.
- Runner hiện chỉ có desktop 1440×1024 và mobile 390×844; chưa đáp ứng desktop 1440×900, tablet 768×1024 của đặc tả.
- Runner không thiết lập phiên riêng theo role và chưa assert màn đích sau điều hướng; có nguy cơ ảnh đăng nhập bị tính thành ảnh màn bảo vệ.
- Route map cũ ghi `/` là `CatalogScreen`, trong source hiện tại là `PublicHomeScreen`. Trạng thái `VERIFIED` lịch sử không được tự kế thừa sang đợt mới.
- Một số E2E hiện chặn API bằng `page.route`. Chúng hữu ích cho trạng thái UI nhưng không chứng minh luồng backend/sandbox đã chạy thật.
- `ProviderDeliveryPanel` là panel được mở từ giao diện hỗ trợ/vận hành; không tự tạo một “trang theo dõi bàn giao” mới hoặc giả định có route riêng.
- Một số tài liệu/skill còn mô tả luồng cấp phép cũ. Khi mâu thuẫn, dùng quyết định gần nhất của người dùng và source hiện hành; không phục hồi chức năng kích hoạt demo vào sản phẩm.

## 3. Danh mục màn hình xuất phát

Danh mục này được lấy từ source để lập kế hoạch; đợt kiểm kê phải bổ sung menu, modal, drawer, query và route mới phát hiện khi chạy.

| Ngữ cảnh | Route/màn hình phải đưa vào coverage | Tương tác trọng tâm |
| --- | --- | --- |
| Khách | `/`, `/auth`, `/products`, `/catalog`, `/compare`, `/products/id/:productId`, `/products/:slug`, `/verify`, `/help` | Tìm/lọc/so sánh, chi tiết gói, đăng nhập/đăng ký/khôi phục phiên theo UI thực tế, tra cứu, tìm hướng dẫn |
| CUSTOMER | `/buyer`, `/buyer/products`, `/buyer/products/id/:productId`, `/buyer/products/:slug` | Tổng quan, lựa chọn sản phẩm/gói, giữ bộ lọc khi quay lại |
| CUSTOMER | `/buyer/checkout`, `/buyer/orders/:id/payment`, `/buyer/orders` | Điều khoản, tạo đơn, thanh toán, chờ xác nhận, tiếp tục đơn và quay về đơn đã mua |
| CUSTOMER | `/buyer/licenses`, `/buyer/licenses/:licenseId/renew`, `/buyer/support`, `/buyer/profile` | Nhận/xem thông tin bản quyền theo quyền, gia hạn, hỗ trợ, hồ sơ/đổi mật khẩu |
| PROVIDER_ADMIN | `/provider`, `/provider/catalog`, `/provider/licenses`, `/provider/operations`, `/provider/knowledge`, `/provider/profile` | Dashboard, form sản phẩm/gói, publish/version, license drawer, tích hợp/bàn giao, đối soát, tài liệu |
| SUPPORT_STAFF | `/support`, `/support?view=active`, `/support?view=resolved`, `/support/profile` | Hàng đợi, xem trước, nhận/trả/hoàn tất, hết lease, theo dõi bàn giao |
| SYSTEM_ADMIN | `/system/console`, các `?view=users`, `?view=payments`, `?view=blockchain`, `/system/console/knowledge`, `/system/console/profile` | Người dùng/lời mời, rà soát thanh toán, blockchain, tài liệu và vận hành |
| Dùng chung | Notifications, AI launcher, account menu, purchase modal, các dialog/drawer; 403/404/error boundary | Focus, đóng/mở, đường quay về, thông báo, session expired, thao tác không đủ quyền |
| Native CUSTOMER | Login; Catalog, ComparePlans, Checkout, Orders, OrderDetail, Licenses, Notifications, Payment, Profile, Renewal, VerifyLicense, Assistance | Điều hướng native, bàn phím, safe area, deep link, quay về từ thanh toán, khôi phục phiên |

`/catalog` và `/products` vẫn phải kiểm tra alias; `/products/id/:productId` và `/products/:slug` cần cả fixture hợp lệ lẫn không tồn tại. Query `view` không được bỏ qua khi đếm màn hình. Các query/tab khác phải đọc từ source và khám phá trong browser.

## 4. Đầu ra và nơi lưu

Giữ tên thư mục audit theo đặc tả người dùng; không chuyển source ứng dụng ra khỏi `EmuKey/`. Tái sử dụng helper trong `tooling/emukey` và test trong `tests/emukey`.

| Đầu ra dự kiến | Nội dung |
| --- | --- |
| `docs/ui-audit/environment.md` | Cách chạy, phiên bản thật, service readiness, giới hạn môi trường; chỉ ghi tên biến, không ghi secret |
| `docs/ui-audit/route-inventory.md` | Route template, màn/component, query/tab, entry point, API liên quan |
| `docs/ui-audit/role-matrix.md` | Role × xem × thao tác × phạm vi dữ liệu; nguồn guard/controller |
| `docs/ui-audit/progress.md` | Đợt đang làm, kết quả đã chạy, blocker, bước tiếp theo |
| `docs/ui-audit/coverage.json` | Coverage có cấu trúc cho từng tổ hợp role/route/state/viewport |
| `docs/ui-audit/issues.md`, `issues.json` | Issue có bằng chứng, mức độ, cách tái hiện, file sửa, nghiệm thu |
| `docs/ui-audit/design-system.md` | Quyết định token/layout/component đã đối chiếu hiện trạng |
| `docs/ui-audit/final-report.md` | Báo cáo cuối bằng tiếng Việt; số liệu sinh từ manifest, không nhập tỷ lệ ước đoán |
| `artifacts/ui-audit/<run-id>/before/{role}/{route}/{viewport}/{state}.png` và `after/...` | Ảnh browser thật; native có nhánh riêng theo device |
| `artifacts/ui-audit/<run-id>/manifest.json` | Metadata ảnh, nguồn dữ liệu, môi trường, lỗi, timestamp, liên kết coverage/issue |

`run-id` ngăn ghi đè các lần chạy. Thêm `/artifacts/ui-audit/` vào `.gitignore` trước khi sinh ảnh; đây là đầu ra được yêu cầu rõ trong đặc tả, không phải file source. Auth state chứa cookie/token lưu ngoài repo trong OS temp, không trộn với ảnh hoặc báo cáo. Không tạo các tài liệu kết quả rỗng trong lượt lập kế hoạch này.

Coverage record tối thiểu gồm `id`, `surface`, `role`, `routePattern`, `resolvedPath`, `queryVariant`, `state`, `viewport`, `dataMode`, `status`, `evidenceIds`, `issueIds`, `blocker`, `lastVerifiedRun`. Manifest thêm kích thước thực, browser/OS/version, locale, timezone, thời gian chụp, screenshot path, console/network errors đã che dữ liệu nhạy cảm.

Trạng thái: `DISCOVERED → PENDING → CAPTURED → AUDITED → FIXED → VERIFIED`. Mục không có lỗi đi từ `AUDITED` sang `VERIFIED` sau lượt kiểm tra cuối. `BLOCKED` phải có nguyên nhân và bước mở chặn; `NOT_APPLICABLE` phải có lý do. `FIXED` chưa được tính là đã nghiệm thu.

`dataMode`: `REAL_API`, `CONTROLLED_FIXTURE`, hoặc `SANDBOX_EXTERNAL`. Ảnh fixture là ảnh render thật với dữ liệu mô phỏng, chỉ chứng minh UI ở trạng thái đó. Không cộng nó vào chỉ tiêu hoàn tất tích hợp thật.

## 5. Đợt 0 — Chuẩn bị môi trường và baseline

**Đọc:** AGENTS, README, manifest/lockfile, `.env.example`, Compose, scripts và cấu hình test. **Tạo:** bốn tài liệu đầu tiên ở mục 4, sau khi tìm và xác nhận chưa có bản tương đương.

- [ ] Ghi Git status của workspace và nested repo, commit nền, danh sách file thay đổi sẵn. Không lưu nội dung secret trong baseline.
- [ ] Kiểm tra Node/Corepack/pnpm; chỉ cài dependency bằng lockfile hiện tại nếu thiếu, không nâng cấp framework để phục vụ audit.
- [ ] Xác định API/web đang chạy, tránh chiếm cổng hoặc kill tiến trình của người dùng. Dùng một `BASE_URL` nhất quán để không trộn localhost với 127.0.0.1 làm sai cookie/redirect.
- [ ] Kiểm tra API live/ready, PostgreSQL, Redis và worker riêng; API healthy không chứng minh worker đang xử lý.
- [ ] Đọc cấu hình cục bộ khi cần, ghi “đã có/chưa có” thay vì in giá trị; xác nhận sandbox trước mọi luồng SePay.
- [ ] Chuẩn bị tài khoản test đủ bốn role, hai provider và hai customer để kiểm tra ranh giới sở hữu. Dùng account state active/pending/locked/disabled khi chức năng có phân nhánh.
- [ ] Chuẩn bị dữ liệu nhận diện được theo audit run: catalog có/không kết quả, bản nháp/công bố, đơn chờ/thành công/hủy/hết hạn, bản quyền và delivery ở các trạng thái thực tế.
- [ ] Cho phép mô phỏng lỗi/độ trễ bằng interception trong context kiểm thử riêng; không tắt service dùng chung để tạo ảnh lỗi.
- [ ] Kiểm tra Chromium/Playwright và Android emulator/thiết bị; ghi rõ cái nào dùng được. Không coi browser mobile viewport là Android đã test.

**Nghiệm thu:** có thể mở màn public và đăng nhập từng role trên môi trường an toàn; mọi thiếu hụt đều có blocker cụ thể. Chưa sửa UI trong đợt này.

## 6. Đợt 1 — Hoàn thiện inventory và công cụ bằng chứng

**Mở rộng:** `docs/emukey/evidence/visual-regression/route-map.json`, `tooling/emukey/verification/frontend-scripts/visual-regression.mjs`, `tooling/emukey/verification/playwright.frontend.config.mjs`. Giữ đường chạy legacy còn được dùng; bổ sung chế độ audit thay vì phá hợp đồng hiện có. **Test mới nếu chưa có owner tương đương:** `tests/emukey/e2e/web/ui-audit.spec.ts` cho hành vi capture và assertion.

- [ ] Ghép inventory từ `App.tsx`, menu, redirect, query/tab và browser; xác định route màn đích khác route container.
- [ ] Đối chiếu role guard frontend với guard/controller backend và ownership. Ghi xem-only, retry, publish, revoke… thành quyền riêng.
- [ ] Tạo coverage cho cả ba viewport web: 1440×900, 768×1024, 390×844. Thêm 320px và zoom/text scaling vào màn có nguy cơ overflow.
- [ ] Mỗi route có normal/loading/empty/error/retry khi phù hợp; form thêm invalid/submitting/success/server validation, danh sách thêm search/filter/sort/pagination; dialog thêm open/keyboard/close/unsaved changes.
- [ ] Resolve route động bằng dữ liệu fixture thật; trường hợp thiếu fixture phải BLOCKED, không bỏ qua.
- [ ] Tách browser context/storage state theo role, account và dataMode; assert role phiên đăng nhập, URL cuối và marker màn đích trước khi chụp.
- [ ] Chờ marker nghiệp vụ và font sẵn sàng, không chỉ dùng `networkidle` với màn polling/chat. Tắt animation chỉ trong capture; kiểm tra motion riêng.
- [ ] Chụp full-page và viewport khi có sticky UI/modal; thu pageerror, console error và request failed. Phân biệt 401 bootstrap dự kiến với lỗi phát sinh ngoài dự kiến.
- [ ] Mask mã bản quyền/secret và dùng PII giả trước khi lưu ảnh. Lọc token/header/body nhạy cảm trong log; không bật trace chứa dữ liệu thật khi chưa có cách bảo vệ.
- [ ] Thử runner với public, customer, provider, một route động, một lỗi có chủ đích; cố tình cho sai phiên/redirect để chứng minh runner đánh dấu thất bại thay vì chụp nhầm rồi PASS.

**Nghiệm thu:** capture runner không bỏ route động, không lẫn vai trò, có đủ ba viewport, manifest truy ngược được từng ảnh. Route map lịch sử được tách khỏi trạng thái nghiệm thu mới.

## 7. Đợt 2 — Audit hiện trạng và phân loại lỗi

**Tạo:** `issues.md`, `issues.json`; cập nhật coverage/progress. Chưa làm redesign hàng loạt.

- [ ] Đi hết inventory theo từng vai trò, gồm điều hướng qua menu và truy cập URL trực tiếp.
- [ ] Xem ảnh và thao tác thực: bố cục, thứ bậc nội dung, màu, chữ, component, phản hồi thao tác, responsive, accessibility và runtime.
- [ ] Kiểm tra keyboard Tab/Shift+Tab/Enter/Space/Escape, focus quay lại nút mở dialog, menu không giữ focus sai và widget chat không che CTA.
- [ ] Kiểm tra nhãn/semantics bằng accessibility tree và screen reader khi khả dụng; nếu chưa có công cụ đọc màn hình, ghi riêng phần chưa kiểm chứng.
- [ ] Ghi mỗi issue: ID `UI-0001…`, role/route/query/state/viewport, severity/category, bước tái hiện, expected/actual, ảnh, nguyên nhân đã xác định hay giả thuyết, file liên quan, cách kiểm chứng.
- [ ] Phân biệt `VERIFIED_DEFECT` với `DESIGN_PREFERENCE`; lỗi xuất hiện trên nhiều màn dùng một issue gốc kèm danh sách phạm vi.

| Mức độ | Cách ưu tiên |
| --- | --- |
| P0 | Luồng thiết yếu không thể hoàn thành, dữ liệu/quyền bị lộ, tương tác nghiêm trọng sai |
| P1 | Khó sử dụng đáng kể, tác vụ chính không thao tác được bằng bàn phím hoặc vỡ responsive |
| P2 | Thiếu nhất quán, thông tin khó hiểu, phản hồi/điều hướng gây nhầm |
| P3 | Căn chỉnh, khoảng cách, trang trí và hoàn thiện nhỏ |

**Nghiệm thu:** mọi route có ảnh/trạng thái hoặc blocker; issue có bằng chứng thật. Không bịa lỗi để đạt chỉ tiêu số lượng. P0 xác nhận được có thể sửa sớm bằng thay đổi cô lập, vẫn cần ảnh trước và test hồi quy.

## 8. Đợt 3 — Chốt quy chuẩn và cải thiện nền giao diện

**Owner:** `theme.ts`, `styles.css`, `WorkspacePrimitives.tsx`, `CustomerLayout.tsx`, `RoleShell.tsx`, `SiteHeader.tsx`, `Brand.tsx`, các trang lỗi. **Test:** `color-contrast.test.tsx`, `workspace-foundation.test.tsx`, `app.test.tsx` và E2E điều hướng hiện có.

Định hướng dự kiến: giao diện sản phẩm rõ ràng, mật độ vừa phải, giữ màu chủ đạo xanh và IBM Plex Sans hiện có. UI UX Pro Max trả gợi ý minimalism phù hợp dashboard, nhưng phần Hero/CTA chỉ phù hợp landing; không áp vào console. Không thay font sang Fira, thêm màu cam hoặc cài thư viện icon mới chỉ vì skill gợi ý.

- [ ] Chốt token có semantic rõ: nền, surface, chữ, border, primary, trạng thái, hover/focus/disabled. Đối chiếu computed style để tìm chỗ hardcode thực sự gây lệch.
- [ ] Giữ font body 16px làm điểm xuất phát của theme; heading theo thang hiện tại, khoảng cách theo 4/8/12/16/24/32, radius tiết chế. Mật độ bảng điều chỉnh riêng khi cần, không ép mọi màn giống landing.
- [ ] Định nghĩa page header, một CTA chính, filter bar, table/card, pagination, dialog/drawer, loading/empty/error/retry và toast theo component sẵn có.
- [ ] Bảng rộng được cuộn trong vùng có chủ ý hoặc chuyển cách trình bày trên mobile; không làm cả trang tràn ngang và không ẩn cột/thao tác thiết yếu.
- [ ] Chuẩn hóa cách hiển thị ngày/giờ/tiền/số và tiếng Việt; thống nhất “Mã bản quyền”, “Mã tra cứu”, “Bàn giao” theo chức năng thật.
- [ ] Làm trước ba màn đại diện: danh mục public, đơn hàng người mua, bảng/form nhà cung cấp; chụp so sánh ở ba viewport trước khi áp rộng.
- [ ] Sửa các thành phần chung theo issue đã xác minh, kiểm tra tất cả caller bị ảnh hưởng; không tạo bộ Button/Table/Modal mới song song Ant Design.

**Accessibility:** mục tiêu WCAG 2.2 AA ở các tiêu chí áp dụng; đối chiếu chính thức, không coi điểm công cụ tự động là chứng nhận. Kiểm tra contrast chữ, keyboard, tên điều khiển, validation, focus không bị che hoàn toàn, text resize/reflow và reduced motion. Chọn vùng chạm khoảng 44px cho thao tác chính như mục tiêu UX nội bộ, không gọi đó là yêu cầu tối thiểu AA. [W3C WCAG Quick Reference](https://www.w3.org/WAI/WCAG22/quickref/).

**Nghiệm thu:** quy chuẩn nằm trong `design-system.md`; ba màn đại diện đạt kiểm tra trực quan và tương tác, không đổi business behavior. Các màn dùng component chung được đánh dấu cần kiểm lại, không tự chuyển VERIFIED.

## 9. Đợt 4 — Public, tài khoản và điều hướng dùng chung

**Owner:** `PublicHomeScreen`, `CatalogScreen`, `ProductDetailScreen`, `ComparePlansScreen`, `PublicVerificationScreen`, `PublicHelpScreen`, `AuthScreen`, `AccountProfileScreen`; `AuthForms`, `ProviderOnboardingForm`, `NotificationCenter`, `AiAssistantLauncher`.

- [ ] Rà hierarchy landing/catalog, thông tin giá/gói, mô tả dài và lựa chọn gói; giữ hành vi tìm/lọc qua URL, Back/Forward/reload.
- [ ] Kiểm tra guest muốn mua → auth → trở lại đúng sản phẩm/ý định; không mất lựa chọn hoặc tự tạo đơn khi mới đăng nhập.
- [ ] Xác minh trạng thái đăng ký/xác thực email/quên mật khẩu/lời mời nhà cung cấp mà source thực sự hỗ trợ; không suy đoán provider tự đăng ký từ tài liệu cũ.
- [ ] Kiểm tra form thiếu/sai dữ liệu, lỗi server, giới hạn request, session hết hạn/khôi phục lỗi, đổi mật khẩu và đăng xuất.
- [ ] So sánh gói hiển thị đúng quyền lợi `0`/`Không`; thông tin tra cứu không được gây hiểu nhầm là xác thực sử dụng key trong app bên bán.
- [ ] Menu/notifications/AI có nhãn rõ, hoạt động trên touch/keyboard; empty/error có hướng phục hồi và đường quay lại.

**Nghiệm thu:** hoàn thành được hành trình khách → xem gói → đăng nhập → quay lại; 403/404 không rơi vào vòng redirect; không lộ dữ liệu nhạy cảm qua xác thực/tra cứu. Mở rộng `auth-reload.spec.ts`, test catalog/verification/assistance sẵn có theo lỗi cụ thể.

## 10. Đợt 5 — Người mua: đơn hàng, thanh toán, bản quyền, gia hạn

**Owner:** `BuyerHomeScreen`, `BuyerCheckoutScreen`, `PaymentStatusScreen`, `BuyerOrdersScreen`, `BuyerLicenseHubScreen`, `BuyerRenewalScreen`, `BuyerAssistanceScreen`; `PurchaseFlowModal`, `OrderSummary`, `ProviderHandoffNotice`, `LicenseRecoveryPanel`, `LicensingEmailActionPanel` và query hiện có.

- [ ] Làm rõ tiến trình lựa chọn → điều khoản → thanh toán → xử lý → kết quả bằng ngôn ngữ dễ hiểu, không đưa chi tiết kỹ thuật không giúp quyết định vào CTA.
- [ ] Kiểm tra submitting/double click, retry, đóng/mở purchase modal, refresh, Back và mở nhiều tab; không tạo đơn trùng hoặc báo thành công sớm.
- [ ] Tách hiển thị “đã thanh toán”, “đang cấp bản quyền”, “bàn giao nhà cung cấp”, “ghi nhận blockchain” theo trạng thái API thực tế; không suy luận hoàn tất từ redirect hoặc timer.
- [ ] Khi lỗi/chậm, hiển thị việc người dùng có thể làm, giữ mã tham chiếu an toàn; không gợi ý thanh toán lần nữa cho đơn đã nhận tiền.
- [ ] Sau hoàn tất có đường về `/buyer/orders` và bản quyền tương ứng; kiểm tra sau reload và từ thông báo/deep link.
- [ ] Gia hạn dùng đúng trạng thái lệnh/đơn hiện tại, không lấy ACTIVE cũ làm bằng chứng hoàn thành; giá/hạn dự kiến rõ, không đổi nghiệp vụ tính hạn.
- [ ] Phân biệt key bí mật và mã tra cứu; che/copy/reveal theo tính năng thật, không đưa raw key vào ảnh/log/URL hoặc render lại trái quy tắc nhận mã.
- [ ] Kiểm tra hỗ trợ theo ngữ cảnh đơn/bản quyền, AI fallback và chuyển nhân viên; không mất hội thoại sau reload.

**Kiểm thử:** mở rộng `purchase-flow.test.tsx`, `buyer-commerce.test.tsx`, `buyer-hub.test.tsx`, `purchase-modal-flow.spec.ts`, `payment-status-flow.spec.ts`, `buyer-ui-recovery.spec.ts`, `provider-key-handoff.spec.ts`. Kiểm tra các test legacy trước khi chạy, không dùng tên test làm bằng chứng rằng nó phù hợp luồng mới.

**Nghiệm thu:** một hành trình mua và một hành trình gia hạn đi qua API thật/sandbox với dữ liệu test; các trường hợp lỗi hiếm có thể tái hiện bằng fixture nhưng ghi rõ. Nếu thiếu SePay/worker/provider endpoint, phần tích hợp BLOCKED; vẫn tiếp tục các phần UI độc lập.

## 11. Đợt 6 — Nhà cung cấp

**Owner:** `ProviderDashboardScreen`, `ProviderCatalogScreen`, `ProviderLicensesScreen`, `ProviderOperationsScreen`, `AiKnowledgeScreen`; `ProviderLicenseDetailsDrawer`, `ProviderIntegrationPanel`, `ProviderDeliveryPanel` và các panel liên quan.

- [ ] Dashboard cho phép đi tới danh sách được lọc tương ứng với metric; số liệu rỗng/lỗi không giả thành số 0 hợp lệ.
- [ ] Form sản phẩm/gói có nhóm trường hợp lý; billing cycle/duration/entitlements phản ánh hợp đồng hiện có, không tự tính lại quy tắc backend.
- [ ] Kiểm tra tạo/sửa draft, publish, conflict phiên bản, validation và đóng form chưa lưu; lỗi giữ dữ liệu người dùng vừa nhập.
- [ ] License table/drawer có lọc, chi tiết, action và trạng thái rõ; chỉ hiện dữ liệu thuộc provider tương ứng.
- [ ] Tích hợp/bàn giao giải thích nhà cung cấp nhận key/quyền sử dụng; endpoint/secret có cơ chế che, chỉ hiện nút retry theo quyền thật.
- [ ] Tài liệu có trạng thái upload/xử lý/công bố/thất bại, trích đoạn và hướng phục hồi; không lộ private storage path.

**Nghiệm thu:** cùng một bộ dữ liệu test được thao tác đầy đủ trên desktop, tablet và mobile web; provider A không truy cập tài nguyên B. Dùng `provider-workspace`, `provider-integration`, `provider-licenses`, `provider-dashboard` tests hiện có và E2E tương ứng.

## 12. Đợt 7 — Nhân viên và quản trị hệ thống

**Owner:** `SupportConsoleScreen`, `SystemConsoleScreen`, `ConversationPanel`, `ProviderDeliveryPanel`, `SystemUsersPanel`, `ProviderInvitationsPanel`, `PaymentReviewPanel`, `SystemBlockchainPanel`, `RoleShell`.

- [ ] Support: chuyển Hàng đợi/Đang xử lý/Đã giải quyết đúng query và menu active; truy cập trực tiếp, reload, Back giữ view.
- [ ] Nhận xử lý, gửi tin, trả hàng đợi, hoàn tất và lease hết hạn có phản hồi đúng; lỗi quyền/ownership không biến thành nút vô tác dụng.
- [ ] Theo dõi bàn giao có entry point dễ tìm trong console hiện hữu; giải thích đây là trạng thái gửi dữ liệu cho bên bán. Support xem theo quyền hiện có, không cấp thêm retry của admin.
- [ ] System: người dùng, lời mời, thanh toán, blockchain, duyệt tài liệu, hồ sơ có hierarchy nhất quán; form/modal đủ ngữ cảnh và kết quả thao tác rõ.
- [ ] Các thao tác retry/khóa/thu hồi/đối soát có xác nhận và lý do nếu API yêu cầu. Chỉ thao tác tài nguyên test; không chạm đối tượng thật.
- [ ] Blockchain thể hiện pending/finality/stale/reorg theo dữ liệu thật, không làm người dùng hiểu dữ liệu tạm thời là kết quả cuối.
- [ ] Kiểm tra customer/provider/support truy cập URL admin nhận 403 và không lấy được dữ liệu; không chỉ kiểm tra việc ẩn menu.

**Nghiệm thu:** `internal-consoles.test.tsx`, `workspace-navigation.spec.ts`, `system-admin.spec.ts` và kiểm thử boundary liên quan qua API thật; không thay role hoặc business policy để làm test xanh.

## 13. Đợt 8 — App quản lý native

**Owner:** `EmuKey/mobile/src/presentation/EmuKeyMobileApp.tsx`, API client hiện có; test trong `tests/emukey/mobile/`, flow `tests/emukey/e2e/mobile/phase6-license-flow.yaml` sau khi kiểm tra tính phù hợp. Không tạo theme/store/API client trùng.

- [ ] Chạy trên Android emulator hoặc thiết bị test, ghi model/Android/build/font scale; chụp màn hình thật từng route native trong inventory.
- [ ] Kiểm tra safe area, bàn phím che input/CTA, back gesture/button, scroll, nhãn dài tiếng Việt, màn nhỏ và tăng font hệ thống.
- [ ] Kiểm tra catalog → checkout → payment → order detail → licenses; quay về từ WebView/cổng thanh toán phải đọc lại API.
- [ ] Kiểm tra session restore, foreground/background, offline/retry, đăng xuất và chuyển tài khoản không lẫn mã/dữ liệu.
- [ ] Kiểm tra thông báo đã đọc/chưa đọc và deep link tới đơn/bản quyền/hội thoại. Chỉ phát push tới thiết bị test đã đăng ký; thiếu dịch vụ thì ghi blocker cho push thật.
- [ ] Dùng cùng ngôn ngữ trạng thái, màu semantic và mức phân cấp nội dung với web, nhưng giữ mẫu tương tác phù hợp native.

**Nghiệm thu:** test unit/typecheck/lint/build phù hợp và luồng thiết bị thật; build thành công không được tính là UI đã chạy. Nếu không có emulator/device, vẫn hoàn thành web và ghi native chưa nghiệm thu, không tuyên bố toàn ứng dụng hoàn tất.

## 14. Chu kỳ kiểm tra bắt buộc cho mỗi nhóm sửa

1. Chọn issue có bằng chứng; ghi file dự kiến sửa và màn dùng chung bị ảnh hưởng.
2. Với lỗi hành vi, bổ sung ca tái hiện thất bại vào test owner sẵn có khi thực tế cho phép. Với căn lề/màu, dùng ảnh và kiểm tra computed style thay vì test chỉ lặp lại implementation.
3. Sửa nhỏ nhất đủ giải quyết nguyên nhân. Nếu cần dependency mới cho accessibility automation, kiểm tra package hiện có và tài liệu chính thức trước; chỉ dev dependency, không đổi UI framework.
4. Chạy test tập trung, typecheck/lint; build và test liên quan theo phạm vi. Ghi command, exit code, thời gian và log đã loại dữ liệu nhạy cảm.
5. Mở lại từng tổ hợp ảnh hưởng bằng browser/thiết bị; chụp after cùng fixture, viewport, phiên bản browser/OS và chế độ dữ liệu.
6. Xem cặp before/after và chạy lại tương tác, keyboard, responsive, console/network. Sai khác pixel không tự chứng minh cải thiện.
7. Chỉ cập nhật VERIFIED khi có bằng chứng sau sửa; nếu thất bại quay lại FIXED/PENDING và ghi lý do. Kiểm tra caller của thành phần dùng chung.

Lệnh hiện có, chạy từ workspace `D:/TLHT/KLTN/UY` khi triển khai:

```powershell
corepack pnpm --dir EmuKey/frontend lint
corepack pnpm --dir EmuKey/frontend typecheck
corepack pnpm --dir EmuKey/frontend build
corepack pnpm --dir EmuKey/frontend openapi:check
node tooling/emukey/run.mjs frontend:unit

# Chỉ dùng --external khi API/web test đã sẵn sàng và BASE_URL đúng.
$env:BASE_URL = 'http://127.0.0.1:5173'
node tooling/emukey/verification/frontend-scripts/run-playwright.mjs --external workspace-navigation.spec.ts

corepack pnpm --dir EmuKey/mobile lint
corepack pnpm --dir EmuKey/mobile typecheck
node tooling/emukey/run.mjs mobile:unit
corepack pnpm --dir EmuKey/mobile build
git diff --check
git status --short
git -C EmuKey status --short
```

Chọn thêm spec theo đợt; đọc side effect trước khi chạy toàn E2E vì có ca thanh toán/blockchain. Không chạy `db:initialize --allow-destructive` như bước setup UI. Khởi động môi trường theo README sau kiểm tra cấu hình; nếu web chạy bằng Caddy thay vì Vite, ghi đúng chế độ và kiểm tra lại deep link khi build.

Visual regression tái sử dụng Playwright/pixelmatch/pngjs đang cài. Chỉ cập nhật baseline sau khi xem diff có chủ đích; cố định môi trường capture và mask nội dung biến động, không mask lỗi layout. Không tự chạy update snapshots để làm xanh CI. [Playwright: Visual comparisons](https://playwright.dev/docs/test-snapshots).

## 15. Đợt 9 — Hồi quy, đối soát coverage và bàn giao

- [ ] Đối chiếu route inventory với source lần cuối; bổ sung route/query/modal phát hiện muộn.
- [ ] Mọi role-route hợp lệ được kiểm tra lại ở ba viewport web; biến thể dữ liệu/quyền của component dùng chung có dòng riêng.
- [ ] Các trạng thái quan trọng của mỗi màn đã được chụp/thao tác; trường hợp không áp dụng có lý do, không bỏ hàng âm thầm.
- [ ] Kiểm lại hành trình mua, gia hạn, hỗ trợ, publish/tài liệu, quản trị và native trên ranh giới thực đã ghi; kết quả fixture giữ tách biệt.
- [ ] Chạy accessibility automation nếu đã thiết lập, kiểm tra keyboard/focus thủ công, ghi giới hạn screen reader. Không báo “đạt WCAG toàn bộ” chỉ vì không có lỗi tự động.
- [ ] P0/P1 được giải quyết hoặc có blocker cụ thể; còn P0/P1 bị chặn thì trạng thái bàn giao là chưa nghiệm thu đầy đủ. P2/P3 có quyết định sửa/giữ/hoãn và lý do.
- [ ] Sinh số liệu từ coverage/issues/manifest: discovered/applicable/verified/blocked theo role, route, state, viewport, dataMode và surface; không dùng số ảnh thay số màn đã kiểm chứng.
- [ ] `final-report.md` gồm chất lượng trước/sau, thay đổi theo issue/file, cặp ảnh đại diện, kết quả lệnh test, phần chưa test, rủi ro còn lại, khuyến nghị ưu tiên.
- [ ] Chạy hygiene và diff check, giữ nguyên thay đổi có trước, loại duy nhất artifact tạm do lượt audit tạo khi không còn cần. Giữ bằng chứng audit ở nơi đã quy định.

**Điều kiện hoàn tất thực sự:** inventory khớp source; mọi phần nằm trong phạm vi được kiểm chứng hoặc báo rõ chưa hoàn thành; sửa có before/after; luồng quan trọng hoạt động qua boundary thực; các kiểm tra liên quan đạt và không còn lỗi P0/P1 chưa xử lý để gọi kết quả là “hoàn tất toàn bộ”.

## 16. Thứ tự thực hiện và cách tiếp tục qua nhiều lượt

| Thứ tự | Phần việc | Điều kiện chuyển tiếp |
| --- | --- | --- |
| 0 → 1 | Môi trường, fixture, inventory, capture | Browser mở đúng màn/role; không mất route động |
| 2 | Chụp và audit hiện trạng toàn phạm vi | Issue có bằng chứng; blocker tách rõ |
| 3 | Token, layout, component chung | Ba màn đại diện được kiểm chứng |
| 4 → 5 | Public/auth, hành trình người mua | Mua/gia hạn/đường về đơn hàng hoạt động |
| 6 → 7 | Provider, support, system | Quyền và ownership giữ đúng, thao tác có phản hồi |
| 8 | Native CUSTOMER | Có bằng chứng trên thiết bị; không dùng ảnh web thay thế |
| 9 | Hồi quy toàn phạm vi và báo cáo | Coverage đối soát, issue disposition và bằng chứng đầy đủ |

Ưu tiên P0/P1 có thể đổi thứ tự giữa các nhóm sau baseline. Khi gián đoạn, `progress.md` phải ghi issue đang làm, file đã đổi, test đã chạy, coverage còn thiếu, service do agent tự khởi động và hành động tiếp theo. Không cần làm lại những mục có bằng chứng còn hợp lệ; đổi shared component phải mở lại các mục phụ thuộc.

Không ấn định phần trăm hoàn thành, số lỗi hay thời gian toàn dự án trước audit. Sau đợt 2 mới ước lượng theo số issue thực, ranh giới sửa và blocker. Phần yêu cầu quyết định nghiệp vụ chưa rõ phải ghi thành câu hỏi cụ thể; tiếp tục các việc độc lập thay vì dừng toàn kế hoạch.

## 17. Đối chiếu đặc tả

| Yêu cầu gốc | Phần đáp ứng trong kế hoạch |
| --- | --- |
| Phase 0: discovery/safety, bốn tài liệu ban đầu | Mục 1, 4, 5 |
| Phase 1: role × route × state × viewport | Mục 3, 4, 6 |
| Phase 2: browser thật, screenshots, manifest | Mục 4, 6, 7 |
| Phase 3: tám nhóm audit, UI UX Pro Max, accessibility | Mục 7, 8, 14 |
| Phase 4: issues MD/JSON, severity, evidence | Mục 7 |
| Phase 5: design system và tái sử dụng | Mục 8 |
| Phase 6: triển khai theo batch, giữ tính năng | Mục 9–14 |
| Phase 7: after/regression/functional verification | Mục 14, 15 |
| Phase 8: coverage reconciliation | Mục 15 |
| Phase 9: báo cáo tiếng Việt, số liệu có nguồn | Mục 15 |
| Tiếp tục qua nhiều phiên, blocker thật, không tự push | Mục 1, 16 |
| Chỉ lập kế hoạch trong lượt này | Tạo duy nhất tài liệu kế hoạch; chưa thực thi các đợt trên |
