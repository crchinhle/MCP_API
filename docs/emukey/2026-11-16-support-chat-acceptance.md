# Audit và kiểm chứng chat hỗ trợ EmuKey — 16/11/2026

## Kết luận theo phạm vi

Các luồng chat chính đã được kiểm chứng với frontend/API/Identity thật, PostgreSQL/Redis disposable và ba browser context độc lập. Bao gồm tạo yêu cầu trực tiếp, tranh claim, trao đổi hai chiều, refresh, offline/reconnect, mất response sau commit, retry không trùng, đóng hội thoại và AI → Support. Đây là nghiệm thu luồng chat trong môi trường thử nghiệm, chưa phải xác nhận toàn repository hoặc môi trường production đều xanh.

Baseline: working tree sạch, HEAD `8346b884ad0246dd2d14c10e3f66f8f85e3a22a3`, trùng commit tham chiếu. Không tạo branch/commit/push, không sửa schema, không thêm package, không reset database vận hành. Runner dùng database mới `emukey_support_e2e`, không khởi động blockchain worker và không gọi Gemini/SePay/Brevo thật.

## A. Audit report

| Vấn đề / mức độ | Vị trí và nguyên nhân | Tái hiện / bằng chứng | Cách sửa và kết quả |
| --- | --- | --- | --- |
| Ngầm chuyển AI sang Support — cao | `AssistanceSupportRepository.appendMessage`: đổi trạng thái khi CUSTOMER gửi tin thường nhưng không dùng đường notification của requestSupport | Regression PostgreSQL ban đầu nhận message thành công thay vì lỗi; code có hai semantics handoff | Từ chối message thường ở AI_ACTIVE; chỉ thao tác request-support chuyển AI hiện có. Composer AI chỉ có nút hỏi AI, nút chuyển nhân viên riêng. Regression và E2E qua |
| Chưa có tạo Support trực tiếp/idempotency — cao | CreateConversationDto/repository chỉ tạo AI_ACTIVE; mỗi request sinh UUID mới | Hai request đồng thời cùng intent sinh hai ID khác nhau trước sửa | Thêm mode SUPPORT, initialMessage và clientRequestId trên endpoint hiện có; transaction ghi hội thoại WAITING_SUPPORT, tin đầu, SYSTEM và notification. UUID được server suy ra theo customer + key, khóa transaction và so payload gốc. Retry trả cùng ID; payload khác trả 409; mất response + refresh/retry được E2E xác nhận |
| SYSTEM bị giả nhãn Support — vừa | BuyerAssistanceScreen/SupportConsoleScreen dùng nhánh mặc định Support; launcher dùng nhãn hỗ trợ chung | Mapping trong code và regression component | Thêm tác giả System, thông báo trung tính; launcher cũng tách SYSTEM. Timestamp dùng createdAt của server |
| URL và hội thoại lệch nhau — vừa | SupportConsoleScreen chỉ đọc query string trong initializer useState | Thay URL/Back/Forward sau mount không cập nhật selectedId cũ | URL là nguồn chọn hội thoại; click cập nhật URL; refresh/Back/Forward qua browser thật. Mất quyền/không còn trong queue hiện cảnh báo. Close thành công mở view resolved đúng hội thoại |
| Ngữ cảnh AI ở console chưa đầy đủ — vừa | Staff mapping bỏ citationDetails/catalogSources; lịch sử không có timestamp trong contract frontend | So sánh MessageRecord với props ConversationPanel | Truyền nguồn/timestamp sang panel; nguồn tri thức có link tài liệu và trích dẫn/phiên bản snapshot mở rộng được. Bảo toàn history/citation metadata, không gọi thêm LLM để tóm tắt |
| Bản nháp/retry key mất khi refresh — cao | ConversationPanel giữ draft và UUID chỉ trong RAM | Browser lưu thật rồi abort response, refresh, retry | sessionStorage theo tài khoản + hội thoại, lưu UUID trước gửi; tạo yêu cầu cũng lưu intent/nội dung. E2E xác nhận cùng UUID/ID và chỉ một tin/hội thoại. Khóa đồng bộ bằng ref chặn submit cùng nhịp |
| Thông báo requeue và tin khách hàng chưa đủ — vừa | Release/scheduler chưa enqueue thông báo queue; CUSTOMER reply chưa notify staff đang xử lý | Audit các transaction | Dùng chung notifyWaitingInTransaction cho direct/handoff/release/expiry; event key theo phiên bản. Tin CUSTOMER notify đúng claim owner còn hiệu lực; nội dung notification chỉ là thông báo chung. Test retry không tạo notification thứ hai |
| Claim/lease cần nhất quán — vừa | Các thao tác phải kiểm tra đồng hồ sau khi lấy khóa; close cũ đã chặn hết hạn nhưng dùng lỗi khác | Hai connection PostgreSQL giữ khóa qua lúc expiry | Giữ claimVersion/lease/worker; close dùng cùng lockConversation và lỗi CLAIM_EXPIRED. Claim retry cùng owner còn lease trả cùng generation, không sinh thêm SYSTEM. Tranh claim, stale tab, hai sweeper, SIGKILL/restart qua integration |
| Preview không giới hạn và đọc quyền/tin qua hai bước — vừa | listMessages/queue-preview kiểm tra quyền trước một query khác | Audit khoảng thời gian giữa hai query; đây là rủi ro suy ra từ code, không gọi là exploit đã tái hiện | Giữ row SHARE lock trong transaction đọc; preview chỉ 20 tin cuối theo sequence; claim owner đọc đầy đủ. Có integration xác nhận giới hạn và quyền sau claim |
| Chưa giới hạn gửi tin thường — vừa | Chỉ đường AI có limiter | Audit service; kiểm chứng Redis thật | Dùng limiter đang có, scope riêng: create 10/phút, handoff 15/phút, message 60/phút/tài khoản. 429 khi vượt; Redis lỗi trả 503 có thể retry, không mất nội dung đã commit |
| Cache chưa tách tài khoản — cao | Query key conversations/messages/queue/notifications dùng chung | Audit key, rủi ro cache hiển thị dữ liệu cũ khi đổi tài khoản | Thêm account ID vào key, giữ prefix invalidation hiện có |
| Polling chậm — vừa | Messages 5s, queue 10s | Browser đo queue 9707ms, reply 5187ms, customer message 5454ms | Messages/conversation 2s, queue 3s, staff notifications 5s; refetch focus/reconnect; tab nền không polling. Giữ polling vì số đo mới phù hợp MVP |

