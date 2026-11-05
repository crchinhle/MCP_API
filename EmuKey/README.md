# EmuKey

Nền tảng bán và quản lý license: NestJS API/worker, PostgreSQL external, Redis, React web, Expo mobile quản lý. Build/runtime của sản phẩm nằm trong thư mục này; không cần workspace `agent/`, `context/` hoặc `tooling/` để chạy sản phẩm.

## Chuẩn bị môi trường

- Node 22.21.0, Corepack và pnpm 11.25.0; Docker Compose v2.
- PostgreSQL 15 hoặc mới hơn, database riêng đã tạo và tài khoản có quyền cài `pgcrypto`, `citext`, tạo schema/bảng/function/trigger. Không dùng database chung có dữ liệu ngoài EmuKey.
- `backend/database/schema.sql` là schema authority duy nhất, hiện có 24 bảng. `db:initialize` dành cho database mới; database có dữ liệu dùng guarded `db:upgrade`. Baseline `cf17043` đi qua continuity; baseline PostgreSQL 18 `9ed5729` có đường nâng trực tiếp tới `provider_handoff_20261104`.
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

## Nâng cấp database có dữ liệu

Sao lưu và diễn tập restore trước; dừng API và worker trong cửa sổ bảo trì để tránh code cũ chạy với schema mới. Lệnh chỉ hỗ trợ đúng baseline đã duyệt, giữ các hàng dữ liệu và chạy trong transaction có advisory lock/timeout:

```sh
corepack pnpm --dir backend db:upgrade --from=cf17043 --to=continuity_20261101
corepack pnpm --dir backend db:verify
```

Có thể chạy cùng lệnh bằng `docker compose --profile maintenance run --rm database-upgrade`. Schema lạ, checksum thay đổi hoặc cấu trúc bị sửa sau nâng cấp đều bị từ chối; không chỉnh fingerprint để bỏ qua. Bản nâng cấp thêm receipt nhận key (chỉ metadata), version/fingerprint schema, lease hỗ trợ, metadata thiết bị, citation và evidence review. Nó không chuyển tiền, gửi email hay gửi giao dịch chain. Khi code mới không tương thích, rollback bằng quy trình restore đã diễn tập; không chạy initializer trên dữ liệu cũ.

Đường phục hồi đã kiểm thử dùng physical base backup PostgreSQL 15 kèm WAL, khởi động trên cluster clone cùng phiên bản, đối chiếu fingerprint/dữ liệu rồi mới nâng cấp clone. `pg_dump/pg_restore` có thể viết lại cast trong constraint/index/generated expression: dữ liệu có thể phục hồi nhưng fingerprint khác và upgrader vẫn từ chối. Vì vậy không coi logical dump là bằng chứng có thể rollback rồi chạy lại upgrader. Cần diễn tập phương thức snapshot/physical restore mà dịch vụ PostgreSQL thực tế hỗ trợ trước khi bảo trì; không tự sửa fingerprint trong database. Xem [PostgreSQL pg_basebackup](https://www.postgresql.org/docs/15/app-pgbasebackup.html).

Giới hạn trên áp dụng cho đường continuity PostgreSQL 15 đã kiểm thử. Riêng baseline `9ed5729` PostgreSQL 18, dạng logical restore đã được tái tạo độc lập và đưa vào allowlist fingerprint; đã kiểm tra nâng clone từ backup Neon và giữ dữ liệu. Đây không phải quyền bỏ qua fingerprint cho mọi bản restore hay mọi phiên bản schema.

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

Sau upgrade continuity, chạy `db:upgrade --from=continuity_20261101 --to=provider_handoff_20261104` bằng guarded CLI. Fresh initializer tạo schema 24 bảng và ghi version mới. API/worker phải nâng cùng phiên bản; không reset database vận hành.

Database PostgreSQL 18 còn ở `9ed5729` dùng `corepack pnpm --dir backend db:upgrade --from=9ed5729 --to=provider_handoff_20261104` từ thư mục `EmuKey`, sau backup/restore và dừng API/worker. Đây là một transaction ghép các delta đã version hóa, không chạy fresh initializer. Chỉ hỗ trợ fingerprint nguyên bản và dạng logical restore đã kiểm thử của baseline đó; schema khác vẫn bị chặn. Các trường lịch sử chưa có ánh xạ an toàn làm upgrade dừng với `LEGACY_DATA_REQUIRES_EXPLICIT_ARCHIVAL`, cần xử lý có chủ đích trước khi chạy lại.

Đường legacy giữ `knowledge_chunks.token_count`, context hội thoại và lịch sử delivery thông báo; EMAIL đã gửi không bị đưa lại vào hàng chờ. Evidence trước chuyển đổi nằm ở `notifications.data._emukey_legacy_delivery`. Không khôi phục key cũ từ commitment/hash hoặc tự gửi lại email/key cho khách sau upgrade.

Backup `ACTIVATION_ENVELOPE_KEY` cùng chính sách bảo vệ database: biến này mã hóa cả key material và token tích hợp. `secrets:rotate:dev` chỉ đổi JWT/session secret, giữ nguyên khóa lưu trữ. Đổi khóa lưu trữ cần quy trình giải mã/mã hóa lại ciphertext có kiểm chứng; không thay giá trị trực tiếp trong `.env`.

`PROVIDER_HANDOFF_ENABLED=true` là mặc định cho đơn mua mới. Provider phải lưu endpoint/token, xác nhận ủy quyền, probe và bật tích hợp trong tab Tích hợp trước khi bán. Đơn cũ giữ fulfillment mode; không bật legacy cho provider mới để né tích hợp.

Worker bàn giao dùng PostgreSQL outbox và BullMQ poller. Key ciphertext lưu bền vững với AES-GCM, dùng secret cấu hình `ACTIVATION_ENVELOPE_KEY`; giữ backup khóa này an toàn cùng chính sách dữ liệu. Không thay secret đó khi chưa di chuyển ciphertext cũ có kiểm chứng.

Token kết nối là credential máy chủ nhà cung cấp chấp nhận; EmuKey mã hóa khi lưu, chỉ gửi trong Authorization qua HTTPS. URL được kiểm tra DNS/SSRF và không theo redirect. `PROVIDER_TEST_ORIGIN` chỉ dành loopback origin chính xác trong môi trường test/development, bị cấm trong production.

Nhà cung cấp phải lưu receipt idempotent trước ACK. Thời hạn/quyền lợi được gửi bằng snapshot đầy đủ có revision tăng dần; ứng dụng của bên bán kiểm tra whitelist tại máy chủ của họ. EmuKey không cung cấp activation/entitlement cho license mới. Buyer nhận key sau ACK hiện hành và xác nhận đã lưu như trước.

Đổi cấu hình đưa công việc đang chờ về lỗi cấu hình để xử lý; probe/bật cấu hình mới rồi gửi lại có lý do. Khi rollback, dừng checkout mới/worker và giữ dữ liệu outbox/ciphertext; không xóa dữ liệu hoặc coi key đã giao là chưa tồn tại.
