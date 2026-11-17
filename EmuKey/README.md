# EmuKey

Nền tảng bán và quản lý license: NestJS API/worker, PostgreSQL external, Redis, React web, Expo mobile quản lý. Build/runtime của sản phẩm nằm trong thư mục này; không cần workspace `agent/`, `context/` hoặc `tooling/` để chạy sản phẩm.

## Chuẩn bị môi trường

- Node 22.21.0, Corepack và pnpm 11.25.0; Docker Compose v2.
- PostgreSQL 15 hoặc mới hơn, database riêng đã tạo và tài khoản có quyền cài `pgcrypto`, `citext`, tạo schema/bảng/function/trigger. Không dùng database chung có dữ liệu ngoài EmuKey.
- `backend/database/schema.sql` là nguồn cấu trúc database duy nhất, gồm 24 bảng; PostgreSQL cần extension `vector` (pgvector) bên cạnh `pgcrypto` và `citext`. Database có dữ liệu phải được nâng cấp bằng SQL có kiểm chứng trên bản sao disposable; không dùng initializer làm migration.
- Blockchain runtime dùng Sepolia thật. Cần RPC, relayer testnet có gas và địa chỉ contract hợp lệ để nghiệm thu phát hành/gia hạn trên chain. API/worker ở `NODE_ENV=development` yêu cầu SePay sandbox, Brevo, Gemini và FCM cùng credentials tương ứng. Adapter `fake` chỉ được dùng trong `NODE_ENV=test` với fixture cô lập; không khởi động được runtime development thông thường và không chứng minh tích hợp thật.

Từ thư mục `EmuKey/`, sao chép `backend/.env.example` thành `backend/.env`, điền PostgreSQL, JWT secret, các credentials provider, activation envelope key 32 bytes dạng 64 ký tự hex và cấu hình Sepolia. Mẫu chỉ liệt kê biến cần điền, chưa thể chạy bằng các placeholder. Giữ `.env` ngoài Git. Với Compose, PostgreSQL phải truy cập được từ container: `localhost` trong container không phải máy host; Docker Desktop có thể dùng `host.docker.internal`.

Bảo đảm `pnpm --version` chạy được trước khi install/build: Corepack và Expo có thể gọi `pnpm` qua tiến trình con. Nếu thiếu shim, dùng `corepack enable`; với thư mục Node không có quyền ghi, dùng `corepack enable --install-directory <thư-mục-tools>` và thêm thư mục tools đó vào `PATH`.

```sh
corepack pnpm --dir backend install --frozen-lockfile
corepack pnpm --dir frontend install --frozen-lockfile
corepack pnpm --dir mobile install --frozen-lockfile
corepack pnpm --dir backend build
docker compose config --quiet
```

Không in `docker compose config` ra log chia sẻ vì cấu hình đã nội suy có thể chứa secrets. `--quiet` chỉ kiểm tra cấu hình. `db:verify` đọc cấu trúc thực tế, không sửa dữ liệu:

```sh
corepack pnpm --dir backend db:verify
```

Với **database mới, rỗng và dành riêng cho phát triển**, khởi tạo rồi kiểm tra:

```sh
corepack pnpm --dir backend db:initialize
corepack pnpm --dir backend db:verify
```

Initializer từ chối `NODE_ENV=production` và từ chối database không rỗng nếu không có `--allow-destructive`. Không dùng flag đó để nâng cấp. Demo seed là tùy chọn phát triển: `corepack pnpm --dir backend db:initialize --demo` trên database rỗng với `NODE_ENV=development`; tài khoản/mã trong demo không phải dữ liệu vận hành.

## Database có dữ liệu và thay đổi cấu trúc

Không chạy `db:initialize` hoặc `db:reset` để nâng cấp database cần giữ dữ liệu. Trước khi nâng cấp cần xác định schema nguồn thực tế, chuẩn bị SQL tăng dần có review và cập nhật schema đích duy nhất. Kiểm tra backup/restore trên database disposable, đối chiếu row counts, khóa ngoại, snapshot Terms, key material và outbox; chạy `db:verify`, regression giao dịch và reconcile ở môi trường cô lập. Giữ backup và bản runtime tương ứng để phục hồi; không tự tạo SQL bằng cách so chuỗi schema. Chưa chứng minh các bước này thì chưa được coi là nâng cấp production an toàn.

