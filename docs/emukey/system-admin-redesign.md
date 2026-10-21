# System Admin redesign — 2026-10-21

Implement the supplied System Admin specification in the current frontend. Keep existing URLs, API contracts, authentication and all Provider/Customer flows. Preserve the pre-existing ProviderDashboardScreen change. No dependencies, schema changes, commits or pushes.

## Implementation and verification sequence

- [x] Shell: one sidebar navigation, one accessible account menu, scoped layout tokens. Verify subviews render without health requests and account password navigation works.
- [x] Overview: compact API/PostgreSQL/Redis status and independently loading work counts from existing queries. Unknown/request failure must never imply a confirmed outage or zero work.
- [x] Users: extend the existing account query/mutation flow with filters, Drawer, confirmation and localized labels. Invite form remains in its current component, rendered after accounts with its trigger in the account toolbar. Verify uncertain mutation refresh and allowed state transitions.
- [x] Payments: reuse the existing payment history owner and classification mapping. Add System Admin context, compact OPEN-only review queue, closed review evidence and details. Verify reason validation and refresh.
- [x] Blockchain: confirm projection-changing reconciliation, show pending/error/result including remaining mismatches. `processed` means work was performed, not completion or correctness.
- [x] Documents: system queue defaults to pending approval, read all versions in Drawer, publish with confirmation and provider-scoped expectedCurrentVersion. No unsupported rejection or invented product name/date.
- [x] Profile: normalized dirty state, preserve edits on failure, separate personal/account/security sections; keep password policy and logout.
- [x] Verification: focused component tests, complete frontend suite, TypeScript, ESLint, build; browser routes/history/refresh, workflow tests, 320/768/1024/1440 layouts and keyboard accessibility; diff/hygiene review.

## Sources and decisions

Installed: React 19.2.8, Ant Design 6.6.2, TanStack Query 5.102.8, React Router 7.18.3. Reuse installed Dropdown/Drawer/Form/Table; no new UI library. Check installed declarations alongside official documentation:

- https://ant.design/components/dropdown/
- https://ant.design/components/drawer/
- https://ant.design/components/form/
- https://tanstack.com/query/v5/docs/framework/react/guides/disabling-queries
- https://reactrouter.com/7.18.4/api/hooks/useSearchParams

Backend evidence: identity.repository.ts allows ACTIVE↔LOCKED and ACTIVE/LOCKED→DISABLED, increments session_version and protects the last active admin. commerce.service.ts includes closed payment reviews; only OPEN is actionable. knowledge.repository.ts publishes READY via is_current and provider/logical-key version checks; old published version remains until publication. blockchain-reconciliation.service.ts reconciles receipts, polls events and repairs canonical projections; it returns remaining mismatches and confirmed health counts. No document rejection endpoint or product-name metadata in KnowledgeDocumentDto.

## Phạm vi thay đổi

| File trong `EmuKey/frontend/src/` | Thay đổi |
| --- | --- |
| `presentation/components/RoleShell.tsx` | Menu tài khoản System Admin, active navigation theo pathname/view, hỗ trợ query bổ sung; giữ cấu trúc URL. |
| `presentation/screens/SystemConsoleScreen.tsx` | Chỉ Tổng quan tải health; ba dịch vụ gọn, công việc chờ từ dữ liệu thật, lỗi độc lập từng nguồn. |
| `presentation/components/SystemUsersPanel.tsx` (mới) | Owner riêng cho quản lý tài khoản: tìm kiếm, lọc, Drawer, menu và xác nhận trạng thái, refresh khi kết quả mutation chưa rõ. |
| `presentation/components/ProviderInvitationsPanel.tsx` | Danh sách lời mời tách sau tài khoản; dùng lại form hiện có với nút mở từ toolbar; thêm ngày gửi sẵn có từ DTO. |
| `presentation/screens/ProviderOperationsScreen.tsx` | Dùng lại bảng lịch sử, bộ lọc và Drawer cho System Admin; hàng đợi rà soát chỉ xuất hiện với vai trò hệ thống. |
| `presentation/components/PaymentReviewPanel.tsx` | Chỉ OPEN là việc chờ; giữ lịch sử đã đóng, Drawer chứng từ/lý do và modal ghi kết quả. |
| `presentation/components/SystemBlockchainPanel.tsx` (mới) | Owner riêng cho thao tác đối soát: xác nhận tác động, pending/retry, kết quả sửa projection và sai lệch còn lại. |
| `presentation/screens/AiKnowledgeScreen.tsx` | Hàng đợi chờ duyệt mặc định, chi tiết mọi trạng thái, xác nhận công bố với phiên bản hiện hành đã quan sát; phản ánh lại dữ liệu sau mutation. |
| `application/assistance/knowledgeQueries.ts` | Dùng chung phép phân biệt hiện hành/chờ duyệt/phiên bản cũ cho danh sách và Tổng quan. |
| `presentation/screens/AccountProfileScreen.tsx` | Dirty state cho System Admin, giữ dữ liệu khi lỗi, metadata dạng description list, tách bảo mật; giữ nguyên password policy và logout. |
| `presentation/components/WorkspacePrimitives.tsx` | Tái sử dụng mapping thanh toán hiện có cho lịch sử và rà soát. |
| `presentation/styles.css` | Tokens và bố cục chỉ áp dụng System Admin; spacing, bảng, footer, focus, mobile/Drawer; dành chỗ ở pagination cho nút hỗ trợ. |

