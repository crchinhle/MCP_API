# Chức năng hệ thống EmuKey — baseline v5.1-r5

> Cập nhật phạm vi 04/11/2026: EmuKey là nền tảng trung gian bán, phát hành và bàn giao bản quyền theo ủy quyền. Mô hình bàn giao thay thế quy trình EmuKey trực tiếp kích hoạt thiết bị/cấp entitlement đối với đơn mới. Bằng chứng chạy thật của phiên bản cũ không được dùng để chứng minh bản phát hành này đã triển khai.

## 1. Mục tiêu và ranh giới

Nhà cung cấp đăng sản phẩm/gói, ủy quyền EmuKey phát hành key và tích hợp URL nhận dữ liệu trên máy chủ của họ. Khách mua và thanh toán tại EmuKey. EmuKey sinh key ngẫu nhiên, lưu thông tin bản quyền và tự động gửi sang nhà cung cấp. Nhà cung cấp ghi nhận key vào danh sách hợp lệ rồi xác nhận đã lưu; không duyệt từng đơn/key thủ công.

EmuKey quản lý thương mại, bằng chứng phát hành và kết quả bàn giao. Máy chủ nhà cung cấp quản lý whitelist; sản phẩm của họ kiểm tra key và thực thi tính năng/thời hạn/giới hạn thiết bị. Sản phẩm không chấp nhận một chuỗi chỉ vì giống định dạng key.

Các ứng dụng thuộc phạm vi đồ án: Web React/Vite và mobile quản lý React Native/Expo. Hệ thống nhà cung cấp là tác nhân/hệ thống bên ngoài, được mô tả bằng hợp đồng tích hợp chung.

## 2. Vai trò và module

| Vai trò | Trách nhiệm |
|---|---|
| CUSTOMER | Mua, thanh toán, nhận và quản lý thông tin bản quyền, gia hạn, yêu cầu hỗ trợ |
| PROVIDER_ADMIN | Sản phẩm/gói, tích hợp nhận key, theo dõi bàn giao, lifecycle bản quyền thuộc mình |
| SUPPORT_STAFF | Nhận/trả/đóng hội thoại hỗ trợ, xem metadata bàn giao cần thiết; không sửa cấu hình hoặc tự đánh dấu đã giao |
| SYSTEM_ADMIN | Tài khoản nội bộ, lời mời provider, payment review, health, reconciliation và gửi lại có lý do |

Giữ bảy module: Identity & Access, Catalog & Plan, Commerce & Payment, Licensing, Blockchain, Assistance & Support, Operations. Tích hợp/bàn giao là trách nhiệm của Licensing. Module khác gọi application interface đã công bố, không truy cập repository của Licensing.

## 3. Luồng mua và bàn giao

1. Provider cấu hình endpoint HTTPS, token máy chủ và xác nhận ủy quyền. Kiểm tra kết nối đúng phiên bản cấu hình rồi bật tiếp nhận.
2. Customer chọn một sản phẩm/gói, tạo đơn, xem điều khoản snapshot và chấp nhận đúng version/hash.
3. Backend tính giá và tạo PaymentAttempt; SePay IPN được xác minh phía backend. Không coi URL trả về từ SePay là bằng chứng thanh toán.
4. IPN hợp lệ tạo PaymentTransaction, pending License, ChainCommand và secret được mã hóa trong cùng transaction. Sự kiện lặp không tạo lại key.
5. Event chain-confirmed cập nhật projection và ghi snapshot bàn giao vào PostgreSQL trong cùng transaction.
6. Worker gửi snapshot/key sang nhà cung cấp. Bên nhận lưu key hash, trạng thái, thời hạn và receipt atomically, rồi phản hồi đúng deliveryId/licenseId/revision.
7. EmuKey ghi ACK bền vững, thông báo nhà cung cấp đã nhận. Customer nhận key một lần và xác nhận đã lưu; mất response trước ACK được thử lại cùng request trong tối đa 5 phút.
8. Customer sử dụng key trong sản phẩm bên bán. Kiểm tra whitelist diễn ra tại hệ thống bên bán, ngoài EmuKey.

## 4. Trạng thái và bất biến