### Những invariant đã có và được giữ

- AI append kiểm tra AI_ACTIVE dưới row lock: không ghi câu trả lời muộn sau handoff; test có AI đang sinh thật ở adapter boundary và handoff đồng thời.
- Sender/actor lấy từ principal, không từ payload; DTO loại trường giả mạo. Admin không claim hoặc nhắn thay staff; customer khác không xem được đối tượng.
- Order/License context kiểm tra sở hữu; Product/Plan chỉ nhận dữ liệu công khai. Không tác động nghiệp vụ License/Payment.
- Message unique theo conversation/clientMessageId và serverSequence, nội dung retry khác bị từ chối. Render text bằng React, không chạy HTML/Markdown do người dùng cung cấp.
- SupportLeaseScheduler được cung cấp bởi worker operations module, không phải mọi API instance. Các cuộc quét cạnh tranh không requeue hai lần.
- Guest dùng luồng đăng nhập hiện có; không tự ghép guest session vào tài khoản. Guest session chỉ giữ ở phạm vi riêng; chưa bổ sung chuyển lịch sử guest vào tài khoản.

### State transition matrix

| Thao tác | Role/điều kiện | Đầu vào → đầu ra | Retry/cạnh tranh | Timeline/notification |
| --- | --- | --- | --- | --- |
| Create AI | Customer | Chưa có → AI_ACTIVE | clientRequestId tùy chọn; client AI cũ không truyền key vẫn giữ semantics tạo mới | Không thông báo staff |
| Create Support | Customer, context hợp lệ, initialMessage + clientRequestId | Chưa có → WAITING_SUPPORT | Cùng customer/key/payload cùng ID; payload khác 409; khóa + PK quyết định | Tin CUSTOMER + SYSTEM + staff notification trong một transaction |
| Ask AI | Customer sở hữu | AI_ACTIVE → AI_ACTIVE | Question/answer có UUID ổn định; writer kiểm tra lại trạng thái | CUSTOMER/AI + citations |
| Request support | Customer sở hữu, xác nhận qua nút | AI_ACTIVE → WAITING_SUPPORT | WAITING/SUPPORT_ACTIVE trả trạng thái hiện có; CLOSED 409 | Một SYSTEM + notification/staff |
| Customer message | Customer sở hữu | WAITING/SUPPORT_ACTIVE → giữ nguyên | Cùng key/payload một message; CLOSED/AI_ACTIVE bị chặn | CUSTOMER; notify claim owner khi còn lease |
| Claim | Support Staff | WAITING_SUPPORT → SUPPORT_ACTIVE | Một winner dưới row lock; owner retry cùng phiên trả cùng claimVersion | SYSTEM + notify customer |
| Heartbeat | Assigned staff + đúng version + lease còn hạn | SUPPORT_ACTIVE → giữ nguyên | Đọc đồng hồ sau khóa; stale/expired 409 | Gia hạn 120s, không thêm message |
| Staff message | Assigned staff + đúng version + lease còn hạn | SUPPORT_ACTIVE → giữ nguyên | UUID dedup; stale/không assigned bị chặn | SUPPORT + notify customer |
| Release | Assigned staff + đúng version + lease còn hạn | SUPPORT_ACTIVE → WAITING_SUPPORT | Release retry cùng generation không thêm event; stale 409 | SYSTEM + staff notification |
| Expiry sweep | Worker | SUPPORT_ACTIVE hết hạn → WAITING_SUPPORT | Hai sweeper chỉ một tác động/phiên | SYSTEM + staff notification |
| Close | Owner customer, assigned staff đúng lease, hoặc quyền admin hiện có | Trạng thái mở → CLOSED | Retry CLOSED không thêm SYSTEM; staff hết lease bị chặn | SYSTEM; hai phía đồng bộ bằng polling |