`corepack pnpm --dir backend db:migrate` hiện chỉ hỗ trợ trường hợp schema chuẩn có thêm bảng metadata cũ `public.schema_versions`. Mặc định lệnh diễn tập trong transaction rồi **ROLLBACK**, không lưu thay đổi; có giữ khóa metadata trong thời gian diễn tập. Sau khi operator kiểm tra backup và xác nhận các công cụ cũ không còn đọc tên bảng đó, `db:migrate --apply` chuyển chính bảng sang `emukey_maintenance.schema_versions`, giữ nguyên OID/dữ liệu, kiểm tra lại baseline rồi mới COMMIT. Lệnh từ chối mọi drift khác, target archive có sẵn hoặc thiếu quyền. Chạy lại trên baseline chuẩn là no-op. Đây chưa phải trình nâng cấp tùy ý giữa các phiên bản schema.

Phục hồi vị trí ledger sau khi apply chỉ dành operator đã kiểm tra phụ thuộc: trong một transaction, `ALTER TABLE emukey_maintenance.schema_versions SET SCHEMA public`. Dữ liệu ledger không bị xóa; `db:verify` sẽ lại báo extra table như trước. Không dùng thao tác này để hoàn tác thay đổi nghiệp vụ hoặc trạng thái blockchain.

Chỉ dựng lại **database phát triển disposable có thể bỏ toàn bộ dữ liệu**, với quyết định reset rõ ràng:

Dừng API và worker, cập nhật `backend/database/schema.sql`, rồi chạy từ `EmuKey/` với `NODE_ENV=development`:

```sh
corepack pnpm --dir backend build
corepack pnpm --dir backend db:initialize --allow-destructive
corepack pnpm --dir backend db:verify
```

Lệnh xóa toàn bộ dữ liệu trong schema `public` và các đối tượng phụ thuộc, rồi tạo lại 24 bảng trong một transaction. Database và role PostgreSQL vẫn được giữ. Nếu tự drop và tạo lại database rỗng, chạy `db:initialize` không cần flag. Khởi tạo ở production vẫn bị chặn. `db:reset` là tên gọi khác của init; thêm `--demo` khi cần dữ liệu mẫu. Khởi động lại API/worker sau khi kiểm tra đạt.

Schema chuẩn không tạo bảng ghi phiên bản mới; ledger cũ được bảo toàn ngoài `public` khi operator áp dụng migration giới hạn ở trên. Init không phục hồi dữ liệu cũ. Dữ liệu blockchain và hệ thống nhà cung cấp nằm bên ngoài, không bị xóa khi reset database; dùng môi trường demo riêng khi bắt đầu lại.

## Phê duyệt điều khoản cho production

Chủ dự án cần duyệt nội dung chính xác của `backend/config/service-terms.md`, đặt `SERVICE_TERMS_VERSION` (tối đa 40 ký tự) và `SERVICE_TERMS_APPROVED_SHA256` theo SHA-256 của đúng bytes UTF-8 đã duyệt. Production kiểm tra lúc khởi động và mỗi lần tạo snapshot; thiếu approval hoặc hash lệch sẽ từ chối. Không lấy hash fixture làm bằng chứng phê duyệt pháp lý. Development/test vẫn dùng fixture v1. Order giữ nguyên snapshot/version/hash của lúc tạo; thay tài liệu hiện hành không đổi sự chấp thuận của đơn cũ. `config/license-terms/v1.md` là baseline lịch sử, không phải văn bản đã được phê duyệt.

`TRUST_PROXY_CIDRS` chỉ nhận IP/CIDR của ingress thực tế. Mặc định rỗng sẽ bỏ qua forwarded headers do client gửi; không dùng `true`, subnet toàn Internet hoặc số hop. Cần xác định network của reverse proxy và chặn truy cập trực tiếp API trước khi cấu hình production để giữ đúng IP cho rate limit.

## Chạy local

```sh
docker compose up -d --build redis api worker web
docker compose ps
```

