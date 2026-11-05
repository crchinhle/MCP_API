# Kế hoạch chuyển EmuKey sang phát hành và bàn giao key cho nhà cung cấp

> Cập nhật 05/11/2026: đã nghiệm thu luồng SePay sandbox → Sepolia → receiver kiểm thử độc lập → buyer retrieve/ACK. Đã backup/restore, nâng Neon development, kiểm thử restart API/worker/Redis và đối chiếu sơ đồ. Phép đo mới sau sửa lỗi: 19,039 giây từ tạo license đến vào block; 32,782 giây đến CONFIRMED; 33,943 giây đến provider ACK. Đây là một mẫu sandbox, không phải cam kết thời gian production hoặc tích hợp nhà cung cấp thật. Chi tiết ở mục 12.
> Khi thực hiện: dùng `executing-plans`, làm tuần tự theo các gate dưới đây. Không tự commit, push, triển khai hoặc sửa dịch vụ bên ngoài. Không tự giao việc cho subagent.

**Goal:** EmuKey bán và phát hành key theo ủy quyền; tự động bàn giao key cho hệ thống nhà cung cấp. Nhà cung cấp quản lý whitelist và thực thi quyền sử dụng trong sản phẩm.

**Architecture:** Giữ modular monolith NestJS. Module Licensing sở hữu tích hợp nhà cung cấp, dữ liệu key và bàn giao; PostgreSQL lưu trạng thái bền vững, BullMQ kích hoạt xử lý nền. Hệ thống nhà cung cấp là hệ thống ngoài ranh giới EmuKey.

**Tech Stack:** React/Vite/Ant Design/TanStack Query; NestJS, `pg`, PostgreSQL, Redis/BullMQ; giữ SePay và blockchain hiện có. Dùng Node `crypto`, không thêm SDK chữ ký license hoặc ORM.

**Spec:** Các quyết định tại mục 1–7 của tài liệu này cụ thể hóa yêu cầu trong cuộc trao đổi ngày 04/11/2026. Chúng thay thế yêu cầu cũ về việc EmuKey trực tiếp kích hoạt thiết bị/cấp entitlement cho luồng mới. Các task triển khai ở mục 8.

## 1. Phạm vi đã thống nhất và quyết định thiết kế

- EmuKey được nhà cung cấp ủy quyền phát hành key, không có thao tác duyệt từng key.
- Key ngẫu nhiên khó đoán; quyền lợi, thời hạn và trạng thái nằm trong dữ liệu máy chủ, không được tin từ nội dung do khách gửi lên.
- EmuKey tự động gửi key cho máy chủ nhà cung cấp. Phản hồi là xác nhận đã ghi nhận dữ liệu, không phải xét duyệt kinh doanh.
- Nhà cung cấp kiểm tra key khi người mua sử dụng sản phẩm. EmuKey không cung cấp activation/device proof/entitlement cho license thuộc luồng mới.
- Không thêm cặp khóa ký bản quyền của từng nhà cung cấp. Vẫn cần HTTPS, token kết nối giữa máy chủ và mã hóa bí mật khi lưu trữ. Đây không phải chữ ký số trên license.
- **App Kotlin chỉ là công cụ demo ngoài phạm vi đồ án. Không đưa Kotlin, màn hình demo, xuất CSV, thiết bị demo, công nghệ Compose hoặc quy trình chạy demo vào sơ đồ hay thuyết minh đồ án.**
- Web và mobile quản lý React Native vẫn thuộc sản phẩm EmuKey. Không nhầm mobile quản lý với Kotlin demo.
- Giữ danh mục, gói, điều khoản, thanh toán, lịch sử đơn hàng, gia hạn, hỗ trợ và thông báo hiện có.
- Giữ cơ chế xác nhận blockchain hiện hành cho phát hành/lifecycle trong đợt chuyển đổi này. Blockchain xác nhận bằng chứng phát hành; xác nhận nhà cung cấp cho biết dữ liệu đã được bàn giao. Không coi hai xác nhận là một.
- Không thêm chức năng xác thực ngoại tuyến. Không tuyên bố chống sửa APK, chống sao chép key hoặc thu hồi tức thì khi bên nhận mất kết nối.
- Chỉ thay schema tại `EmuKey/backend/database/schema.sql`; giữ toàn bộ dữ liệu và thay đổi đã có. Chưa xóa bảng/contract cũ chỉ để làm sơ đồ gọn.

### Vì sao cần sửa nhiều hơn một form cấu hình

Source hiện tại đã sinh secret bằng `randomBytes(32)` trong `CommerceService.newActivation`; không cần sáng tạo thuật toán key mới. Tuy nhiên, secret hiện nằm trong Redis envelope có TTL; license phát hành gắn với chain command; nhiều UI và API coi thiết bị/entitlement là bước tiếp theo. Bàn giao cho một máy chủ có thể tắt nhiều giờ cần key và công việc gửi được lưu bền vững, cùng trạng thái riêng trên UI.

Các owner đã kiểm tra:

| Owner hiện có | Điều cần thay đổi |
|---|---|
| `EmuKey/backend/src/modules/commerce-payment/application/commerce.service.ts` | `fulfillPayment`, `newActivation`: giữ IPN idempotent, bổ sung key material bền vững trong giao dịch phát hành |
| `EmuKey/backend/src/modules/commerce-payment/infrastructure/commerce.repository.ts` | Giao dịch payment/license/command; thêm hook application cùng transaction cho luồng mới |
| `EmuKey/backend/src/modules/blockchain/application/license-query.service.ts` | Nhận key hiện dựa Redis; bổ sung gate nhà cung cấp đã nhận và nguồn secret bền vững |
| `EmuKey/backend/src/modules/blockchain/infrastructure/activation-delivery.repository.ts` | Receipt người mua nhận key; tiếp tục dùng, không biến thành receipt của nhà cung cấp |
| `EmuKey/backend/src/modules/licensing/licensing.service.ts` | Rotate/recover/lifecycle; tách các chức năng device/entitlement ra khỏi luồng mới |
| `EmuKey/backend/src/modules/blockchain/infrastructure/chain-event.repository.ts` | Điểm cập nhật projection khi xác nhận/reorg; nối với application port bàn giao |
| `EmuKey/backend/src/modules/blockchain/infrastructure/redis-activation-envelope.ts` | Có AES-GCM sẵn; tái sử dụng nguyên tắc mã hóa, chuyển secret luồng mới sang PostgreSQL |
| `EmuKey/backend/src/worker.module.ts` | Đăng ký worker bàn giao và phục hồi công việc từ PostgreSQL |

## 2. Luồng nghiệp vụ đích

1. Provider hoàn thiện hồ sơ, cấu hình URL tiếp nhận và token do máy chủ của họ chấp nhận.
2. Provider xác nhận ủy quyền phát hành, chạy kiểm tra kết nối thành công và bật tích hợp. Endpoint phải nhận đúng product ID của EmuKey; một kết nối/provider nhận nhiều sản phẩm.
3. Khách chọn sản phẩm, gói, chấp nhận điều khoản và thanh toán như hiện tại.
4. IPN hợp lệ ghi nhận thanh toán, license, chain command và key đã mã hóa trong một transaction. Không gửi HTTP bên ngoài trong transaction này.
5. Khi license có bằng chứng chain-confirmed hợp lệ, application ghi một bản bàn giao chứa snapshot đầy đủ và revision tăng dần.
6. Worker gửi key và snapshot tới nhà cung cấp bằng HTTPS. Nhà cung cấp ghi vào DB của họ rồi trả receipt.
7. EmuKey xác nhận receipt đúng delivery/license/revision, đánh dấu đã bàn giao. Lúc này khách mới được nhận key và thấy “Sẵn sàng sử dụng”.
8. Khách dùng key trong sản phẩm của bên bán. Kiểm tra whitelist và mở tính năng diễn ra bên ngoài EmuKey.

**Bất biến:** `PaymentAccepted != LicenseIssued != ProviderAccepted != CustomerKeyAcknowledged`. Bốn sự kiện khác nhau, không lấy một sự kiện suy ra ba sự kiện còn lại.

### Thanh toán trong lúc tích hợp hỏng