## B. File thay đổi

| Nhóm | File / trách nhiệm |
| --- | --- |
| Backend | `EmuKey/backend/src/modules/assistance-support/assistance-support.service.ts` — intent/input/rate/error; `infrastructure/assistance-support.repository.ts` — transaction, message, claim, notification, quyền đọc; `application/public-assistant.service.ts` — tái sử dụng limiter với mã lỗi Support |
| API contract | `assistance-support.dto.ts`; hai `backend/openapi/openapi.json`, `frontend/openapi/openapi.json`; `frontend/src/infrastructure/api/generated/types.gen.ts` — mode, initialMessage, clientRequestId, createdAt |
| Frontend queries | `application/assistance/assistanceQueries.ts`, `supportQueries.ts`, `application/notifications/notificationQueries.ts` — polling, reconnect, cache theo account, invalidation |
| Frontend UI | `BuyerAssistanceScreen.tsx`, `SupportConsoleScreen.tsx`, `ConversationPanel.tsx`, `AiAssistantLauncher.tsx`, `KnowledgeCitations.tsx`, `domain/workspace.ts`, `styles.css`, `AiAssistant.css` |
| Tests | `tests/emukey/backend/integration/assistance/phase7-assistance.integration.test.ts`; `tests/emukey/frontend/buyer-hub.test.tsx`, `completed-flows.test.tsx`; `tests/emukey/e2e/web/workspace-navigation.spec.ts`, `ui-audit.spec.ts` — cập nhật nhãn AI cũ và regression |
| File mới | `tests/emukey/e2e/web/support-chat.spec.ts` — luồng browser thật; `tooling/emukey/verification/run-support-chat.mjs` — môi trường disposable và thu bằng chứng; `docs/emukey/plans/2026-11-16-support-chat.md`; báo cáo này |
| Database/dependencies | Không đổi schema, không thêm migration/dependency, không sửa lockfile |

## C. Kết quả kiểm tra