Web mặc định `http://localhost:5173`, API `http://localhost:3000/api/v1`. Kiểm tra `/health/live` và `/health/ready`; readiness API không thay thế kiểm tra worker. Notification delivery, nhắc hết hạn và trả hội thoại hết lease về hàng đợi chỉ chạy trong worker. Dùng `docker compose logs --tail=100 worker` và hàng đợi/trạng thái thao tác để chẩn đoán; không đưa key/token/password vào log.

Notification lưu durable intent và lease trong PostgreSQL. Worker khởi động lại có thể thử gửi lại khi lần trước vendor đã nhận nhưng chưa lưu được xác nhận; không coi trạng thái retry là bằng chứng vendor chưa nhận. Log `notification.delivery.failed` có notification/delivery ID, attempt và mã lỗi; `providerAcknowledged` cho biết worker đã quan sát receipt trước lỗi lưu xác nhận. Kiểm tra dead-letter/backlog trên console; không gửi lại thủ công khi chưa đối chiếu kết quả bên vendor. Lỗi Redis heartbeat được ghi riêng và không ngăn worker xử lý claim đã lấy từ PostgreSQL.

Phiên hỗ trợ có lease 120 giây và heartbeat 30 giây khi tab đang hiển thị. Tab ẩn ngừng heartbeat; khi quay lại, console xác minh quyền rồi mới mở form. Worker trả phiên hết hạn về hàng đợi mỗi 30 giây khi đang hoạt động. Nếu kết nối tạm lỗi, nội dung chưa gửi vẫn giữ lại; dùng Làm mới để xác minh phiên. Khi quyền đã chuyển cho người khác, phiên cũ không được gửi, đóng hoặc trả hội thoại.

Sau khi Redis restart, client tự kết nối lại với backoff tối đa 2 giây; từng command vẫn chỉ retry một lần. Worker nhận sự kiện kết nối sẵn sàng để đăng ký lại lịch quét notification và quét nhắc hết hạn/ghi heartbeat. Theo dõi `notification.poller.ready`, `notification.poller.restore.failed` và trạng thái worker trên console. PostgreSQL giữ các kết quả SENT, DEAD_LETTER và lịch retry khi queue Redis mất dữ liệu. Nếu nạp lại dữ liệu vào Redis đang chạy mà không ngắt kết nối, khởi động lại worker sau restore để đăng ký lại poller; không dùng FLUSHDB trên môi trường vận hành như cách sửa lỗi.

Khôi phục backup Redis không mở lại receipt nhận key đã ACK hoặc kéo dài cửa sổ retry đã hết trong PostgreSQL. Envelope chưa ACK bị mất thì API không tái tạo secret từ receipt metadata; dùng quy trình khôi phục key nếu không thể lấy lại envelope hợp lệ trong thời hạn. Không lưu dump hoặc key thật trong source/log.

Mobile: cấu hình `mobile/.env` theo mẫu rồi chạy `corepack pnpm --dir mobile start`. Android emulator dùng `EXPO_PUBLIC_API_URL=http://10.0.2.2:3000/api/v1`; điện thoại thật cần địa chỉ HTTPS hoặc mạng phát triển truy cập được. Đăng nhập native chỉ nhận CUSTOMER, refresh token và mã đã nhận lưu trong SecureStore theo tài khoản. Đăng xuất xóa các mã/receipt được ứng dụng hiện tại quản lý. Mở app từ thanh toán/thông báo luôn đọc lại API; URL return không xác nhận tiền.

`mobile/patches/decode-uri-component@0.5.1.patch` giữ thuật toán decoder đã vá bảo mật và đổi export sang CommonJS để tương thích `query-string` 7 của navigation. pnpm áp dụng patch qua `patchedDependencies`; Docker cần copy patch trước frozen install. Không bỏ patch để làm install xanh: chỉ gỡ khi dependency phía gọi hỗ trợ export upstream và regression URL/navigation, export, dependency audit đều đạt.