- Chặn checkout mới khi tích hợp chưa sẵn sàng; backend kiểm tra, frontend chỉ giải thích.
- Nếu khách đã có phiên thanh toán rồi kết nối mới hỏng: vẫn ghi nhận IPN hợp lệ và giữ quyền lợi; ghi trạng thái chờ bàn giao, gửi lại sau.
- Không yêu cầu khách thanh toán lại, không tự đánh dấu thanh toán thất bại vì webhook nhà cung cấp lỗi.
- Giữ cách tính kỳ hạn hiện tại, đưa `periodStart` và `expiresAt` vào snapshot và UI. Chậm bàn giao không tự dịch ngày hết hạn ngoài blockchain; hỗ trợ xử lý bù thời gian/hoàn tiền theo quy trình có bằng chứng hiện có.
- Với sản phẩm bán giới hạn thiết bị, giới hạn đó là quyền lợi trong snapshot; nhà cung cấp phải thực thi. EmuKey không hiển thị số thiết bị đang dùng nếu không có dữ liệu từ bên bán.

## 3. Mô hình trạng thái và dữ liệu

### 3.1. Trạng thái

- Giữ `orders.order_status` và `licenses.status` hiện có. Không nhét lỗi giao key vào payment status.
- Thêm `fulfillment_mode` vào orders/licenses: `LEGACY_DEVICE` cho dữ liệu cũ, `PROVIDER_HANDOFF` cho đơn mua mới sau cutover; snapshot bất biến. Renewal kế thừa mode của license đích.
- Thêm `provider_revision BIGINT NOT NULL DEFAULT 0` vào licenses. Mỗi thay đổi snapshot xuất bản tăng revision dưới row lock; key version không thay cho revision vì renewal/suspend cũng cần đồng bộ.
- Trạng thái delivery: `PENDING`, `SENDING`, `RETRY_WAIT`, `DELIVERED`, `FAILED`, `SUPERSEDED`. Claim có lease; hết lease được nhận lại.
- UI tổng hợp: chờ xác nhận phát hành, đang bàn giao, bàn giao lỗi, sẵn sàng sử dụng, đang đồng bộ thay đổi. Không lưu thêm một status trùng lặp dễ lệch.
- Điều kiện nhận key mới: license ACTIVE, chưa hết hạn, key trust hợp lệ, receipt nhà cung cấp cho revision hiện hành đã ghi bền vững, đúng người mua/key version, chưa ACK nhận key.
- Khi revoke/suspend đang chờ bên bán: hiển thị đồng thời trạng thái EmuKey và trạng thái đồng bộ. Không tuyên bố bên bán đã khóa khi chưa có ACK.

### 3.2. Ba bảng mới dự kiến

| Bảng | Cột/constraint chính | Trách nhiệm |
|---|---|---|
| `provider_integrations` | `id`, `provider_user_id UNIQUE`, `endpoint_url`, `credential_ciphertext`, `credential_iv`, `credential_tag`, `encryption_key_id`, `config_version`, `status`, `authorized_at`, `authorization_version`, `verified_at`, `verified_config_version`, `created_at`, `updated_at` | Một cấu hình nhận key cho mỗi provider; ENABLED chỉ hợp lệ khi bản cấu hình hiện hành đã được probe |
| `license_key_materials` | `license_id`, `key_version`, `command_id UNIQUE`, `commitment`, `ciphertext`, `iv`, `auth_tag`, `encryption_key_id`, `created_at`, `retired_at`; PK `(license_id,key_version)` | Secret bền vững để giao cho hai bên; không lưu plaintext |
| `provider_license_deliveries` | `id`, `license_id`, `provider_user_id`, `integration_id`, `config_version`, `revision`, `key_version`, `event_type`, `snapshot JSONB`, `status`, `attempt_count`, `next_attempt_at`, `lease_token`, `lease_expires_at`, `last_error_code`, `receipt_id`, `accepted_at`, `created_at`, `updated_at`; UNIQUE `(license_id,revision)` | Outbox nghiệp vụ và receipt bên nhận, không tạo thêm outbox chung |

- FK composite bảo đảm provider của delivery, integration và license cùng một chủ thể; thêm UNIQUE cần thiết ở bảng đích.
- Snapshot không chứa key plaintext/token. Worker lấy secret từ key material khi gửi; BullMQ chỉ mang tín hiệu poll, không chứa key/snapshot. PostgreSQL chọn delivery bằng lease khi worker được đánh thức.
- `license_key_deliveries` hiện có tiếp tục là receipt người mua nhận key. ACK của người mua không được xóa secret cần cho nhà cung cấp gửi lại/đồng bộ.
- Lưu ciphertext key hiện hành trong vòng đời bản quyền; chỉ retire key cũ sau rotate đã được bên nhận ACK. Không xóa lịch sử receipt; không đặt TTL Redis làm tuổi thọ key.
- Token kết nối phải giải mã được để gửi nên không chỉ lưu hash. Khóa mã hóa lưu bằng cấu hình bí mật, có key ID và hướng dẫn backup/rotation; không gửi cho khách/provider UI khi đọc lại cấu hình.
- Dự kiến từ 21 lên 24 bảng nếu schema nền chưa đổi. Bộ kiểm tra phải lấy schema thực tế làm chuẩn, không ép con số này bằng cách bỏ bảng khác.

## 4. Hợp đồng tích hợp nhà cung cấp v1

Đây là API **của nhà cung cấp mà EmuKey gọi**, không phải API kích hoạt sản phẩm được thêm vào EmuKey. URL đầy đủ được cấu hình, không tự nối URL lấy từ payload.

```http
POST {provider.endpointUrl}
Authorization: Bearer <server-to-server-token>
Idempotency-Key: <deliveryId>
Content-Type: application/json
```

```ts
type ProviderLicenseMessage = {
  schemaVersion: 1;
  deliveryId: string;
  eventType: 'ISSUED' | 'RENEWED' | 'KEY_REPLACED' | 'SUSPENDED' | 'RESUMED' | 'REVOKED' | 'TRUST_CHANGED';
  revision: number;
  providerId: string;
  productId: string;
  licenseId: string;
  publicLicenseId: string;
  keyVersion: number;
  licenseKey: string; // Chỉ có trong HTTP qua TLS; luôn redacted khỏi logs.
  plan: { id: string; version: number; entitlements: Record<string, unknown>; maxDevices: number };
  periodStart: string;
  expiresAt: string;
  status: 'ACTIVE' | 'SUSPENDED' | 'EXPIRED' | 'REVOKED';
  usable: boolean; // false nếu trust/reorg chưa giải quyết, dù status vẫn ACTIVE.
};
type ProviderReceipt = {
  deliveryId: string;
  licenseId: string;
  revision: number;
  receiptId: string;
  result: 'ACCEPTED';
};
```

- `revision` giới hạn số nguyên an toàn JSON; DB BIGINT nhưng serializer phải reject overflow. Timestamp UTC ISO-8601.
- Snapshot chứa toàn bộ trạng thái cần thiết. Không cộng thêm tháng hoặc cộng quota mỗi lần nhận event; nhà cung cấp upsert giá trị tuyệt đối.
- Bên nhận authenticate token, đối chiếu provider/product đã đăng ký, hash key để tra cứu, ghi snapshot và receipt trong một transaction rồi trả HTTP 200/201.
- Gửi lại cùng delivery và cùng nội dung: trả receipt cũ. Cùng delivery nhưng khác nội dung: 409. Revision thấp hơn bản đã lưu: 409 `STALE_REVISION`; không khôi phục key/trạng thái cũ.
- Một license chỉ có một key hiện hành; `KEY_REPLACED` thay hash cũ atomically. Token kết nối không được đưa vào APK/JavaScript phía khách.
- Chỉ coi thành công khi HTTP 200/201 và body receipt hợp lệ, khớp delivery/license/revision. HTTP 202, HTML 200, redirect hoặc receipt sai đều không phải đã lưu.
- Probe dùng cùng URL: `{schemaVersion:1,type:'CONNECTION_TEST',providerId,nonce}`; trả `{schemaVersion:1,type:'CONNECTION_TEST_ACK',providerId,nonce}`. Không tạo license thật khi probe.
- Không gửi tên, email, số điện thoại người mua khi whitelist không cần các dữ liệu này.
- Máy chủ bên bán tự kiểm tra expiry ở mỗi lần sử dụng, không phụ thuộc job EXPIRED đến đúng giờ. Token, rate limit và thông báo lỗi chung hạn chế dò key.

### Retry và lỗi