| Kiểm tra | Kết quả và phạm vi |
| --- | --- |
| Backend unit + security | PASS: 51 file, 562 test. Command: `vitest run --config ../../tooling/emukey/verification/vitest.backend.config.ts unit security` |
| Assistance PostgreSQL/Redis integration | PASS: 23 test; SKIPPED 1 fixture subprocess ở tiến trình chính. Fixture này được worker-crash test gọi riêng, không phải bỏ qua chức năng worker. Bao gồm HTTP contracts/roles, direct creation, concurrent claim/dedup, rollback, AI race, expiry, Redis failure và 5 hội thoại gửi đồng thời |
| Frontend focused | PASS: 83/83 test trong 6 file buyer-hub/internal-consoles/completed-flows/ai-assistant-chat/assistance-contract/notification-contract, chạy một worker. Regression citation snapshot bổ sung PASS riêng. Log: `emukey-chat-focused-final.log` |
| Browser thật | PASS: 2/2 `support-chat.spec.ts` trong runner disposable, thư mục `emukey-support-chat-Q7IgMU`; chạy lại luồng chính ở `emukey-support-chat-gVlsCE` cũng PASS, gồm giữ vị trí khi đọc tin cũ và nút báo tin mới. Không mock response thành công của API chat; chỉ chủ động mất response/lỗi 500/offline để kiểm tra phục hồi |
| Typecheck/build | PASS backend và frontend. Build frontend có cảnh báo bundle >500kB có sẵn; không sửa bundle splitting ngoài phạm vi |
| Lint | PASS backend và các file frontend thuộc phạm vi. Lint toàn frontend FAIL với 11 lỗi ngoài phạm vi tại PublicHelpDetailScreen, PublicHelpScreen, PublicVerificationScreen; các file này không thay đổi |
| OpenAPI | PASS backend/frontend `openapi:check`; generated types đồng bộ |
| Full frontend | FAIL: lần chạy rộng 285 PASS / 16 FAIL / 301 test, 23 file. Không coi toàn frontend đã xanh. Một lỗi AI nhãn cũ đã sửa và chạy lại. Một test license timeout và một test account refresh thất bại ở lần chạy rộng nhưng đều PASS trong lần chạy tập trung 83/83 |
| Baseline commerce/purchase | Đã trích xuất HEAD bằng `git archive` sang thư mục TEMP, không đụng checkout. Bản gốc cũng FAIL đúng 13 test commerce/purchase, 48 PASS / 61 test. Không sửa các nghiệp vụ này để làm xanh audit chat |
| Browser regression mở rộng | Lần mở rộng ai-assistant + workspace-navigation: 18 PASS / 5 FAIL. AI guest/retry/restore và hai tab Support PASS; 4 lỗi ngoài chat ở license retry, catalog deletion, public/auth title không sửa. Lỗi AI snapshot dùng source modal cũ đã được cập nhật sang source link + trích dẫn phiên bản và chạy lại. Đây là bộ UI mock, không phải E2E backend thật |
| Browser source regression cuối | PASS: AI snapshot/history trong workspace-navigation sau cập nhật; 3/3 kiểm tra citation popup 320/768/1440px sau đổi locator cũ region sang dialog hiện hành. Lần cuối `emukey-support-chat-gVlsCE`: 4/4 PASS gồm 1 luồng thật và 3 UI mock; không cộng UI mock thành E2E thật |
| Diff/hygiene | `git diff --check` và workspace guard PASS; chỉ file có owner rõ ràng. Ảnh/log/trace/bản trích xuất baseline ở OS TEMP |

Các lệnh bị lọc theo tên có các test không khớp được báo SKIPPED do filter; không cộng chúng vào số PASS. Lỗi ban đầu của regression direct-create/implicit-handoff là bằng chứng RED trước sửa. Một lần browser creation-retry dùng locator quá rộng đếm cả nội dung textarea ẩn của Modal; đã đổi kiểm tra sang vùng lịch sử tin nhắn và chạy lại 2/2 PASS.

### Đo thực tế

Mỗi cột là một lần chạy cục bộ, không phải benchmark p95 hoặc tải production. Đơn vị ms, đo từ trước thao tác UI tới response/hiển thị.

| Chỉ số | Polling cũ | Polling mới, lần cuối |
| --- | ---: | ---: |
| Create được server xác nhận | 201 | 350 |
| Queue thấy yêu cầu | 9707 | 3079 |
| Staff reply được server xác nhận | 165 | 198 |
| Customer thấy staff reply | 5187 | 1078 |
| Staff thấy customer message | 5454 | 1196 |
| Message sau reconnect xuất hiện | 5123 | 1061 |
| Badge notification của staff | Chưa đo riêng | 5115 |