Kiểm thử sửa trong `tests/emukey/frontend/{internal-consoles,completed-flows,api-backed-screens,app,workspace-foundation}.test.tsx` và `setup.ts`. Bộ kiểm thử mới `tests/emukey/e2e/web/system-admin.spec.ts` sở hữu các luồng System Admin; cập nhật nhãn trang trong `workspace-navigation.spec.ts` theo giao diện mới.

`ProviderDashboardScreen.tsx` có thay đổi trước nhiệm vụ và được giữ nguyên. Không thay đổi backend, schema SQL, generated API, dependency hoặc lockfile. Không commit/push.

## Các giới hạn đã xác minh

- **NOT VERIFIED — backend thật:** Docker daemon không chạy (`dockerDesktopLinuxEngine` không tồn tại), API ở cổng 3000 không có listener. Các ca trình duyệt dùng HTTP fixtures riêng; không coi chúng là bằng chứng gọi SePay/blockchain/DB thật.
- **Không có capability từ chối tài liệu:** giữ phê duyệt/công bố, không thêm nút từ chối giả. DTO tài liệu chưa cung cấp tên sản phẩm/ngày gửi; Drawer hiển thị mã truy vết, không dựng dữ liệu.
- **Không có API đọc health blockchain tổng hợp độc lập:** Tổng quan chỉ liên kết tới màn đối soát, không tự chạy mutation để lấy KPI.
- **Cảnh báo công cụ:** Vite báo chunk JS lớn hơn 500 kB; jsdom báo chưa triển khai pseudo-element `getComputedStyle` và một số `requestSubmit`. Không tắt cảnh báo hoặc tăng timeout để hợp thức hóa test.
- **Accessibility:** kiểm tra bàn phím, focus/Escape, Drawer mobile và contrast footer trên trình duyệt; chưa kiểm thử bằng screen reader thực tế hoặc audit WCAG toàn ứng dụng.

## Lệnh kiểm chứng

Chạy từ `EmuKey/frontend`:

```powershell
node node_modules/typescript/bin/tsc --noEmit
node node_modules/eslint/bin/eslint.js .
node node_modules/vite/bin/vite.js build
node node_modules/vitest/vitest.mjs run --config ../../tooling/emukey/verification/vitest.frontend.config.cjs --maxWorkers=2
$env:E2E_EXTERNAL='true'
node node_modules/@playwright/test/cli.js test --config ../../tooling/emukey/verification/playwright.frontend.config.mjs system-admin.spec.ts workspace-navigation.spec.ts --reporter=list --output "$env:TEMP/emukey-admin-release-e2e"
```

Browser base URL: `http://127.0.0.1:5173`. Vite được khởi động bằng `node node_modules/vite/bin/vite.js --host 127.0.0.1 --port 5173 --strictPort`. Logs, ảnh và traces của nhiệm vụ nằm trong thư mục OS temporary, không đưa vào source.

## Kết quả cuối cùng

| Kiểm chứng | Kết quả |
| --- | --- |
| TypeScript `tsc --noEmit` | **PASS**, exit 0 |
| ESLint toàn frontend | **PASS**, exit 0 |
| Vite production build | **PASS**, exit 0; còn cảnh báo chunk lớn |
| Unit/component toàn frontend | **PASS — 19 files, 234 tests**, 405.95 giây |
| Playwright System Admin và hồi quy workspace | **PASS — 27 tests**, 2.3 phút |
| Responsive | **PASS**, sáu màn hình tại 320×800, 768×1024, 1024×768, 1440×1024 và 1440×900; không tràn ngang body |
| Navigation | **PASS**, sidebar active kể cả query phụ, Back/Forward, deep link, refresh, URL audit cũ; health không được gọi trên trang con |
| Workflows | **PASS**, mời Provider, lỗi/tải lại tài khoản và chi tiết, xác nhận khóa/mở khóa, refresh kết quả chưa rõ; lịch sử/phân trang/Drawer/rà soát có lý do; blockchain retry và sai lệch còn lại; công bố tài liệu với version check; dirty state/lỗi lưu/password/logout |
| Accessibility đã chạy | **PASS**, menu Enter/Space/Escape/click outside, focus trap mobile, Drawer 320px, contrast tên/vai trò footer ≥4.5:1 |
| Backend/DB/SePay/blockchain thật | **NOT VERIFIED**, Docker daemon chưa chạy |
| Screen reader và audit WCAG toàn ứng dụng | **NOT VERIFIED** |
| `git diff --check` và workspace guard | **PASS**; bốn file mới có owner rõ ràng; giữ thay đổi có trước nhiệm vụ |

Logs cuối: `%TEMP%/emukey-admin-release-unit.log`, `%TEMP%/emukey-admin-release-e2e.log`. Traces lỗi trong những vòng thử trước chỉ nằm ở OS temporary. Vòng toàn suite ban đầu có hai kỳ vọng UI cũ và một timeout; đã sửa kỳ vọng theo hành vi được yêu cầu, kiểm thử lại 41/41 và sau đó chạy lại toàn suite đạt 234/234. Không tăng timeout unit để che lỗi.

Lưu ý về shell thu log: PowerShell của môi trường trả wrapper exit 1 khi câu lệnh cuối redirect native stderr bằng `2>&1`, kể cả native process thành công. Đã tái hiện riêng bằng `node -e "console.error('shell-stderr-probe')"` và kiểm tra `$LASTEXITCODE=0`. Log Vitest cuối xác nhận 19/19 files, 234/234 tests và không có unhandled error; stderr là các cảnh báo jsdom đã nêu. Các lệnh kiểm chứng ở trên có thể chạy trực tiếp không redirect. Vite phục vụ kiểm thử đã được dừng sau khi kiểm chứng.