- HTTP timeout tối đa 10 giây, body phản hồi tối đa 64 KiB, không theo redirect; giới hạn kích thước entitlement/payload trước enqueue.
- Timeout/network/408/429/5xx: gửi lại cùng delivery ID và cùng key; 8 lần tổng cộng với lịch chờ 5s, 30s, 2m, 10m, 30m, 2h, 6h, có jitter. Retry-After hợp lệ được tôn trọng trong giới hạn cấu hình.
- 400/401/403/404/409/422: FAILED có mã lý do, không lặp vô hạn. 401/403 yêu cầu sửa cấu hình. STALE_REVISION chỉ SUPERSEDED khi EmuKey có bằng chứng revision mới hơn đã được nhận; nếu không, cần đối soát.
- Lỗi receipt/malformed response: FAILED_PROTOCOL, nằm trong status FAILED, chặn báo hoàn tất.
- Retry thủ công cần đúng provider hoặc system admin, reason và trạng thái hợp lệ; không tạo key mới. Không cho retry DELIVERED/SENDING còn lease.
- Sửa endpoint/token tạo config version mới và yêu cầu probe. Không âm thầm gửi công việc cũ sang hệ thống mới; thao tác resume có chủ đích ghi nhận target version đã kiểm tra. Payload/delivery ID giữ nguyên.
- Worker dùng lease token khi ghi ACK để worker cũ không ghi đè kết quả mới. Không gọi HTTP khi đang giữ DB transaction mở.
- Full snapshot revision mới có thể supersede bản chưa gửi cũ; bản đang gửi có thể đến muộn nhưng bên nhận phải reject revision thấp. Không để một renewal lỗi chặn vĩnh viễn việc thu hồi.

### Bảo vệ URL tiếp nhận