Ở baseline, notification được đọc qua API sau khi queue xuất hiện ở mốc 9889ms; đó là thời điểm quan sát, không phải độ trễ giao notification. Lần mới đo thêm badge UI riêng. Quyết định: giữ polling, không thêm Socket.IO/SSE/WebSocket; vẫn có sequence/dedup từ PostgreSQL, tab nền dừng polling và focus/reconnect refetch.

## D. Bằng chứng browser

Thư mục ảnh/số đo cuối: `C:/Users/thong/AppData/Local/Temp/emukey-support-chat-gVlsCE/`. Bằng chứng tạo yêu cầu mất response + refresh/retry: `C:/Users/thong/AppData/Local/Temp/emukey-support-chat-Q7IgMU/`.

- `customer-create.png`, `customer-waiting.png`, `support-queue.png`, `staff-claimed.png`, `two-way-chat.png`.
- `customer-closed.png`, `staff-closed.png`, `ai-handoff-history.png`.
- `customer-1440.png`, `customer-1024.png`, `customer-768.png`, `customer-375.png` và bộ `staff-*` tương ứng.
- `measurements.json`, `environment.json`; baseline số đo nằm ở `emukey-support-chat-MM6QCr/measurements.json`.

Đã mở kiểm tra ảnh desktop/mobile. Browser kiểm tra không tràn chiều ngang ở 1440/1024/768/375px; form có label, message log có aria-live, SYSTEM riêng và time từ server. Chưa tuyên bố đạt toàn bộ WCAG bằng một bộ audit tự động.

Nhật ký ngoài repository: `emukey-chat-frontend-full.log`, `emukey-chat-commerce-baseline-full.log`, `emukey-chat-commerce-current.log`, `emukey-chat-focused-final.log` trong cùng OS TEMP. Runner tự dọn API/Vite và container của chính nó; giữ lại artifact kiểm chứng.

## E. Giới hạn nghiệm thu

- Gemini/RAG provider live, SePay/Brevo/FCM và blockchain live không được nghiệm thu lại trong nhiệm vụ chat. AI handoff dùng adapter thử nghiệm tại biên provider, còn auth/service/database/UI là thật.
- Redis unavailable, notification transaction failure, offline 5 giây, browser 500, mất response, worker SIGKILL/restart, stale version và tranh chấp thật đã có bằng chứng. Chưa mô phỏng toàn bộ biến thể OS sleep dài, outage database hoàn toàn hoặc hạ tầng nhiều API instance.
- PostgreSQL giữ lịch sử hiện có; chưa tìm thấy chính sách retention/xóa hội thoại được phê duyệt. Không tự xóa dữ liệu hoặc gửi thêm PII sang LLM. Draft tạm dùng sessionStorage có scope account; chưa thêm chuyển lịch sử Guest vào Customer.
- 5 hội thoại đồng thời là kiểm tra synchronization vừa phải, không phải load test công suất. Polling toàn lịch sử vẫn cần đánh giá pagination/index/tải khi lưu lượng tăng.
- Tab đóng/ẩn không release ngay: giữ lease 120 giây và worker quét mỗi 30 giây của kiến trúc hiện có. Staff trở lại phải xác minh generation/quyền; backend luôn quyết định khả năng xử lý.
- Các lỗi commerce/purchase baseline và lint frontend ngoài phạm vi vẫn còn. Không kết luận toàn bộ hệ thống đạt 15 tiêu chí ở production chỉ từ các kết quả thử nghiệm này.

Chạy lại chat: `corepack pnpm --dir EmuKey/backend build` rồi `node tooling/emukey/verification/run-support-chat.mjs`. Có thể truyền tên spec và tùy chọn Playwright sau runner để chạy regression UI; các spec mock phải được ghi rõ là bằng chứng UI, không cộng vào E2E thật.

## Tài liệu kỹ thuật đã đối chiếu

- [PostgreSQL 15 explicit locking](https://www.postgresql.org/docs/15/explicit-locking.html) — row/advisory lock cho transaction và duplicate creation.
- [TanStack Query v5 focus refetching](https://tanstack.com/query/v5/docs/framework/react/guides/window-focus-refetching) — phục hồi truy vấn khi quay lại tab.
- [React Router search params](https://reactrouter.com/api/hooks/useSearchParams) — URL làm state hội thoại.
- [NestJS validation](https://docs.nestjs.com/techniques/validation) — DTO whitelist/forbidNonWhitelisted và input validation.