- Đã thanh toán, đã phát hành, nhà cung cấp đã nhận, người mua đã lưu mã là bốn sự kiện riêng.
- Order giữ `WAITING_SERVICE_TERMS_ACCEPTANCE`, `WAITING_PAYMENT`, `PAYMENT_ACCEPTED`, `CANCELLED`, `EXPIRED`.
- License giữ `PENDING_ONCHAIN`, `ACTIVE`, `SUSPENDED`, `EXPIRED`, `REVOKED`; key trust giữ pending/trusted/untrusted-reorg theo code hiện hành.
- Delivery có `PENDING`, `SENDING`, `RETRY_WAIT`, `DELIVERED`, `FAILED`, `SUPERSEDED`; revision hiện hành phải được DELIVERED trước khi giao key.
- ACTIVE/chain-confirmed chưa có provider ACK phải hiển thị đang bàn giao, không hiển thị sẵn sàng sử dụng.
- Key được tạo bằng bộ sinh ngẫu nhiên mật mã; không xây thuật toán sinh mã theo quy luật có thể dự đoán. Mã không chứa quyền lợi đáng tin do client tự giải mã.
- Secret và token kết nối mã hóa khi lưu, chỉ gửi qua kết nối đã xác thực; không ghi plaintext vào logs, queue, public verify hoặc blockchain.
- PostgreSQL là nguồn bền vững cho key/outbox/receipt; mất Redis không được thay key hoặc làm mất việc gửi.
- Receipt nhà cung cấp và receipt người mua là hai loại khác nhau; người mua ACK không xóa dữ liệu cần để đồng bộ cho bên bán.
- Chỉ backend thực thi giá, ownership, payment, lifecycle, phân quyền và các gate nhận key.
- Không coi số thiết bị đang dùng là dữ liệu EmuKey biết đối với luồng mới. Quyền lợi tối đa thiết bị được gửi sang nhà cung cấp để họ thực thi.

## 5. Đồng bộ vòng đời

Gia hạn giữ nguyên key, gửi thời hạn tuyệt đối sau canonical confirmation; nhận lặp không cộng thêm thời gian. Đổi/khôi phục key tạo version mới, lưu secret bền vững và chờ bên bán thay key trước khi giao mã mới cho Customer. Suspend/revoke gửi usable=false; resume gửi snapshot hiện hành. Snapshot có revision tăng dần; bản cũ đến muộn không được khôi phục quyền cũ.

Khi mất trust/reorg, EmuKey chặn nhận key và gửi cập nhật không usable. Nếu bên bán mất kết nối, giao diện thể hiện đang chờ đồng bộ; không tuyên bố bên bán đã khóa tức thì. Hết hạn được kiểm tra từ expiresAt ở máy chủ bên bán, không phụ thuộc một job đến đúng giờ.

Chưa có chữ ký license hoặc kiểm tra ngoại tuyến. Cơ chế này ngăn key tự bịa được máy chủ chấp nhận; không tuyên bố chống sửa phần mềm hoặc sao chép một key thật.

## 6. Phạm vi dữ liệu

Schema vật lý duy nhất: `EmuKey/backend/database/schema.sql`, hiện 24 bảng. Ba bảng mới: provider_integrations, license_key_materials, provider_license_deliveries. Bảng license_key_deliveries vẫn ghi receipt của Customer.

Đơn/license cũ giữ `LEGACY_DEVICE`; đơn mua mới sau cutover dùng `PROVIDER_HANDOFF`. Mode bất biến, renewal kế thừa license đích. Bảng/device protocol cũ còn để bảo toàn lịch sử và tương thích; không phải quy trình sử dụng bản quyền mới của đồ án. Không backfill key plaintext từ commitment/hash.

## 7. Danh mục capability

### MOD-01 — Identity & Access (4)

| ID | Chức năng | Actor | Ràng buộc chính |
|---|---|---|---|
| `AUTH-01` | Customer registration và email verification | Customer | Tạo `PENDING_EMAIL_VERIFICATION`; activation một lần; không sinh khóa riêng/controller |
| `AUTH-02` | Login/logout/session | User | Argon2id, refresh family, session version, lockout |
| `AUTH-03` | Profile và account lifecycle | User/System Admin | Field theo role; lock/disable revoke session |
| `AUTH-04` | RBAC và resource ownership | Backend | Customer/Provider scope luôn lấy từ authenticated principal |

### MOD-02 — Catalog & Plan (5)