Để build Android manager, cần JDK 17, Android SDK 36 và NDK mà Expo prebuild chọn. Đặt `ANDROID_HOME` và `ANDROID_SDK_ROOT` cùng trỏ tới SDK đã cài, thêm platform-tools vào `PATH`. Expo gọi `pnpm` trong tiến trình con: bảo đảm `pnpm --version` chạy được (có thể dùng `corepack enable` hoặc `corepack enable --install-directory <thư-mục-tools>` rồi thêm thư mục đó vào `PATH`). Trong `mobile/`, chạy:

```sh
corepack pnpm exec expo prebuild --platform android --no-install
cd android
./gradlew :app:assembleRelease --max-workers=2
```

Windows dùng `gradlew.bat`. `mobile/pnpm-workspace.yaml` chọn `nodeLinker: hoisted` để đường dẫn CMake/codegen không vượt giới hạn công cụ Windows. Nếu thư mục `android/` cũ được sinh bằng layout isolated, sinh lại trong checkout build riêng bằng `expo prebuild --clean --platform android --no-install`; `--clean` xóa native project đã sinh, nên phải giữ lại mọi chỉnh sửa native cần thiết trước. APK release ở `android/app/build/outputs/apk/release/app-release.apk`, yêu cầu API HTTPS. Bản debug dùng cho API HTTP local và thường cần Metro; build APK thành công chưa chứng minh login, SecureStore, push hay thanh toán đã chạy đúng trên thiết bị. Tham khảo [Expo native generation](https://docs.expo.dev/workflow/continuous-native-generation/) và [pnpm với Expo](https://docs.expo.dev/guides/monorepos/).

## Kiểm tra hợp đồng và build

```sh
corepack pnpm --dir backend lint
corepack pnpm --dir backend typecheck
corepack pnpm --dir backend openapi:check
corepack pnpm --dir frontend build
corepack pnpm --dir mobile typecheck
```

Sau đổi API: sinh `backend` OpenAPI, sao chép sang `frontend/openapi/` và `mobile/openapi/`, chạy `openapi:generate` của mỗi client; không sửa generated types bằng tay. Bộ unit/integration/browser cùng fixtures nằm trong workspace review tại `tests/emukey/`; CI workspace chạy chúng với PostgreSQL/Redis disposable, không trỏ vào database vận hành.

## Phát hành và bàn giao cho nhà cung cấp




Backup `ACTIVATION_ENVELOPE_KEY` cùng chính sách bảo vệ database: biến này mã hóa cả key material và token tích hợp. `secrets:rotate:dev` chỉ đổi JWT/session secret, giữ nguyên khóa lưu trữ. Đổi khóa lưu trữ cần quy trình giải mã/mã hóa lại ciphertext có kiểm chứng; không thay giá trị trực tiếp trong `.env`.

`PROVIDER_HANDOFF_ENABLED=true` là mặc định cho đơn mua mới. Provider phải lưu endpoint/token, xác nhận ủy quyền, probe và bật tích hợp trong tab Tích hợp trước khi bán. Đơn cũ giữ fulfillment mode; không bật legacy cho provider mới để né tích hợp.

Worker bàn giao dùng PostgreSQL outbox và BullMQ poller. Key ciphertext lưu bền vững với AES-GCM, dùng secret cấu hình `ACTIVATION_ENVELOPE_KEY`; giữ backup khóa này an toàn cùng chính sách dữ liệu. Không thay secret đó khi chưa di chuyển ciphertext cũ có kiểm chứng.

Token kết nối là credential máy chủ nhà cung cấp chấp nhận; EmuKey mã hóa khi lưu, chỉ gửi trong Authorization qua HTTPS. URL được kiểm tra DNS/SSRF và không theo redirect. `PROVIDER_TEST_ORIGIN` chỉ dành loopback origin chính xác trong môi trường test/development, bị cấm trong production.

Nhà cung cấp phải lưu receipt idempotent trước ACK. Thời hạn/quyền lợi được gửi bằng snapshot đầy đủ có revision tăng dần; ứng dụng của bên bán kiểm tra whitelist tại máy chủ của họ. EmuKey không cung cấp activation/entitlement cho license mới. Buyer nhận key sau ACK hiện hành và xác nhận đã lưu như trước.

Đổi cấu hình đưa công việc đang chờ về lỗi cấu hình để xử lý; probe/bật cấu hình mới rồi gửi lại có lý do. Khi rollback, dừng checkout mới/worker và giữ dữ liệu outbox/ciphertext; không xóa dữ liệu hoặc coi key đã giao là chưa tồn tại.
# AI Assistant: nâng cấp và vận hành

Luồng Gemini hiểu câu hỏi theo ngữ nghĩa trước khi truy xuất: chuyển cách gọi tự nhiên, viết tắt/không dấu/lỗi gõ và câu tiếp nối thành intent, truy vấn tìm kiếm, điều kiện và tham chiếu có cấu trúc. Backend lấy ứng viên Catalog bằng tên đã đối chiếu hoặc embedding, rồi Gemini chọn nguồn liên quan trong danh sách ID được phép. Không buộc khách gõ đúng tên đầy đủ hoặc một mẫu câu. Khi cách gọi vẫn mơ hồ, trợ lý hỏi lại; lỗi provider được báo riêng. Giá/thiết bị/thời hạn/nhà cung cấp luôn dựng từ dữ liệu công bố, không lấy giá trị do mô hình tự tạo.

AI dùng Catalog công khai và tài liệu Knowledge `READY`/hiện hành. Khách có phiên Redis hết hạn sau 30 phút; Customer dùng Conversation/Message hiện có. Việc chuyển nhân viên chỉ thực hiện khi người dùng bấm xác nhận. AI dừng khi hội thoại đã vào hàng đợi Support.

Tại thư mục `backend`, dùng tài khoản bảo trì được phép cài extension `vector`, tạo view/table và role để chạy nâng cấp bổ sung, giữ nguyên dữ liệu hiện có:

```powershell
corepack pnpm build
corepack pnpm ai:catalog:index --upgrade-only
```

SQL nâng cấp được lấy từ vùng `emukey:ai-retrieval` trong `database/schema.sql`; không chạy lại trình khởi tạo database cho mục đích nâng cấp AI. Cấp membership `emukey_ai_reader` cho login của `AI_RETRIEVAL_DATABASE_URL` (hoặc `DATABASE_URL` nếu dùng mặc định), ví dụ `GRANT emukey_ai_reader TO your_inference_login;`. Reader chỉ có quyền SELECT trên ba view công khai; adapter luôn mở transaction `READ ONLY` và `SET LOCAL ROLE`, tương thích transaction pooler. Một login riêng cho `AI_RETRIEVAL_DATABASE_URL` giúp tách credentials khỏi trusted conversation/indexing services.

```powershell
corepack pnpm ai:catalog:index
corepack pnpm ai:catalog:index --status
```

Đặt `GEMINI_API_KEY`, `GEMINI_MODEL`, `GEMINI_EMBEDDING_MODEL` (mặc định `gemini-embedding-001`) và `GEMINI_EMBEDDING_DIMENSIONS` (mặc định `768`) trong cấu hình runtime. Worker kiểm tra thay đổi mỗi phút; chỉ embed lại nội dung có hash thay đổi và thử lại ở lần kiểm tra tiếp theo khi provider lỗi. Truy vấn luôn đối chiếu publication/hash/model/dimensions hiện tại, có fallback lexical được ghi log rõ ràng. Sau khi đổi model hoặc dimensions, chạy backfill và kiểm tra `--status` trước khi dựa vào tìm kiếm ngữ nghĩa.

API mới: `POST /api/v1/public/assistant/ask` nhận `question`, UUID `clientMessageId`, và `sessionId` do server cấp ở lượt trước. Endpoint Customer hiện có được mở rộng metadata `intent`, `outcome`, `catalogSources`, `recommendations`. Giá và card được dựng từ dữ liệu backend; hướng dẫn kỹ thuật chỉ trả đoạn trích đã xác minh, không tự thêm bước. Retry giữ nguyên intent nhưng sẽ trả `AI_SOURCES_CHANGED` nếu nguồn cũ không còn hợp lệ.

Kiểm thử Gemini thật là opt-in qua `EMUKEY_TEST_REAL_EMBEDDINGS=1` và `EMUKEY_TEST_REAL_AI=1`; chỉ dùng dữ liệu kiểm thử trong container biệt lập. Kiểm thử giao diện dùng API mô phỏng được ghi nhãn riêng.