Chỉ HTTPS trên môi trường thật; xác minh hostname do provider khai báo, chặn loopback/private/link-local/metadata IP và DNS rebinding ở lúc kết nối, không chỉ lúc lưu URL. Không chuyển token qua redirect. Local test chỉ dùng allowlist chính xác của test runtime, tắt trong production; không có switch mở mọi private address. Tham khảo [OWASP SSRF Prevention](https://cheatsheetseries.owasp.org/cheatsheets/Server_Side_Request_Forgery_Prevention_Cheat_Sheet.html).

## 5. Transaction, blockchain và các thay đổi vòng đời

### Phát hành

- Thêm application writer của Licensing nhận `PoolClient` hiện hành: `persistKeyMaterial(tx, material)` và `recordProviderSnapshot(tx, snapshot)`; concrete repository thuộc Licensing, module khác chỉ gọi published port.
- `persistKeyMaterial` được gọi trong transaction tạo license/command sau payment hợp lệ. Encrypt trước transaction, FK/unique và commitment validate trong transaction; IPN lặp không ghi đè secret của license đã tồn tại.
- Sau chain confirmation, ghi snapshot/outbox cùng transaction cập nhật projection qua published port. Cần điều chỉnh seam application/transaction hiện đang nằm ở `ChainEventRepository`; không cho repository blockchain trực tiếp truy cập repository Licensing.
- Scheduler đọc PostgreSQL để phục hồi các công việc đủ điều kiện khi queue mất dữ liệu. Không dựa vào một event trong memory hoặc Redis làm bằng chứng duy nhất.
- Không thay smart contract/ABI hoặc redeploy chỉ để thêm webhook. Luồng mới không gửi device sync command; số thiết bị đang dùng không phải quyền sở hữu của EmuKey trong mô hình này.

### Gia hạn, suspend/resume/revoke và cấp lại key

| Thao tác | Xử lý EmuKey | Xử lý bên bán |
|---|---|---|
| Gia hạn | Giữ key, chờ kết quả renewal hiện có, tăng revision và gửi expiry tuyệt đối | Upsert expiry; retry không cộng thời hạn thêm |
| Suspend/revoke | Xác nhận lifecycle hiện có, gửi snapshot usable=false | Vô hiệu key và phản hồi receipt |
| Resume | Gửi revision mới ACTIVE, usable phụ thuộc trust/expiry | Bật lại nếu đủ điều kiện |
| Rotate/recover | Sinh key version mới bền vững, chờ chain confirmation, gửi replacement | Thay key atomically, key cũ hết hiệu lực; chỉ sau ACK mới giao key mới cho người mua |
| Reorg/trust mất | Khóa nhận key phía EmuKey, phát revision usable=false; phục hồi phát revision mới theo canonical state | Cập nhật usable; mất kết nối phải hiển thị đang chờ đồng bộ, không hứa vô hiệu tức thì |

Đợt này không thay vai trò blockchain thành một nhật ký thuần túy. Nếu sau này bỏ blockchain khỏi điều kiện phát hành, đó là thay đổi riêng đối với trigger, contract, reconciliation và dữ liệu; không âm thầm gộp vào kế hoạch này.

## 6. API và giao diện EmuKey

### API mới dự kiến (đều dùng session/role hiện tại)

| Route | Vai trò | Kết quả/quy tắc |
|---|---|---|
| `GET /provider/integration` | PROVIDER_ADMIN | Cấu hình đã che token, trạng thái probe và ủy quyền của chính mình |
| `PUT /provider/integration` | PROVIDER_ADMIN | endpoint, token nhập mới nếu thay, chấp nhận ủy quyền; optimistic config version; token bỏ trống giữ giá trị cũ |
| `POST /provider/integration/test` | PROVIDER_ADMIN | Probe nonce ràng buộc config version hiện hành; kết quả cũ không bật cấu hình mới |
| `POST /provider/integration/state` | PROVIDER_ADMIN | DTO `action: 'ENABLE' \| 'DISABLE'`; chỉ bật sau probe hiện hành và ủy quyền |
| `GET /provider/license-deliveries` | PROVIDER_ADMIN | Filter status/license, phân trang; chỉ metadata, không key/token |
| `POST /provider/license-deliveries/:id/retry` | PROVIDER_ADMIN | Kiểm tra ownership, lease, config đã kiểm tra và reason |
| `GET /operations/license-deliveries` | SYSTEM_ADMIN, SUPPORT_STAFF | Giám sát metadata; SUPPORT_STAFF chỉ đọc |
| `POST /operations/license-deliveries/:id/retry` | SYSTEM_ADMIN | Đối soát/gửi lại có reason, không bỏ qua ownership của integration |

Ghi rõ DTO bật/tắt trong OpenAPI; disable ngừng gửi và chặn checkout mới, không đổi payment đã nhận. Không tạo role mới.

Giữ API danh sách/chi tiết license và nhận/ACK key hiện có; thêm `fulfillmentMode`, `providerDeliveryStatus`, `providerAcceptedAt`, `providerRevision`, `providerAcceptedRevision`, `keyAvailable` vào DTO. Giữ public verification ở mức bằng chứng bản quyền, không gọi nó là API mở khóa sản phẩm.

### Giao diện

- Provider: thêm tab “Tích hợp” vào `ProviderOperationsScreen.tsx`, trạng thái cấu hình, URL, nhập token được che, xác nhận ủy quyền, kiểm tra kết nối và bật/tắt. Không tạo portal mới.
- Provider licenses: thêm trạng thái bàn giao, thời điểm nhận và hành động gửi lại khi hợp lệ. Bỏ số thiết bị đang dùng/điều khiển thiết bị đối với mode mới; vẫn có quyền lợi “tối đa ... thiết bị, do nhà cung cấp thực thi” nếu gói bán có giới hạn này.
- Buyer payment/orders/licenses: hiển thị riêng “Đã thanh toán”, “Đang phát hành”, “Đang bàn giao”, “Sẵn sàng sử dụng”, “Cần xử lý bàn giao”. Lỗi bàn giao không hiện nút trả tiền lần nữa.
- Sau ACK: nút nhận/sao chép key, hướng dẫn sử dụng trong sản phẩm bên bán, liên hệ hỗ trợ, gia hạn. Giữ nút “Xem đơn hàng đã mua” về `/buyer/orders`.
- Không có nút kích hoạt thiết bị, device proof, entitlement hoặc mở Kotlin cho license mới.
- System/support: thêm bảng theo dõi gửi lỗi vào màn hình hiện có; không lộ request/response chứa bí mật.
- Mobile quản lý: cập nhật DTO và trạng thái tương đương web; giữ mua/quản lý theo khả năng hiện có, không thêm màn hình sử dụng key như app demo.
- Thông báo “bản quyền sẵn sàng” chỉ phát sau provider ACK, deduplicate theo license/key version hoặc revision phù hợp; thông báo thay đổi lifecycle chỉ mô tả đúng mức xác nhận.

## 7. Migration và giới hạn demo

- Đầu tiên thêm schema tương thích, default mode cũ và cấu hình mới mặc định DISABLED. Không tự đánh dấu provider đã ủy quyền.
- Chỉ bật luồng mới cho provider đã cấu hình/probe; gate checkout mới theo cấu hình. Sau cutover, provider chưa tích hợp không được tiếp tục bán bằng luồng legacy chỉ vì thiếu config.
- Đơn chờ thanh toán trước cutover giữ mode snapshot cũ để IPN đến muộn không đổi nghĩa; không đổi mode của đơn đã thu tiền.
- License cũ giữ lịch sử. Không tự sinh lại key cũ: hash/commitment không khôi phục được secret đã mất. Muốn chuyển một license cũ phải có workflow đối soát riêng, rotate có chủ đích và provider ACK; không nằm trong batch backfill tự động.
- Public activation/entitlement/device endpoints phải reject mode mới ngay backend. Khi không còn license legacy cần tương thích, gỡ controller/DTO/UI cũ theo dependency audit; giữ dữ liệu lịch sử, không drop trong migration đầu.
- Backup và dry-run schema trên DB kiểm thử trước upgrade; production/service thật chỉ thao tác khi được phép. Có rollback ứng dụng nhưng vẫn giữ outbox/key ciphertext mới; không rollback schema bằng drop dữ liệu.
- Rollback runtime: dừng checkout mới và worker bàn giao, giữ payment evidence/outbox. Phiên bản cũ không được nhận mode mới như legacy. Không thể dùng rollback DB để thu hồi key đã bàn giao ra ngoài.

**Demo ngoài phạm vi đồ án:** giữ `EmuKey/license-client-demo/` làm tài sản phát triển, không xóa. Khi cần demo, app gọi máy chủ nhà cung cấp mẫu, không gọi activation/entitlement EmuKey. Máy chủ mẫu thuộc fixture kiểm thử, dữ liệu riêng, không thêm role/bảng vào product DB; không nằm trong Docker Compose triển khai sản phẩm mặc định.

Sơ đồ đồ án chỉ vẽ một hộp ngoài ranh giới: **“Hệ thống nhà cung cấp”**, mũi tên nhận key/cập nhật quyền và trả xác nhận. Không thể hiện Kotlin, server fixture, công cụ test hoặc màn hình demo. Hướng dẫn chạy demo chỉ nằm trong README kỹ thuật của demo/fixture, không trong thuyết minh chức năng và công nghệ đồ án.

## 8. Các gói công việc theo thứ tự

Mỗi task: viết test hành vi lỗi trước khi sửa logic, chạy focused test, sửa owner hiện có, chạy lại test và kiểm tra diff. Các đường dẫn mới dưới đây là dự kiến, phải tìm lại trước khi tạo để tránh trùng với thay đổi đang diễn ra.

### Task 1 — Chốt contract và predicate, khóa phạm vi

**Sửa:** `context/current/APP_IMPLEMENTATION_PLAN.md`, `context/current/chuc_nang_toan_he_thong_ver2.0.md`, `context/current/cong_nghe_he_thong.md` khi bắt đầu triển khai; không ghi tính năng kế hoạch là đã hoàn thành.

**Tạo:** `EmuKey/backend/src/modules/licensing/domain/provider-delivery-policy.ts`, `EmuKey/backend/src/modules/licensing/application/ports/provider-license-gateway.port.ts`.

- [x] Định nghĩa message/receipt ở mục 4, `FulfillmentMode`, retry policy và predicate nhận key; dùng DTO ở boundary, domain không import NestJS.
- [x] Đặt `ProviderLicenseGatewayPort`; application lấy URL/credential từ cấu hình để gọi adapter, không đưa chúng vào domain message; validate receipt trong application.
- [x] Định nghĩa published writer nhận transaction và snapshot ở mục 5; service điều phối nghiệp vụ, repository chỉ ghi/đọc.
- [x] Tạo `tests/emukey/backend/unit/provider-delivery-policy.test.ts`: paid+chain-confirmed nhưng chưa provider ACK => không giao key; ACK revision cũ => không giao key; new mode không được activate; retry không đổi key.

**Gate:** có một contract thống nhất cho backend, UI và máy chủ bên bán; không có thuật ngữ “key tự xác thực offline”.

### Task 2 — Schema và lưu key bền vững

**Sửa:** `EmuKey/backend/database/schema.sql`, `EmuKey/backend/src/platform/database/verify-baseline-database.ts`, `EmuKey/backend/src/entrypoints/database/upgrade.ts`, `tooling/emukey/verification/validate-baseline.mjs`, `tooling/emukey/verification/verify-schema-columns.mjs` theo owner thực tế.

**Tạo:** `EmuKey/backend/src/modules/licensing/infrastructure/provider-delivery.repository.ts`, `EmuKey/backend/src/modules/licensing/infrastructure/license-key-material.repository.ts`.

- [x] Thêm ba bảng/constraint/index và mode/revision; fresh-install và upgrade cùng schema authority, không tạo bản schema thứ hai.
- [x] Dùng codec AES-GCM cho key material và credential mới; AAD gắn license/key version hoặc provider, có key ID. Giữ định dạng Redis legacy; không ghi secret ra logs.
- [x] Transaction rollback phải xóa đồng thời license/command/key mới; IPN lặp không thay ciphertext của key đã tạo.
- [x] Mở rộng `tests/emukey/backend/integration/database/schema-upgrade.integration.test.ts` và `baseline-schema.integration.test.ts`; tạo `tests/emukey/backend/integration/licensing/provider-delivery.integration.test.ts` cho FK chéo provider, duplicate revision, lease và durable key.

**Gate:** mất Redis/restart worker không mất key mới; DB legacy upgrade không mất dữ liệu.

### Task 3 — Cấu hình tích hợp, phân quyền và HTTP adapter

**Tạo trong `EmuKey/backend/src/modules/licensing/`:** `application/provider-integration.service.ts`, `infrastructure/provider-integration.repository.ts`, `infrastructure/http-provider-license.gateway.ts`, `presentation/provider-integration.controller.ts`, `presentation/provider-integration.dto.ts`.

**Sửa:** `licensing.module.ts`, `EmuKey/backend/src/platform/config/environment.ts`, `EmuKey/backend/src/platform/observability/log-redaction.ts`, `EmuKey/backend/.env.example`.

- [x] Implement API mục 6, versioned config/probe, masked read, scope theo actor.sub thay vì provider ID tự khai.
- [x] Adapter dùng dependency HTTP sẵn có; xác minh API theo version cài đặt trước khi code SSRF/timeouts. Không thêm thư viện chỉ để POST JSON.
- [x] Token không được trả lại qua GET; endpoint đổi phải probe lại; giữ token cũ nếu form bỏ trống.
- [x] Test `tests/emukey/backend/security/provider-integration.security.test.ts`: provider A không xem/sửa/retry dữ liệu B; token/key redaction; private IP, IPv6 loopback, redirect và DNS đổi bị chặn.
- [x] Integration kiểm tra probe/version cũ không enable config mới, disable chặn đơn mới nhưng vẫn nhận IPN của phiên checkout có trước; không tạo unit test trùng hành vi đã kiểm tra tại DB/HTTP boundary.

**Gate:** cấu hình đúng có thể probe; cấu hình sai/chéo chủ không thực hiện HTTP có credential.

### Task 4 — Ghép phát hành, outbox và worker

**Sửa:** commerce service/repository/module, blockchain application/confirmation seam/module, licensing module, `EmuKey/backend/src/worker.module.ts`.

**Tạo trong Licensing:** `application/provider-delivery.service.ts`, `worker/provider-delivery.processor.ts`, `worker/provider-delivery.scheduler.ts`, `licensing-worker.module.ts`.

- [x] Tích hợp `persistKeyMaterial` vào payment transaction; chuẩn bị mode và delivery cho canonical snapshot; unique constraint chống IPN/chain event lặp.
- [x] Implement lease claim/finish và recovery từ PostgreSQL; BullMQ đánh thức poller, PostgreSQL chọn delivery. Xem điều chỉnh kỹ thuật ở mục 12.
- [x] Cập nhật ACK chỉ khi lease còn thuộc worker và receipt đúng; ghi thông báo qua Operations application interface trong cùng transaction với durable ACK, event key idempotent.
- [x] Thêm `provider-handoff.service.test.ts` và mở rộng integration Task 2: bên bán lưu xong nhưng response mất, hai worker cùng nhận, lease/retry exhausted, receipt sai; unit kiểm tra Redis reconnect đăng ký lại poller và key recovery không dựa Redis. Kill/restart tiến trình thật còn ở Task 9.
- [x] Mở rộng `tests/emukey/backend/integration/commerce/commerce-flow.integration.test.ts`: IPN duplicate chỉ một key; IPN trong lúc provider offline vẫn PAYMENT_ACCEPTED.

**Gate:** thanh toán sandbox/test tạo đúng một key; nhà cung cấp tắt rồi bật lại nhận đúng key đó, không phát hành lại.

### Task 5 — Đồng bộ vòng đời và nhận key của khách

**Sửa:** `licensing.service.ts`, `licensing.controller.ts`, `licensing.dto.ts`, `infrastructure/licensing.repository.ts`; blockchain `license-query.service.ts`, `presentation/license.dto.ts`, `infrastructure/activation-delivery.repository.ts`; renewal/chain projection owner liên quan.

- [x] Gate retrieve/ACK theo mode, current revision và provider ACK. New mode đọc durable material; legacy tiếp tục đúng hợp đồng cũ.
- [x] Rotate/recover ghi secret mới bền vững trong transaction; gửi replacement trước khi giao key mới cho buyer. Không trả success “key mới dùng được” khi bên bán chưa nhận.
- [x] Renewal/suspend/resume/revoke/reorg xuất full snapshot có revision tăng; stale ACK không làm current revision DELIVERED.
- [x] New-mode activate/device/entitlement trả 410 với mã `LICENSE_USE_MANAGED_BY_PROVIDER`; không gọi repository tạo device. Public verify giữ chức năng tra cứu bằng chứng, trả trạng thái delivery không chứa secret.
- [x] Mở rộng `tests/emukey/backend/unit/licensing.service.test.ts`, `license-query.service.test.ts`, `blockchain-reconciliation.service.test.ts`; integration chứng minh renewal retry không gia hạn hai lần và rotate làm key cũ bị bên nhận từ chối.

**Gate:** đủ bốn lifecycle cùng rotate/recover; không chỉ làm happy path phát hành lần đầu.

### Task 6 — Web, mobile quản lý, thông báo và OpenAPI

**Sửa:** `EmuKey/frontend/src/presentation/screens/ProviderOperationsScreen.tsx`, `ProviderLicensesScreen.tsx`, `PaymentStatusScreen.tsx`, `BuyerOrdersScreen.tsx`, `BuyerLicenseHubScreen.tsx`, `SystemConsoleScreen.tsx`, `SupportConsoleScreen.tsx`; components provider license/recovery liên quan; `EmuKey/frontend/src/application/licenses/licenseQueries.ts`, `application/operations/operationsQueries.ts`; `EmuKey/mobile/src/presentation/EmuKeyMobileApp.tsx`; notification owner hiện có.

- [x] Thêm tab tích hợp và delivery panel vào màn hình hiện có; chỉ tách component mới khi có trách nhiệm rõ, không tạo API client/query-key system thứ hai.
- [x] UI theo mục 6; refresh/polling dùng pattern sẵn có, invalidate cache sau mutations. Phân biệt quyền buyer/provider/system/support.
- [x] Xóa CTA device/entitlement cho mode mới trên web lẫn mobile; không mô tả số máy thực tế bằng số 0 giả.
- [x] Sinh OpenAPI bằng script hiện có, cập nhật generated clients frontend/mobile; không sửa tay generated types.
- [x] Mở rộng `tests/emukey/frontend/buyer-commerce.test.tsx`, `completed-flows.test.tsx`, `provider-licenses.test.tsx`, `internal-consoles.test.tsx`; thêm focused test tab cấu hình nếu owner hiện tại không có case tương đương.
- [x] Mở rộng `tests/emukey/mobile/unit/license-screens.test.tsx` và `phase3-phase4-screens.test.tsx`: trạng thái giao lỗi/đã nhận và không có nút activation cho mode mới.

**Gate:** người mua luôn biết đang chờ ai; không thanh toán lại; Back/refresh không làm mất trạng thái bàn giao.

### Task 7 — Máy chủ bên bán mẫu và kiểm thử tích hợp

**Tạo:** `tooling/emukey/fixtures/provider-license-server.mjs`, `tooling/emukey/fixtures/provider-license-server.md`, `tests/emukey/backend/contract/licensing/provider-handoff.contract.test.ts`.

- [x] Fixture có database PostgreSQL container tạm riêng, nhận webhook/probe, lưu key hash+revision+receipt trước ACK, kiểm tra key theo product/expiry/status. Không import repository nội bộ EmuKey để xác minh key.
- [x] Có fault injection test lưu xong ngắt kết nối và receipt sai, test stale revision, URL/redirect/HTML và lease hết hạn. Điều khiển fault chỉ có trong tiến trình test; không mở API điều khiển qua mạng.
- [x] Tạo `tests/emukey/e2e/web/provider-key-handoff.spec.ts`: provider setup và buyer pending → ready → nhận key ở desktop/mobile viewport bằng API stub. Integration riêng kiểm tra payment → retry → provider verify. Ghi rõ mô phỏng và phạm vi mỗi bộ, không đánh đồng với SePay sandbox thật.
- [x] Điều chỉnh `EmuKey/license-client-demo/` và `tests/emukey/license-client-demo/` nếu chạy demo thủ công: trỏ API bên bán mẫu; README demo riêng. Không thêm demo vào sơ đồ/report/capabilities chính thức.

**Gate:** key tự bịa bị bên bán từ chối; đúng key sai product bị từ chối; key thật đã bàn giao được chấp nhận. Không dùng kết quả fixture làm bằng chứng đã tích hợp nhà cung cấp thật.

### Task 8 — Tài liệu, draw.io và bằng chứng đồ án

**Sửa:** `context/current/APP_IMPLEMENTATION_PLAN.md`, `context/current/chuc_nang_toan_he_thong_ver2.0.md`, `context/current/cong_nghe_he_thong.md`, `context/current/HDSD.md`, `EmuKey/README.md`, `docs/emukey/traceability/capabilities-v4.1.json`, `canonical-e2e-golden-flow.json`, `phase-8-traceability.md`, `KLTN.drawio`.

- [x] Phân biệt tài liệu hiện hành với archive; lịch sử review cũ không bị viết lại thành đã dùng kiến trúc mới.
- [x] Đổi mô tả phạm vi và capability: phát hành/bàn giao/đồng bộ; không còn capability chính thức dùng Kotlin để activate/entitlement/CSV. Golden flow chính thức kết thúc ở provider ACK và buyer nhận key, không bắt buộc Kotlin.
- [x] Đưa hướng dẫn kỹ thuật demo khỏi HDSD/thuyết minh đồ án sang README demo riêng; không xóa mobile quản lý khỏi đồ án.
- [x] UseCaseTQ: thêm cấu hình tích hợp, theo dõi/gửi lại bàn giao; bỏ actor Kotlin và use case tiêu thụ key do EmuKey thực thi.
- [x] SoDoLuongManHinh: xóa toàn bộ dải màn hình Kotlin; thêm tích hợp provider/trạng thái bàn giao; giữ đường về `/buyer/orders`.
- [x] Database: phản ánh schema triển khai thực tế gồm các bảng mới; bảng device legacy còn tồn tại phải được ghi rõ legacy, không xóa khỏi sơ đồ vật lý để che schema thật.
- [x] Class Diagram: thêm Integration/Delivery/KeyMaterial và trạng thái; bỏ lớp chỉ đại diện demo. Phân biệt mô hình nghiệp vụ đích với bảng legacy trong ERD.
- [x] MoHinhKienTruc và Mô hình kiến trúc: chỉ Web, mobile quản lý, API, worker, DB/cache, dịch vụ ngoài và “Hệ thống nhà cung cấp”; xóa Kotlin/demo ở mọi node/tooltip/metadata. Giữ phong cách màu/font/đường nối hiện có.
- [x] Render kiểm tra cả 6 trang bằng draw.io; kiểm tra XML references và schema coverage. Không chỉ tìm chuỗi Kotlin rồi đổi tên app đó thành một thành phần chính thức khác.

**Gate:** đọc phần thuyết minh và sơ đồ không thể suy ra Kotlin là một ứng dụng thuộc sản phẩm EmuKey; ranh giới nhà cung cấp nhất quán với code.

### Task 9 — Cutover và nghiệm thu

- [x] Backup/restore PostgreSQL 18, diễn tập nâng clone từ dữ liệu Neon và nâng database development từ `9ed5729` lên `provider_handoff_20261104`. Khóa bảng, đối chiếu hash toàn bộ nguồn với backup và kiểm tra schema/hash dữ liệu nghiệp vụ trước COMMIT; không reset DB.
- [x] Provider test bật tích hợp; đơn mới mode mới, đơn cũ giữ mode cũ. Kiểm thử cô lập đã kill API/worker ở thời điểm receiver commit nhưng chưa ACK, xóa queue và restart Redis, khởi động lại API/worker rồi nhận đúng key qua HTTP. Payment/chain trong ca restart là fixture; không coi đây là bằng chứng SePay/Sepolia thật.
- [x] SePay sandbox và Sepolia thật đã chạy theo ủy quyền; receiver do mình kiểm soát có PostgreSQL riêng. Không coi receiver này là nhà cung cấp thật. Buyer retrieve/ACK qua HTTP đạt; key giả/sai product bị từ chối.
- [x] Các gate triển khai/cutover và nghiệm thu trong phạm vi development đã đạt. Bằng chứng live, fixture và giới hạn được tách rõ; không tuyên bố đã triển khai production hoặc kiểm thử native mobile/nhà cung cấp thật.

## 9. Ma trận nghiệm thu bắt buộc

| Tình huống | Kết quả bắt buộc |
|---|---|
| Thanh toán hợp lệ, chain-confirmed, bên bán nhận | Một key, một license, ACK đúng, buyer nhận được key |
| IPN lặp hoặc hai worker cùng gửi | Không tạo thêm key/license; receipt idempotent |
| Chưa provider ACK | Buyer thấy đang bàn giao, retrieve key bị chặn |
| Bên bán lưu xong nhưng timeout | Retry cùng key/delivery, không ghi trùng hoặc cộng hạn |
| Redis mất dữ liệu, restart API/worker | Outbox và ciphertext PG phục hồi công việc |
| Credential sai, provider tắt, HTTP 200 HTML | Không báo thành công; có lỗi an toàn và đường xử lý |
| Provider A truy cập delivery B | Từ chối, không gửi HTTP hoặc lộ metadata/key |
| URL private/redirect/DNS rebinding | Chặn, không rò token |
| Key bịa/sai sản phẩm/hết hạn/bị thu hồi | Máy chủ bên bán từ chối |
| Renewal và rotate nhận lặp/đảo thứ tự | Trạng thái cuối đúng, key cũ không sống lại |
| Suspend/revoke trong lúc endpoint mất kết nối | EmuKey hiển thị pending sync, không hứa đã khóa bên bán |
| Reorg sau bàn giao | Chặn giao key mới, enqueue usable=false, theo dõi ACK và phục hồi bằng revision mới |
| New-mode gọi activation/entitlement cũ | Bị từ chối backend, không tạo device/token |
| Legacy đã nhận key một lần | Không giả vờ khôi phục plaintext từ hash hoặc tự rotate |
| Sơ đồ/thuyết minh chính thức | Không có Kotlin/demo/CSV flow; vẫn có hệ thống nhà cung cấp bên ngoài |

Các lệnh xác nhận theo runner hiện có, chạy focused test trước rồi mới chạy các suite bị ảnh hưởng:

```powershell
node tooling/emukey/run.mjs baseline
node tooling/emukey/run.mjs backend:unit
node tooling/emukey/run.mjs backend:integration
node tooling/emukey/run.mjs backend:security
node tooling/emukey/run.mjs backend:contract
node tooling/emukey/run.mjs frontend:unit
node tooling/emukey/run.mjs mobile:unit
node tooling/emukey/run.mjs frontend:e2e provider-key-handoff.spec.ts
corepack pnpm --dir EmuKey/backend typecheck
corepack pnpm --dir EmuKey/backend lint
corepack pnpm --dir EmuKey/backend build
corepack pnpm --dir EmuKey/backend openapi:check
corepack pnpm --dir EmuKey/frontend typecheck
corepack pnpm --dir EmuKey/frontend lint
corepack pnpm --dir EmuKey/frontend build
git diff --check
```

Nếu sửa contract/projection logic liên quan, thêm `node tooling/emukey/run.mjs contracts`. Tài liệu test phải ghi rõ dependency/service nào dùng thật, cái nào mock; schema source và generated OpenAPI phải khớp.

## 10. Mốc thực hiện và mức độ ảnh hưởng

1. **Mốc A — phát hành và giao key lần đầu:** Task 1–4 + phần receive-key Task 5 + UI tối thiểu Task 6 + fixture Task 7. Đủ chứng minh IPN → key → provider ACK → buyer nhận key, chưa được gọi là hoàn thành toàn bộ chuyển đổi.
2. **Mốc B — vòng đời đầy đủ:** hoàn thành Task 5–7, renewal/rotate/revoke/reorg và permission/failure cases.
3. **Mốc C — đồ án nhất quán:** Task 8–9, migration/rollout và tài liệu/sơ đồ, demo tách riêng.

Đánh giá từ source: thay đổi **vừa đến lớn ở Licensing và luồng bàn giao**, nhỏ hơn ở thanh toán/danh mục. Phức tạp chính là bảo toàn key khi retry, xác nhận hai hệ thống và thay ranh giới chức năng cũ; không nằm ở thao tác sinh key ngẫu nhiên. Không làm lại đăng nhập, AI, hỗ trợ hoặc UI toàn hệ thống.

## 11. Nguồn kỹ thuật tham chiếu

- [Node.js 22 crypto](https://nodejs.org/docs/latest-v22.x/api/crypto.html): primitive sinh ngẫu nhiên/mã hóa đã có trong runtime; triển khai phải đối chiếu version thực cài.
- [BullMQ idempotent jobs](https://docs.bullmq.io/patterns/idempotent-jobs): retry không được thay kết quả nghiệp vụ; PostgreSQL/outbox vẫn là trạng thái bền vững của thiết kế này.
- [OWASP SSRF Prevention](https://cheatsheetseries.owasp.org/cheatsheets/Server_Side_Request_Forgery_Prevention_Cheat_Sheet.html): bảo vệ outbound URL do provider cấu hình.
- Quyết định contract/receipt/mode/revision trong tài liệu là thiết kế đề xuất cho EmuKey, không phải API có sẵn của một dịch vụ nhà cung cấp cụ thể.

## 12. Kết quả triển khai và giới hạn nghiệm thu

### Điều chỉnh kỹ thuật khi hiện thực

- `ProviderHandoffService` là published application boundary cho Commerce/Blockchain và điều phối bàn giao; không tạo thêm `provider-delivery.service.ts` trùng trách nhiệm. Gateway port nằm trong application, HTTP adapter dùng Node 22 có sẵn và ghim DNS sau khi kiểm tra toàn bộ địa chỉ.
- `ProviderDeliveryRepository` sở hữu key material và outbox trong cùng transaction; không tạo repository key thứ hai khi chưa cần. `LicenseSecretCodec` dùng cho key và token mới với AAD theo chủ sở hữu. Giữ codec Redis legacy để không thay định dạng dữ liệu cũ trong cùng đợt cutover.
- BullMQ dùng scheduler poll PostgreSQL mỗi 2 giây, batch tối đa 20, thay cho enqueue từng delivery ID. Đây là pattern poller đã có trong Operations; queue không chứa bí mật. Lease/fencing, due time, retry và trạng thái công việc nằm trong PostgreSQL; reconnect Redis đăng ký lại scheduler. Không có phụ thuộc từ product về fixture workspace.
- Test contract/permission/transaction/lifecycle được tập trung vào `provider-delivery.integration.test.ts`; policy, durable-key recovery, scheduler và HTTP security có focused tests riêng. Browser kiểm tra giao diện bằng API stub; integration kiểm tra luồng thanh toán giả + chain event fixture + hai database PostgreSQL thật. Không gọi browser stub là nghiệm thu SePay.
- Fixture dùng database riêng trong PostgreSQL container tạm; không dùng chung bảng hay repository của EmuKey. Kotlin demo đã chuyển sang `/verify` phía receiver và chỉ có README riêng, không có trong 6 trang sơ đồ.

### Trạng thái gói công việc

| Task | Trạng thái | Bằng chứng chính |
|---|---|---|
| 1–3 | Đã hiện thực | Policy/port, schema 24 bảng, codec, versioned probe/config, HTTP roles/SSRF, masked credential |
| 4–5 | Đã hiện thực | Durable key/outbox; duplicate IPN, mất ACK, lease hết hạn, hai worker, rotation, renewal, suspend/resume/revoke và reorg/khôi phục |
| 6–7 | Đã hiện thực và kiểm tra cục bộ | Web/mobile trạng thái bàn giao, chặn device/entitlement mới, OpenAPI/client; receiver độc lập và demo ngoài đồ án |
| 8 | Đã cập nhật | Context/capability, golden-flow tách bằng chứng lịch sử, draw.io 6 trang; 24 bảng/412 cột/61 FK đối chiếu schema PostgreSQL |
| 9 | Đã nghiệm thu development/sandbox | Backup/restore, cutover giữ dữ liệu, restart drill, IPN SePay thật, Sepolia thật, receipt receiver độc lập, buyer retrieve/ACK và trang đơn hàng đã mua |

### Phạm vi kiểm tra

- Integration chứng minh upgrade `continuity_20261101` → `provider_handoff_20261104` hội tụ cùng fresh schema, giữ user cũ và chạy lại upgrade không ghi lặp. Bổ sung đường `9ed5729` PostgreSQL 18 → target trong một transaction, có rollback injection, chặn dữ liệu legacy chưa có ánh xạ và kiểm tra bản restore. Neon development đã nâng cấp sau diễn tập clone; không reset database.
- Giao key và nhận key của khách là hai receipt riêng. Khách chưa có provider ACK hiện hành không lấy được key; xác nhận chain của lệnh rotate chưa đủ để bật nút nhận key mới. New-mode xem thiết bị cũng trả 410.
- Khi cấu hình thay đổi, delivery đang gửi bị fencing; phải probe/bật config mới rồi retry có lý do và actor. Probe phiên bản cũ không bật được cấu hình mới. Tắt tích hợp chặn đơn mới nhưng IPN của phiên checkout có trước vẫn ghi nhận.
- Khi có snapshot mới, cả delivery đang `SENDING` của revision cũ cũng chuyển `SUPERSEDED` và mất lease. ACK cũ không cập nhật được DB, lỗi cũ không tái lên lịch; phía nhận vẫn phải kiểm tra revision vì HTTP đang bay không thể thu hồi.
- HTTP test kiểm tra địa chỉ private/IPv6, DNS mixed public/private, pin lookup, không redirect, HTTP 200 HTML; log chỉ ghi mã lỗi và ID tương quan. Không log token, key hay response body.
- Script `secrets:rotate:dev` đã được sửa để giữ `ACTIVATION_ENVELOPE_KEY`, chỉ đổi JWT/session secret. Regression chạy script trên bản `.env` giả trong OS temp; không đọc hoặc thay `.env` thật. Thay trực tiếp khóa này sẽ làm mất khả năng đọc ciphertext PostgreSQL cũ, vì vậy rotation lưu trữ phải là một migration riêng.
- Draw.io đã render từng trang bằng ứng dụng chính thức, kiểm tra references/ID, schema coverage và export XML vòng lại. Output render/log/test nằm trong OS temp.
- Workspace hygiene có một cảnh báo tên file: `license-secret-codec.ts` bị rule `secret` nhận diện. Đây là mã nguồn codec đã kiểm tra, không chứa credential/key thật; giữ đúng owner thay vì đổi tên để né kiểm tra. Không thêm dependency hoặc lockfile mới.

Kết quả chạy và giới hạn live acceptance được ghi trong `docs/emukey/traceability/canonical-e2e-golden-flow.json`. Task 9 dùng bằng chứng mới của mode PROVIDER_HANDOFF, không suy ra từ lần sandbox legacy.

### Các lần kiểm tra đã chạy

| Nhóm | Kết quả |
|---|---|
| Backend unit/security/contract | 361 test qua / 44 file sau sửa lỗi live |
| Backend integration tổng | 115 qua, 4 bỏ qua có điều kiện / 11 file; provider handoff sau bổ sung reorg, stale revision, exhausted lease và disabled checkout: 4/4 qua |
| Web unit/UI | 250/250 qua / 21 file |
| Mobile quản lý | 34/34 qua / 5 suite |
| Browser | 3/3 qua; API stub, viewport 390 và 1440; không phải SePay sandbox thật |
| Schema và sơ đồ | Baseline 34 capability/24 bảng; ERD bổ sung trường legacy giữ dữ liệu, đủ 412 cột/61 FK |
| Chất lượng source/API | Lint/typecheck/build backend và frontend, mobile lint/typecheck, OpenAPI 3 app và `git diff --check` đã chạy |

Frontend build còn cảnh báo chunk lớn hơn 500 kB; đây không phải lỗi build. Các thông báo jsdom thiếu pseudo-element/requestSubmit không làm hỏng bộ 250 test. Android emulator/native mobile và receiver nhà cung cấp thật chưa được nghiệm thu; SePay/Sepolia của luồng mới đã có bằng chứng live bên dưới.

### Bổ sung trong lượt nghiệm thu Task 9

- Database `.env` thực tế khớp schema Git `9ed5729` trên PostgreSQL 18, không phải baseline `cf17043`. Đường mới trong SQL authority ghép delta legacy, continuity và handoff thành một transaction; metadata chỉ ghi target cuối. Fingerprint nguồn phải khớp một trong hai dạng đã tái tạo độc lập: schema nguyên bản hoặc chính bản đó qua `pg_dump/pg_restore` PostgreSQL 18.
- Không thay thuật toán fingerprint thô hoặc tự ghi fingerprint để bỏ qua drift. `canonicalCatalogSql` chỉ so sánh hai cách PostgreSQL biểu diễn ép kiểu mảng chứa literal varchar sang text; giá trị, toán tử và kiểu khác vẫn được kiểm tra. Baseline verifier dùng cùng phép so sánh này; nguồn không nằm trong allowlist vẫn bị từ chối.
- Giữ `knowledge_chunks.token_count` nullable cùng constraint không âm để không mất 30 giá trị lịch sử. Danh mục schema vì vậy có 412 cột. Thông báo cũ giữ delivery evidence dưới `data._emukey_legacy_delivery`; EMAIL chuyển sang bảng delivery với trạng thái/lần thử/receipt cũ, không phát lại email đã SENT. Read flag cũ không có timestamp dùng `updated_at` làm mốc phục hồi; giá trị gốc vẫn nằm trong evidence.
- Các trường legacy chưa có ánh xạ an toàn (tên lời mời chưa rỗng, receipt đọc message, lease đang chạy, PUSH cũ, event đa kênh trùng hoặc billing không khớp duration) làm transaction dừng với `LEGACY_DATA_REQUIRES_EXPLICIT_ARCHIVAL`; không tự drop dữ liệu đó. Provider ownership/billing đã dư thừa chỉ bỏ sau khi FK/constraint và preflight chứng minh có thể suy ra từ dữ liệu còn lại.
- Backup được tạo ngoài repository, restore vào PostgreSQL 18 tạm, nâng clone và so sánh dữ liệu/schema trước khi cutover Neon. Cutover development hoàn tất lúc `2026-11-04T14:18:09Z`: 24 bảng, baseline khớp; 34 user, 30 order/license/payment/command/event giữ nguyên, 30 token estimate và 30 notification evidence được bảo toàn. Mọi key mã hóa cấu hình giữ nguyên.
- Restart drill dùng tiến trình API và BullMQ worker riêng, kill sau receiver commit trước ACK, flush/save/restart Redis rồi chạy lại hai tiến trình. Outbox/key PostgreSQL phục hồi đúng một key và một hiệu ứng ở receiver; buyer retrieve/ACK qua HTTP. Docker Desktop có thể đổi host port tạm khi restart; tiến trình mới dùng URL hiện tại của container, không nhầm với lỗi reconnect của ứng dụng.
- Đơn chuẩn bị ban đầu `EMU-2CE5DEBF0B9D4098AFC9` hết hạn và bị hủy, không có IPN. Đơn nghiệm thu mới `EMU-CB8D4F05600F4ADBA2AC` (149.000 VND sandbox) nhận IPN MATCHED, license ACTIVE/TRUSTED và chain CONFIRMED. Receiver lưu một whitelist row và một receipt, DELIVERED lần đầu; buyer retrieve/ACK trả 201, nhận lần hai trả 409 KEY_ALREADY_DELIVERED, devices trả 410. Key giả và sai product bị từ chối. Không có key/token thật trong báo cáo.

### Sửa lỗi phát hiện khi chạy live và phép đo ngày 05/11/2026

- `ChainCommandService` kiểm tra key ciphertext qua published boundary Licensing cho mode mới, đối chiếu commitment/version với license trước khi gửi. Không bắt buộc Redis envelope cho key đã lưu PostgreSQL; legacy giữ kiểm tra envelope. Test ISSUE/ROTATE và commitment lệch được chạy đỏ rồi xanh. Đơn nghiệm thu được requeue bằng API quản trị chỉ sau khi kiểm tra chưa có nonce/raw transaction/hash; giữ nguyên key và command.
- `ChainEventRepository` so sánh expiry theo độ chính xác giây của EVM; giữ nguyên phần microsecond PostgreSQL khi cùng giây. Điều này tránh rebuild sai và vi phạm trigger bảo vệ quyền. Integration tái hiện ACTIVE/PENDING_ONCHAIN và chạy lại toàn bộ invariants: 21 đạt, 2 bỏ qua có điều kiện.
- `RpcChainIndexerService` ưu tiên đọc canonical logs tại block receipt SUCCESS của command SUBMITTED/SUBMITTED_UNKNOWN đúng registry, tối đa 100 block mỗi lượt; dùng cùng đường kiểm tra command context, confirmation và reorg. Cursor lịch sử không nhảy cóc và vẫn được quét. Test xác nhận cả range lịch sử và block receipt; integration kiểm tra lọc registry và loại command đã CONFIRMED.
- Integration handoff/restart sau thay đổi: 4 đạt, 2 fixture subprocess bỏ qua ở tiến trình cha (được gọi riêng trong restart drill). Unit/security/contract: 361 đạt; contract blockchain: 7 đạt. Backend lint/typecheck/build và baseline validator đạt.
- Native Chrome đã quay về từ SePay, tải lại vẫn thấy provider đã nhận/key đã nhận; liên kết “Xem đơn hàng đã mua” đưa tới `/buyer/orders`, hiện đơn nghiệm thu với nhãn “Đã bàn giao”. Buyer retrieve/ACK được kiểm tra qua HTTP thật; không tuyên bố thao tác nhận plaintext đã được bấm trong browser.
- Phép đo riêng sau sửa lỗi, đơn `EMU-86241845CD3D41C6B829`, tự xử lý một lần, không requeue: tạo license **10:07:04.961**, gửi giao dịch **10:07:12.420**, vào block **10:07:24**, CONFIRMED **10:07:37.743**, provider ACK **10:07:38.904** (UTC+7, 05/11/2026). Tổng lần lượt **19,039 / 32,782 / 33,943 giây** tính từ tạo license. Chỉ phần gửi → vào block là **11,580 giây**. Timestamp block có độ chính xác giây; các số là một mẫu đo, không phải trung bình hay SLA.
- Giao dịch phép đo: `0x11e8990ef85c03c162839e28550068e573cfe253e8357499e24fcf93f0f48b76`. Blockchain lưu commitment/bằng chứng, không lưu plaintext key. Lần nghiệm thu trước có thời gian dừng sửa lỗi nên không dùng làm mẫu hiệu năng bình thường.

### Hoàn thiện tính nhất quán giao diện (mục 1, 05/11/2026)

- Dùng `providerHandoffStatus` trong application owner `licenseQueries.ts` để trình bày thống nhất thanh toán, danh sách đơn, danh sách/chi tiết bản quyền và phần thông tin provider. Ưu tiên kiểm tra trạng thái không còn hiệu lực và độ tin cậy blockchain trước thông tin bàn giao. Phân biệt chờ chain, xác minh lại, chờ bàn giao, bàn giao lỗi, provider đã nhận và buyer đã nhận mã.
- Thanh toán hiển thị riêng ba bước blockchain/bàn giao/nhận mã; gia hạn chờ command và expiry của chính đơn, giữ mã hiện tại. Màn hình chưa tải được license dùng “đang chuẩn bị/phát hành”, không gọi đó là kích hoạt thiết bị. Notice, màu trạng thái và nút nhận mã bám cùng thông tin; không hiện nhận key khi snapshot bàn giao/trust chưa sẵn sàng, kể cả cờ available cũ còn true.
- ACK lưu mã invalidates nhóm query `licenses` theo [TanStack Query v5](https://tanstack.com/query/v5/docs/framework/react/guides/invalidations-from-mutations); không thay receipt/API hoặc lưu plaintext trong storage mới. Điều hướng, trang chủ, đăng nhập và trợ giúp dùng “Bản quyền”; phần thiết bị legacy giữ riêng. Mobile quản lý có cùng nhãn giai đoạn ở thanh toán/danh sách và không mở nhận mã khi chain chưa tin cậy.
- Browser kiểm tra trình tự từ chờ chain đến ACK, refresh và trở về đơn hàng ở 320/768/1024/1440 px; phần license detail kiểm tra thêm 390 px. Đây là UI contract tests với API stub; bằng chứng live SePay/Sepolia bên trên vẫn là lần nghiệm thu trước, không được gán lại thành đã chạy thật trong lượt sửa giao diện.
- Không thêm dependency, endpoint, migration, schema hoặc file source mới. Chỉnh các owner hiện có; ảnh, trace và cấu hình kiểm thử tạm nằm ngoài repository. Kết quả kiểm tra cuối ghi ở `canonical-e2e-golden-flow.json` trong mục `uiConsistency`.
- Kiểm tra: 72 ca web ở ba suite liên quan (15 provider, 34 buyer commerce, 23 app), 42 ca mobile ở 5 suite, 22 ca browser gồm payment legacy và provider handoff; chạy lại riêng 7 ca handoff sau chỉnh UI cuối. Web/mobile lint và typecheck, web production build đạt. Lần web tổng trước đó có 3 lỗi và đã kiểm tra lại các suite bị ảnh hưởng sau sửa; không ghi nhận lần chạy tổng đó là đạt. Bundle web còn cảnh báo kích thước chunk đã có từ trước.

### File mới trong đợt triển khai ban đầu

Đối chiếu snapshot workspace đầu lượt triển khai: 27 file mới thuộc công việc này; những file untracked có trước được giữ nguyên.

| Thư mục sở hữu | File mới và trách nhiệm |
|---|---|
| `EmuKey/backend/src/modules/licensing/domain/` | `provider-delivery-policy.ts`: contract/predicate/retry |
| `.../licensing/application/` | `provider-handoff.service.ts`, `provider-integration.service.ts`, `ports/provider-license-gateway.port.ts`: điều phối và published boundary |
| `.../licensing/infrastructure/` | `http-provider-license.gateway.ts`, `license-secret-codec.ts`, `provider-delivery.repository.ts`, `provider-integration.repository.ts`: HTTP, mã hóa và pg |
| `.../licensing/presentation/` | `provider-integration.controller.ts`, `provider-integration.dto.ts`: HTTP/session/validation |
| `.../licensing/` và `worker/` | `provider-handoff.module.ts`, `licensing-worker.module.ts`, `worker/provider-delivery.processor.ts`, `worker/provider-delivery.scheduler.ts`: DI và background consumption |
| `EmuKey/frontend/src/presentation/components/` | `ProviderIntegrationPanel.tsx`, `ProviderDeliveryPanel.tsx`, `ProviderHandoffNotice.tsx`: mở rộng màn hình hiện có |
| `tests/emukey/backend/` | `integration/licensing/provider-delivery.integration.test.ts`, `security/provider-integration.security.test.ts`, `unit/provider-delivery-policy.test.ts`, `unit/provider-handoff.service.test.ts`, `unit/provider-key-recovery.test.ts` |
| `tests/emukey/` | `frontend/provider-integration.test.tsx`, `e2e/web/provider-key-handoff.spec.ts` |
| `tooling/emukey/fixtures/` | `provider-license-server.mjs`, `provider-license-server.md`: receiver độc lập và hướng dẫn kiểm thử |
| `EmuKey/license-client-demo/` | `README.md`: hướng dẫn công cụ phát triển ngoài đồ án |