| ID | Chức năng | Actor | Ràng buộc chính |
|---|---|---|---|
| `CAT-01` | Hồ sơ Provider và chain namespace | Provider Admin/System Admin | `PROVIDER_ADMIN` chính là Provider account; System Admin seed/approve, không self-register |
| `CAT-02` | Product lifecycle | Provider | Provider-scoped DRAFT/PUBLISHED/ARCHIVED |
| `CAT-03` | Plan lifecycle | Provider | Published immutable; thay đổi tạo version mới |
| `CAT-04` | Terms binding và plan commitment | Backend/Provider | Một Terms template chung; Plan bind version/hash; commitment deterministic |
| `CAT-05` | Catalog và so sánh Plan | Public/Customer | Chỉ Product/Plan published; compare dữ liệu cấu trúc, không AI mutation |

### MOD-03 — Commerce & Payment (6)

| ID | Chức năng | Actor | Ràng buộc chính |
|---|---|---|---|
| `COM-01` | Tạo Order và immutable snapshot | Customer | JWT + UUID idempotency key; backend bind owner và snapshot provider/product/plan/price/rights/Terms/commitment |
| `COM-02` | Customer accept Terms | Customer | Xác thực JWT/Order ownership + exact version/hash; không chữ ký PDF |
| `COM-03` | Checkout / PaymentAttempt | Customer | Xác thực JWT/Order ownership; chỉ Order `WAITING_PAYMENT`; attempt idempotent và có expiry |
| `COM-04` | SePay IPN / PaymentTransaction | System/Worker | Verify contract của adapter; event idempotent; payment không tự cấp quyền |
| `COM-05` | Payment review, history và receipt | Customer/Provider Admin/System Admin | Customer và Provider chỉ đọc dữ liệu đúng scope; chỉ System Admin được resolve review bất thường |
| `COM-06` | Renewal Order | Customer/Worker | JWT xác định owner; không cần mã đã mua để tạo đơn gia hạn; payment chỉ tạo pending renewal command |

### MOD-04 — Licensing (8)

| ID | Chức năng | Actor | Ràng buộc chính |
|---|---|---|---|
| `LIC-01` | Request/cấp License | Worker/Chain | Payment/license/command/key mã hóa commit cùng transaction; sau finality ghi snapshot bàn giao |
| `LIC-02` | Activation key lifecycle | Customer owner/Worker/Chain | Commitment on-chain; owner JWT + step-up policy cho rotate/recovery; Customer owner nhận key một lần sau finality và ACK revision hiện hành từ nhà cung cấp; key không định danh người mua |
| `LIC-03` | Xem License và trạng thái projection | Customer/Provider Admin | JWT + ownership; public verify thuộc `BC-05` |
| `LIC-04` | Cấu hình tích hợp nhà cung cấp | Provider Admin | Ủy quyền phát hành, token máy chủ được mã hóa, probe đúng config version trước khi bật |
| `LIC-05` | Bàn giao key | Worker/Provider Admin/System Admin | Outbox PostgreSQL, lease, retry cùng key/delivery, receipt đúng revision; Support chỉ đọc |
| `LIC-06` | Đồng bộ quyền sang nhà cung cấp | Worker/Provider | Snapshot đầy đủ có revision tăng dần; bên bán kiểm tra key và thực thi quyền trong sản phẩm |
| `LIC-07` | Áp dụng renewal | Customer/Worker/Chain | Chỉ `LICENSE_RENEWED` finality mới kéo dài expiry |
| `LIC-08` | Suspend/Resume/Revoke/Expire | Provider Admin/Worker/Chain | Provider Admin quyết định lifecycle theo policy; Worker relay/derive; phân biệt kết quả chain với xác nhận đồng bộ của bên bán; `EXPIRED` suy ra từ on-chain `expiresAt` |

### MOD-05 — Blockchain Core (5)

| ID | Chức năng | Actor | Ràng buộc chính |
|---|---|---|---|
| `BC-01` | License Registry | Chain | Bằng chứng phát hành, gia hạn, key version và lifecycle; không chứa secret và không thay máy chủ kiểm tra key của bên bán |
| `BC-02` | ChainCommand và Relayer | Backend/Worker | Stable idempotency, nonce, uncertain submit, retry/dead-letter |
| `BC-03` | ChainEvent, Indexer và finality/reorg | Worker | Event identity duy nhất; confirmation; reorg không usable |
| `BC-04` | Projection và reconcile | Worker/System Admin | Sở hữu toàn bộ reconcile logic; scheduled reconcile do Worker, manual reconcile chỉ System Admin và phải |
| `BC-05` | Public Blockchain Verification | Public/Worker | Owner duy nhất của public verify: chain state, tx/event/finality, plan commitment; cấm PII/Terms content |

### MOD-06 — Assistance & Support (4)

| ID | Chức năng | Actor | Ràng buộc chính |
|---|---|---|---|
| `AST-01` | Knowledge ingestion | Provider/Worker | FAQ/PDF/TXT gắn Product; version/current; private storage |
| `AST-02` | AI hỗ trợ sử dụng có nguồn | Customer/AI | Chỉ current READY + catalog published; AI không thay đổi trạng thái bản quyền/thanh toán |
| `AST-03` | Conversation và ordered Message | Customer/AI/Support | Customer ownership; một timeline; idempotent append; server sequence |
| `AST-04` | Handoff/Support queue | Customer/Support | Atomic claim/release/close; Support chỉ conversation đã claim |

### MOD-07 — Operations (2)

| ID | Chức năng | Actor | Ràng buộc chính |
|---|---|---|---|
| `OPS-01` | Notification và Android push | Worker | In-app/email/push, idempotent, retry/dead-letter; adapter lỗi không rollback business |
| `OPS-03` | Dashboard và health operations | Provider Admin/System Admin | Provider chỉ xem aggregate của chính mình; System Admin xem health và có thể trigger `BC-04`; UI không sở hữu reconcile engine; không predictive BI/data warehouse |

**Tổng: 4 + 5 + 6 + 8 + 5 + 4 + 2 = 34 capability.**


## 8. Tích hợp, lỗi và vận hành

- HTTPS + Bearer token giữa hai máy chủ; token không nhúng trong ứng dụng phát cho người mua. Nhà cung cấp chịu trách nhiệm lưu receipt trước ACK.
- Mỗi delivery có Idempotency-Key cố định. Chỉ HTTP 200/201 với JSON receipt đúng được coi là thành công; 202/HTML/receipt sai không đóng bàn giao.
- Tối đa 8 lần gửi tự động, backoff có jitter; timeout/429/5xx có thể gửi lại, lỗi credential/protocol cần xử lý. Thao tác gửi lại thủ công có role, ownership và lý do.
- Đổi cấu hình tắt tiếp nhận, vô hiệu probe cũ và đưa công việc chưa hoàn tất về trạng thái cần xử lý. Không tự chuyển key sang endpoint mới chưa được kiểm tra.
- URL callback được kiểm tra SSRF, chặn địa chỉ nội bộ/metadata, pin DNS ở kết nối, không theo redirect. Ngoại lệ loopback chỉ dành runtime kiểm thử được cấu hình rõ, cấm production.
- Chặn checkout mới nếu tích hợp chưa sẵn sàng. IPN đến sau khi endpoint hỏng vẫn phải được ghi nhận đúng; lỗi bàn giao không yêu cầu người mua trả tiền lần nữa.

## 9. Kiểm chứng và nguồn thẩm quyền

Kế hoạch và checklist triển khai: `docs/emukey/plans/2026-11-04-provider-key-handoff-plan.md`. Capability matrix: `docs/emukey/traceability/capabilities-v4.1.json`. Golden flow chính thức kết thúc tại provider ACK và buyer nhận key; kiểm tra sản phẩm bên bán là bằng chứng tích hợp qua boundary ngoài.

Phải phân biệt kiểm thử bằng payment adapter giả, receiver mô phỏng, blockchain event fixture và lần chạy SePay/Sepolia thật. Không suy ra việc đã tích hợp một nhà cung cấp thực từ kết quả fixture.

Các yêu cầu giữ nguyên: xác thực/session rotation và phân quyền theo owner; lời mời provider; catalog/gói versioned; điều khoản snapshot; payment review có bằng chứng; knowledge có version/current và trích nguồn AI; support claim lease/generation; notification idempotent và retry. Chi tiết đã có trong owner source/test hiện hành và các báo cáo triển khai lịch sử; không mở lại các flow contract PDF/KMS/NFT/crypto payment.
