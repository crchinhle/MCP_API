# CHỨC NĂNG TOÀN HỆ THỐNG — Account-linked Customer baseline v5.1-r4

> **Đề tài:** Xây dựng hệ thống quản lý và phân phối bản quyền phần mềm ứng dụng Blockchain  
> **Ngày cập nhật:** 17/09/2026  
> **Trạng thái:** **BUSINESS AUTHORITY v5.1-r4 — đã rà lại luồng Phase 1–6; không Customer Controller/KMS**  
> **Mục tiêu:** Đơn hàng và License thuộc tài khoản EmuKey; activation key không mang hoặc chứng minh danh tính người mua.

> Cập nhật kiến trúc 03/10/2026: Device chỉ có `ACTIVE`/`REVOKED`; PostgreSQL là source of truth. Activation/revoke/quota commit trong DB transaction. Blockchain nhận async `activeDeviceCount + deviceStateVersion`; entitlement không chờ aggregate finality. Public activation dùng bearer key và device proof, không cần purchaser session; private management vẫn kiểm tra owner.

---

## 1. Quy tắc sử dụng tài liệu

1. Đây là **business authority** của baseline v5.1.
2. Catalog có đúng **35 capability canonical**. UI Web/Android chỉ là surface sử dụng capability, không được đếm lại thành feature.
3. Smart contract là authority cuối cùng cho **License rights; individual Device state do PostgreSQL qu?n l?**; PostgreSQL là private store cho account/catalog/order/payment/audit và projection của chain.
4. Không có chain-confirmed evidence thì không được coi License/Device usable, không giao activation key và không cấp/refresh entitlement.
5. Không thêm role, capability, state, table hoặc external integration nếu không chỉ ra requirement và boundary độc lập.
6. Không tối ưu schema theo một con số bảng cố định. Table chỉ tồn tại khi có lifecycle/query/invariant độc lập.
7. Service Terms không phải subsystem. Toàn hệ thống dùng **một nội dung Service Terms platform**, quản lý như application artefact; mỗi Order chỉ ghi nhận acceptance DB-stamped.
8. Không có Contract PDF, chữ ký người mua, Customer Controller, KMS, two-signature verification hoặc contract anchor.
9. Không có Kotlin `test_client`. Chỉ có Web và Android là client surface.
10. AI là capability hỗ trợ read-only; AI không thay đổi payment/license/device và không gửi blockchain command trực tiếp.
11. Tài liệu này mô tả **luồng đúng phải có**. Trạng thái đã triển khai/đã kiểm thử và các gap còn mở chỉ được kết luận từ `APP_IMPLEMENTATION_PLAN.md`; không suy `canonical` thành `completed`.
12. JWT xác định tài khoản và ownership; activation key chỉ chứng minh người gọi biết bearer secret của License. Hai kiểm tra này độc lập và không được thay thế lẫn nhau.

## 2. Bài toán và phạm vi

### 2.1. Vấn đề trung tâm

Hệ thống giải quyết bài toán: **giao dịch thương mại diễn ra off-chain, nhưng quyền sử dụng phần mềm được xác lập và kiểm chứng on-chain**. Payment thành công chỉ chứng minh tiền đã được chấp nhận; smart contract mới quyết định License/Device state. Hệ thống phải giữ nhất quán khi có retry, RPC timeout, transaction uncertain, finality và reorg.

### 2.2. In scope

- Multi-provider: mỗi `PROVIDER_ADMIN` là một tài khoản đại diện trực tiếp cho một công ty/Provider.
- Product/Plan, một mẫu Terms chung, Order snapshot và SePay payment.
- Customer đăng ký, xác minh email và đăng nhập tài khoản EmuKey; Order/License gắn `customer_user_id`.
- License/device lifecycle on-chain; activation key và signed entitlement off-chain.
- Relayer, ChainCommand, Indexer, ChainEvent, finality, reorg và reconcile.
- Web + Android.
- Grounded AI đọc tài liệu/Plan và realtime Support tối thiểu.
- Notification, audit và dashboard vận hành tối thiểu.

### 2.3. Out of scope

- Provider self-registration/KYC; MVP seed/approve Provider account.
- Provider member/seat/team/organization hierarchy; MVP `1 Provider = 1 PROVIDER_ADMIN account`.
- Contract PDF, hai chữ ký, CA/non-repudiation, Customer Controller/KMS và contract blockchain anchor.
- Coupon/tier/proration/upgrade/downgrade/refund automation/auto-debit.
- Crypto payment, wallet tự quản, WalletConnect, NFT/ERC-721, token economics, mainnet.
- License transfer/resale, offline entitlement dài hạn, machine fingerprint dựa IMEI/MAC/serial.
- AI không có Order/conversation token, AI write tools, autonomous agent, raw SQL/DB credential cho LLM.
- Voice/video/file Support, predictive BI, data warehouse riêng.
- iOS và Kotlin License Test Client.

## 3. Actor canonical

| Actor | Trách nhiệm | Ranh giới |
|---|---|---|
| `SYSTEM_ADMIN` | Quản trị User nội bộ, audit, health, payment review hệ thống, relayer/indexer, dead-letter và manual reconcile | Không được đọc activation secret/relayer private key; không tự sửa License/Device thành ACTIVE |
| `PROVIDER_ADMIN` | Chính là tài khoản đại diện Provider; quản lý hồ sơ công ty, Product/Plan, knowledge, xem Order/Payment/License của mình và yêu cầu suspend/resume/revoke theo policy | Chỉ resource có `provider_user_id = authenticated user.id`; không bypass chain |
| `CUSTOMER` | Đăng ký/đăng nhập, mua Plan, accept Terms, thanh toán, xem License, renewal và AI/Support | Order/License thuộc authenticated `customer_user_id`; thao tác riêng tư phải kiểm tra ownership. Activation key là bearer capability bổ sung và không chứng minh ai đã mua |
| `SUPPORT_STAFF` | Queue, claim, message, release/close Conversation | Không payment/license/key/admin; chỉ Conversation đã claim |
| `SYSTEM/WORKER` | SePay handler, relayer, indexer, finality/reconcile, notification/AI workers | Chỉ qua application use case và owner record/idempotency |

## 4. Business domain canonical

| Module | Phạm vi |
|---|---|
| `MOD-01 Identity & Access` | Customer registration/email verification, account, session, RBAC và profile |
| `MOD-02 Catalog & Plan` | Provider account profile, Product, Plan, global Terms binding, plan commitment |
| `MOD-03 Commerce & Payment` | Order snapshot, Terms acceptance, checkout, SePay, payment review, renewal order |
| `MOD-04 Licensing` | License, activation key, device, entitlement, renewal/state lifecycle |
| `MOD-05 Blockchain Core` | Smart contract policy, ChainCommand/Relayer, ChainEvent/Indexer, finality/reorg/reconcile |
| `MOD-06 Assistance & Support` | Knowledge/RAG, Plan advisory, unified Conversation/Support |
| `MOD-07 Operations` | Notification/push, audit, dashboard/health/manual reconcile |

Web và Android là **surface**, không phải business module.

## 5. State machine canonical

| Aggregate | State canonical |
|---|---|
| User | `PENDING_EMAIL_VERIFICATION`, `ACTIVE`, `LOCKED`, `DISABLED` |
| Product | `DRAFT`, `PUBLISHED`, `ARCHIVED` |
| Plan | `DRAFT`, `PUBLISHED`, `ARCHIVED` |
| Order | `WAITING_SERVICE_TERMS_ACCEPTANCE`, `WAITING_PAYMENT`, `PAYMENT_ACCEPTED`, `CANCELLED`, `EXPIRED` |
| PaymentAttempt | `PENDING`, `SUCCEEDED`, `FAILED`, `EXPIRED`, `SUPERSEDED` |
| PaymentTransaction classification | `MATCHED`, `DUPLICATE`, `UNMATCHED`, `AMOUNT_MISMATCH`, `INVALID` |
| PaymentTransaction review (semantic hoặc fulfillment anomaly) | `OPEN`, `RESOLVED`, `CLOSED_NO_ACTION` |
| License projection status (materialized) | `PENDING_ONCHAIN`, `ACTIVE`, `SUSPENDED`, `EXPIRED`, `REVOKED` |
| License administrative state (on-chain, sau issuance) | `ACTIVE`, `SUSPENDED`, `REVOKED` |
| License temporal condition (derived) | `VALID`, `EXPIRED` |
| Customer-held activation key usability/trust | `PENDING_FINALITY`, `TRUSTED`, `UNTRUSTED_REORG` |
| LicenseDevice (PostgreSQL authority) | `ACTIVE`, `REVOKED` |
| ChainCommand | `PENDING`, `SUBMITTED`, `SUBMITTED_UNKNOWN`, `CONFIRMED`, `RETRYABLE_FAILED`, `DEAD_LETTER`, `ABANDONED`, `SUPERSEDED` |
| ChainEvent finality | `PENDING`, `CONFIRMED`, `REORGED` |
| KnowledgeDocument | `PENDING`, `PROCESSING`, `READY`, `FAILED`, `ARCHIVED` |
| Conversation | `AI_ACTIVE`, `WAITING_SUPPORT`, `SUPPORT_ACTIVE`, `CLOSED` |
| Notification | `PENDING`, `SENT`, `RETRYABLE_FAILED`, `DEAD_LETTER` |

**Không dùng technical failure state trong License/LicenseDevice.** Retry/dead-letter thuộc ChainCommand.

Để vẽ đúng state diagram, License có ba phần: **provisioning** (`PENDING_ONCHAIN` trước issuance finality), **administrative state on-chain** (`ACTIVE`, `SUSPENDED`, `REVOKED`) và **temporal condition** (`VALID`/`EXPIRED` từ `expiresAt`). Cột `licenses.status` là projection materialized để query/UI, không phải một state machine on-chain phẳng. `ChainRightsUsable = administrative ACTIVE + temporal VALID + canonical finality`. Đây là quyền tiêu thụ License, không đồng nghĩa tài khoản được phép đọc hoặc quản lý resource riêng tư.

Với ISSUE ban đầu, `activation_commitment/version` là proposal và trust là `PENDING_FINALITY` cho đến `LICENSE_ISSUED` finality. Với License đã tồn tại, `activation_commitment/version` luôn là giá trị canonical hiện hành; `pending_activation_commitment/version` cùng `pending_activation_command_id` trỏ đúng ROTATE chưa resolve sớm nhất và giữ giá trị kế tiếp. ChainEvent key lưu decoded commitment/version mới và, với `KEY_ROTATED`, cả commitment/version trước đó. Rotate chưa finality không ghi đè current key; chỉ exact `KEY_ROTATED CONFIRMED` mới promote pending -> current. Khi event rotate bị reorg, projection rollback current về đúng previous key từ event, đưa key bị orphan về pending và chuyển trust `UNTRUSTED_REORG`; nếu ISSUE gốc cũng mất canonical thì License về `PENDING_ONCHAIN`, giữ nguyên ISSUE proposal và chưa materialize pending ROTATE descendant. Khi ISSUE canonical lại, cùng transaction phải khôi phục exact pending pointer/commitment/version của ROTATE chưa resolve sớm nhất; trust vẫn `UNTRUSTED_REORG` cho đến khi toàn bộ suffix key canonical. Recovery suffix được xử lý theo sequence; chỉ khi suffix key đã canonical hết mới trở lại `TRUSTED`.

- Administrative: issuance tạo `ACTIVE`; `ACTIVE -> SUSPENDED`; `SUSPENDED -> ACTIVE` chỉ khi temporal condition đã `VALID`; `ACTIVE | SUSPENDED -> REVOKED`; `REVOKED` là terminal.
- Temporal: `VALID -> EXPIRED` khi canonical `expiresAt <= now`; `EXPIRED -> VALID` chỉ sau `LICENSE_RENEWED` finality đưa `expiresAt` về tương lai.
- Projection có thể materialize `EXPIRED` khi administrative state là `ACTIVE`. License `SUSPENDED` quá hạn vẫn hiển thị administrative `SUSPENDED` kèm temporal `EXPIRED`; renewal chỉ làm temporal trở lại `VALID`, sau đó vẫn cần `RESUME_LICENSE` finality.
- LicenseDevice cho phép bind lại cùng `device_ref`: `REVOKED -> ACTIVE`, mỗi lần bind mới tăng `binding_generation`. `REVOKED` chỉ terminal cho generation cũ, không terminal cho danh tính Device.
- `PrivateResourceReadable = User ACTIVE/session hợp lệ + resource ownership`; Customer/Provider vẫn được đọc projection thuộc quyền của mình ở `PENDING_ONCHAIN`, `SUSPENDED`, `EXPIRED` hoặc `REVOKED`.
- `MutationAuthorized = User ACTIVE/session hợp lệ + resource ownership + state/factor theo operation`; mỗi mutation tự quy định activation key, action token, device proof hoặc Provider policy cần thiết.
- `RightsConsumable = ChainRightsUsable + Customer ownership + proof theo operation`; predicate này chỉ dùng cho activate/entitlement hoặc hành vi tiêu thụ quyền.
- Lock/disable account chỉ chặn application access và revoke session; không tự thay đổi quyền on-chain. Public verify vẫn phản ánh chain rights mà không công khai PII.

Các aggregate còn lại dùng graph chuyển trạng thái đóng sau để vẽ diagram và kiểm tra transition:

- Product/Plan: `DRAFT -> PUBLISHED -> ARCHIVED`; không đi ngược. Chỉ `DRAFT` chưa được tham chiếu mới được xóa; bản đã publish phải giữ làm lịch sử.
- KnowledgeDocument: `PENDING -> PROCESSING -> READY | FAILED`; retry là `FAILED -> PENDING`; `READY -> ARCHIVED`; `ARCHIVED` là terminal.
- Conversation: `AI_ACTIVE -> WAITING_SUPPORT -> SUPPORT_ACTIVE`; Support release là `SUPPORT_ACTIVE -> WAITING_SUPPORT`; mọi trạng thái chưa đóng có thể `-> CLOSED`; `CLOSED` là terminal.
- PaymentTransaction review: `UNMATCHED`, `AMOUNT_MISMATCH`, `INVALID` bắt đầu `OPEN`; `MATCHED` sạch và `DUPLICATE` đã link chính xác tới effect transaction không có review. `MATCHED` chỉ được `NONE -> OPEN` sau downstream fulfillment failure dứt điểm trước usable rights; `OPEN -> RESOLVED | CLOSED_NO_ACTION`, không quay về `NONE`, và hai trạng thái kết thúc không reopen. `REMATCHED`, `ACCEPT_AND_FULFILL`, `REFUND_CONFIRMED` đưa `OPEN -> RESOLVED`; `NO_ACTION` đưa `OPEN -> CLOSED_NO_ACTION`; classification gốc và effect tuple đã tạo là immutable. `AMOUNT_MISMATCH` không được `ACCEPT_AND_FULFILL` trực tiếp: chỉ `REMATCHED` tới đúng Attempt có exact amount, hoặc refund/no-action.
- Notification: `PENDING -> SENT | RETRYABLE_FAILED`; retry là `RETRYABLE_FAILED -> PENDING`; hết retry budget `-> DEAD_LETTER`. System Admin có thể audited requeue `DEAD_LETTER -> PENDING` trên cùng row/idempotency identity; `SENT` là terminal.
- ChainEvent luôn được insert ở `PENDING`, rồi `PENDING -> CONFIRMED | REORGED`; `CONFIRMED -> REORGED`; cùng event identity xuất hiện lại cho phép `REORGED -> PENDING -> CONFIRMED` hoặc `REORGED -> CONFIRMED`. Identity/decoded payload không được rewrite; block/observed evidence chỉ đổi khi canonical re-inclusion. Trong mỗi vòng canonical, finality/reorg không được sớm hơn observation của vòng đó; re-inclusion mới phải được observe tại/sau `reorged_at` trước, và finality mới không được sớm hơn observation mới. Row giữ **summary bền vững**, không phải full occurrence ledger: `finalized_at`/`reorged_at` gần nhất tăng đơn điệu, `confirmation_count` không giảm ngoài reorg/re-inclusion và `reorg_count` cộng dồn, không được giảm/xóa; mỗi ChainCommand chỉ có tối đa một event `CONFIRMED` tại trạng thái commit.

## 6. Bất biến bắt buộc

1. `PAYMENT_ACCEPTED` **không** đồng nghĩa License usable.
2. `License.ACTIVE` chỉ do `LICENSE_ISSUED`/rights event đạt finality cập nhật.
3. `LicenseDevice.ACTIVE` được ghi trong PostgreSQL transaction sau khi kiểm tra bearer key, device proof và quota; không chờ blockchain finality.
4. Không có License chain-confirmed thì không giao activation key; không có đồng thời License và Device chain-confirmed thì không cấp/refresh entitlement. Key được giao sau License finality để Customer có thể thực hiện bước activate Device, nên Device finality không phải precondition của key delivery.
5. RPC timeout không được resend mù; phải reconcile tx hash/nonce/idempotency trước.
6. Event `REORGED` không được dùng làm quyền; projection phải rollback/rebuild theo event canonical.
7. `PROVIDER_ADMIN` chỉ truy cập resource có `provider_user_id = authenticated user.id`.
8. Client không được quyết định provider namespace/address, plan commitment hoặc price snapshot.
9. Published Plan là immutable đối với field ảnh hưởng giá/quyền/Terms. Muốn thay đổi phải tạo version Plan mới.
10. Toàn hệ thống dùng một Terms template versioned; Plan bind `terms_version + terms_hash`, Order snapshot lại đúng cặp đó.
11. `plan_commitment` bind provider, plan/version, duration, max devices, entitlements hash và terms hash; **không cần bind payment price** vì price là commercial evidence off-chain.
12. Terms content/Order/Payment/PII không lưu on-chain. Chain chỉ giữ opaque ID/commitment/state tối thiểu.
13. Activation secret plaintext không lưu PostgreSQL/Redis/log/chain. Redis chỉ giữ ciphertext operational envelope có TTL; plaintext chỉ tồn tại thoáng qua trong process tạo/giải mã và trong OS secure storage của Customer sau delivery. Customer owner đã đăng nhập chỉ được nhận một lần sau chain finality. Đây không phải khóa riêng hay lớp mã hóa theo tài khoản.
14. Device ref là opaque/HMAC reference; cấm IMEI/MAC/serial raw.
15. Payment IPN, chain command, message append và notification delivery phải idempotent. Mọi Message append, kể cả AI/SYSTEM, phải có stable caller/event/job idempotency key; retry không được tạo `server_sequence` mới cho cùng logical message.
16. AI/Support không có đường gọi mutation payment/license/blockchain trực tiếp.
17. Redis mất dữ liệu không được làm thay đổi durable business/chain state.
18. Audit không log password, private key, activation secret, raw token hoặc message body ngoài phạm vi cần thiết.
19. Provider chain address/namespace là identity đã approve và immutable trong MVP sau khi Provider có published Plan/License; rotation/migration nằm ngoài scope và cần change control.
20. `payment_transactions.payment_attempt_id` nếu có phải thuộc đúng `order_id`; renewal Order phải target License cùng Provider và trình đúng activation key hiện hành.
21. `last_applied_chain_event_id` của License/Device chỉ được trỏ tới ChainEvent của chính subject đó; chỉ event finality `CONFIRMED` mới được apply.
22. Bearer activation secret được verify off-chain và **không bao giờ gửi lên chain**; smart contract kiểm tra current key version/state/expiry/PostgreSQL-enforced individual Device uniqueness/quota.
23. `ISSUE_LICENSE` không được submit nếu encrypted activation envelope chưa tồn tại và commitment không khớp. Chỉ được regenerate khi command còn `PENDING` **và** `nonce`, `signed_transaction`, `transaction_hash` đều `NULL`; khi bất kỳ field nào đã có thì commitment immutable.
24. `CAT-05` là owner duy nhất của ComparePlansQuery; AI chỉ reuse read-only, không tạo capability riêng.
25. `BC-05` là owner duy nhất của public blockchain verification; `LIC-03` đọc projection qua Customer/Provider JWT.
26. Order/License luôn lưu owner account; activation key không chứa, không công khai và không dùng để chứng minh danh tính người mua. Raw activation key không được lưu DB, log hay chain.
27. Khi event đã từng `CONFIRMED` bị `REORGED`, linked ChainCommand phải quay về `SUBMITTED_UNKNOWN` trừ khi một canonical confirmed event khác chứng minh command; projection rebuild từ canonical events.
28. `License.EXPIRED` chỉ được suy ra từ on-chain `expiresAt` + `canonicalNow` của latest finalized block, không từ một backend-only expiry rule. Backend wall clock chỉ dùng để schedule/poll; nếu finalized head stale/unavailable thì private rights check fail closed và public verify phải báo `STALE/UNAVAILABLE`.
29. Activate, rotate, revoke device, retrieve key và issue/refresh/verify entitlement trong private Customer surface phải có `customer_user_id = authenticated principal.sub`. Activation key/device proof là kiểm tra bổ sung, không thay ownership.
30. Email action token phải one-time, TTL ngắn và bind `userId + licenseId + action`; action tách biệt `ROTATE_KEY`, `SELF_REVOKE_DEVICE`, `REMOTE_REVOKE_DEVICE`, `KEY_RECOVERY`. Với device action, token còn bind `deviceRef + bindingGeneration`; token không dùng chéo self/remote, Device hoặc generation và không được cấp trước khi kiểm tra Customer owner của License.
31. Renewal baseline không phải upgrade/downgrade: Renewal Order phải giữ đúng `product_id + plan_id + plan_commitment` của License. Expiry mới là `addPlanDuration(max(canonical expiresAt, payment effective time), duration_months)`, trong đó `payment effective time` là `provider_occurred_at` từ IPN đã xác thực, không phải thời gian do client gửi; expiry chỉ apply sau `LICENSE_RENEWED` finality.
32. Idempotency chỉ reuse cùng logical request/generation. Một command `CONFIRMED` cũ không được chặn chu kỳ hợp lệ mới như suspend → resume → suspend hoặc activate → revoke → activate; rebind Device phải tăng `binding_generation`.
33. Activation envelope được tạo trước submit, mã hóa, TTL 24 giờ và consume một lần. Chỉ được regenerate secret/commitment khi command còn `PENDING` và `nonce`, `signed_transaction`, `transaction_hash` đều `NULL`; sau thời điểm đó commitment immutable và mất envelope phải trả lỗi/audit, không tự sinh key khác.
34. Trong forward flow, mỗi License chỉ có **một renewal lane**: hoặc một Renewal Order đang mở, hoặc một `RENEW_LICENSE` chưa resolve, không đồng thời cả hai ngoài transaction handoff atomically từ payment acceptance sang ChainCommand. `SUBMITTED_UNKNOWN` và `DEAD_LETTER` chưa resolve vẫn khóa lane. Payment đến trong khi lane bị khóa phải được lưu evidence + `OPEN` review, không tạo command thứ hai.
35. Terms artefact `vN.md` là immutable; production dùng manifest `terms_version -> approved_hash` để Order lịch sử luôn đọc/verify đúng version, không dùng một hash toàn cục để thay thế lịch sử.
36. Register/reset/change password dùng cùng policy canonical tối thiểu 8 ký tự, có hoa, thường, số và ký tự đặc biệt. Login xác minh credential hiện có; không tạo một policy khác làm khóa tài khoản hợp lệ.
37. `ARCHIVED` chặn mọi Order mới, gồm purchase và renewal; License đã cấp vẫn giữ quyền đến expiry/revoke, không bị archive Plan/Product tự động revoke. Muốn còn cho renewal thì Plan/Product phải tiếp tục `PUBLISHED` trong MVP.
38. Forward flow chỉ được **tạo** một rights-mutating ChainCommand chưa resolve cho mỗi License tại một thời điểm, gồm issue/renew/rotate/license lifecycle/device lifecycle. Tạo command dùng per-License lock; bất kỳ `SUBMITTED_UNKNOWN` hoặc `DEAD_LETTER` chưa resolve nào cũng chặn mutation mới. Deep reorg có thể demote nhiều command đã từng confirmed thành một recovery suffix `SUBMITTED_UNKNOWN`; đây không phải command mới và phải reconcile theo thứ tự nhân quả trước khi mở lane.
39. Device challenge phải bind `protocolDomain + action + licenseId + opaqueDeviceRef + bindingGeneration + keyVersion + nonce + expiresAt`; challenge của protocol/domain hoặc activate/revoke/entitlement khác không dùng chéo operation.
40. Chỉ payload IPN đã qua authentication và normalize được thành provider event có stable `provider_event_id`, positive amount, ISO currency code và `provider_occurred_at` hợp lệ mới ghi PaymentTransaction. Payload không parse/normalize được bị từ chối trước business durable effects (có security audit redacted). Event đã normalize nhưng semantic-invalid, unmatched, late, sai currency/state hoặc amount-mismatch phải lưu durable evidence + `OPEN` review; cùng `provider_event_id` chỉ trả kết quả cũ, không tạo row/effect mới. Mọi fulfillment VND phải chứng minh `transaction.amount_minor = attempt.amount_vnd = order.price_vnd_snapshot`, `provider_occurred_at` thuộc interval nửa kín `[max(terms_accepted_at, attempt.created_at), min(attempt.expires_at, payment_due_at))`, và `received_at < ipn_accept_until` đã snapshot bất biến trên Order. PostgreSQL tự đóng dấu `received_at` và các lifecycle timestamp bằng `statement_timestamp()`; caller không được backdate/future-date để đổi cutoff. Commerce admission/timeout dùng cùng trusted DB statement clock; payment effective time vẫn là verified provider time, còn `canonicalNow` từ finalized block chỉ điều khiển chain/License temporal state. Trong transaction fulfillment, thứ tự bắt buộc là ghi exact durable effect khi Order còn `WAITING_PAYMENT`, late-correct exact Attempt sang `SUCCEEDED` nếu cần, rồi mới project Order sang `PAYMENT_ACCEPTED`; late correction lưu immutable `corrected_from_status + correction_boundary_at`. License purchase phải bind chính effect đó, `period_start = provider_occurred_at`, exact quota snapshot và `ISSUE_LICENSE` trong cùng transaction; `ISSUE_LICENSE`/`RENEW_LICENSE` không được tồn tại nếu Order chưa có exact paid effect. Order snapshot/lifecycle fields bất biến; Order, PaymentAttempt và PaymentTransaction durable evidence không được delete/truncate; review chỉ được đi theo graph đã định.
41. ChainEvent dùng để apply projection phải liên kết đúng ChainCommand, subject, expected event type, network, chain ID, contract address và transaction hash, đồng thời đạt `CONFIRMED`; event orphan, sai identity, `PENDING` hoặc `REORGED` không được apply. License phải trỏ event canonical `CONFIRMED` mới nhất và đúng loại projection status; individual Device không có canonical event riêng, chỉ có ACTIVE/REVOKED do PostgreSQL quản lý. `licenses.expires_at` chỉ được đổi một lần khi pointer chuyển sang exact `LICENSE_RENEWED CONFIRMED`; chỉ được giảm khi pointer rời chính renewal event đã `REORGED` và command về `SUBMITTED_UNKNOWN`. ChainCommand/ChainEvent evidence không được delete/truncate; event mới luôn vào `PENDING`, identity/decoded evidence bất biến và reorg summary giữ latest timestamps + cumulative count đơn điệu, không được hiểu là full occurrence ledger. Mỗi command tối đa một canonical confirmation; event key còn normalize commitment/version mới và previous key cho rollback/promotion chính xác.
42. Provider chain address/namespace, plan commitment và event/transaction identity phải được canonicalize trước khi so sánh hoặc tạo unique identity; EVM address/hash lưu lowercase, namespace so sánh case-insensitive.
43. Mỗi ChainCommand có `license_command_sequence` liên tục theo License: sequence 1 là ISSUE đầu tiên, command sau phải trỏ đúng predecessor có sequence `current - 1`. Trừ ISSUE, `basis_chain_event_id` phải là confirmation event của command `CONFIRMED` có sequence lớn nhất đứng trước nó tại lúc tạo/reopen/submit; raw basis link được giữ khi event reorg để truy vết causal suffix. Mọi ISSUE sequence > 1 chỉ hợp lệ như reciprocal replacement của ISSUE cũ. `SUPERSEDED` và replacement phải link hai chiều, replacement có sequence lớn hơn và giữ cùng command type/logical subject/network. Forward admission dưới per-License lock chỉ cho một command actionable; reorg dùng sequence/dependency để reconcile theo thứ tự nhân quả.
44. New purchase dùng `period_start = verified provider_occurred_at` và proposed expiry `addPlanDuration(period_start, duration_months)`. Giá trị ở License `PENDING_ONCHAIN` chỉ là proposal cho command; canonical expiry là giá trị contract/event sau finality. Nếu proposal không còn ở tương lai so với `canonicalNow` trước submit thì trong một transaction chuyển ISSUE chưa submit sang `ABANDONED` với reason `ISSUE_PROPOSAL_EXPIRED`, giữ License non-usable `PENDING_ONCHAIN` làm evidence và mở review trên PaymentTransaction `MATCHED`; không tự tính lại kỳ hạn. Review này chỉ kết thúc bằng `REFUND_CONFIRMED` hoặc `NO_ACTION` theo evidence, không dùng fulfillment để hồi sinh proposal đã hết hạn.
45. `addPlanDuration(t, n)` là cộng `n` tháng theo lịch UTC, giữ time-of-day và clamp ngày về ngày cuối hợp lệ của tháng đích; cùng test vector phải dùng cho purchase/renewal. Renewal expiry là `addPlanDuration(max(canonical expiresAt, provider_occurred_at), duration_months)`.
46. Key chỉ được giao/dùng khi trust state `TRUSTED`. ISSUE trước finality là `PENDING_FINALITY`; key event mất canonical chuyển `UNTRUSTED_REORG`. `KEY_ROTATED` reorg rollback current về previous key evidence và giữ orphan key ở pending; cùng exact event canonical lại thì promote lại đúng orphan key, không sinh secret mới. Nếu mất canonical vĩnh viễn nhưng License gốc vẫn tồn tại, resolve command cũ rồi chạy owner key-recovery. Nếu chính `LICENSE_ISSUED` mất canonical thì giữ nguyên ISSUE proposal, reconcile/rebroadcast cùng raw ISSUE; chỉ khi transaction cũ chắc chắn không thể áp dụng mới atomically link reciprocal replacement `ISSUE_LICENSE` cùng commitment đã chốt hoặc đi refund. Không được ROTATE một License chưa tồn tại canonical on-chain.

## 7. Transaction boundary canonical

| # | Use case | Cùng PostgreSQL transaction | Sau commit/runtime |
|---:|---|---|---|
| 1 | CreateOrder | Lock published Plan; bind authenticated Customer + idempotency key; luôn khởi tạo `WAITING_TERMS_ACCEPTANCE`; snapshot provider/product/plan/price/rights/Terms/commitment và immutable `ipn_accept_until = payment_due_at + policy grace` | Không external call trong transaction |
| 2 | AcceptTerms | Lock Order; verify Customer ownership + exact terms version/hash; set `WAITING_PAYMENT` | Tạo checkout khi Customer yêu cầu |
| 3 | CreatePaymentAttempt | Lock Order; nếu attempt `PENDING` còn hạn thì trả lại attempt đó; nếu hết hạn thì chuyển `EXPIRED`, hoặc `SUPERSEDED` khi chủ động thay thế, rồi mới insert attempt mới | Trả SePay reference/QR; không tạo attempt khi Order đã quá `payment_due_at` |
| 4 | IPN NEW_PURCHASE | Chỉ từ Order `WAITING_PAYMENT` đã accept exact Terms; PostgreSQL statement-stamp và insert exact durable PaymentTransaction effect trước, prove exact amount/provider-time/cutoff (thêm supersede boundary khi có), late-correct exact Attempt `SUCCEEDED` nếu cần, rồi project Order `PAYMENT_ACCEPTED`. Trong cùng transaction create License `PENDING_ONCHAIN` với `period_start = effect.provider_occurred_at`, exact quota snapshot và sequenced `ISSUE_LICENSE`; License/ISSUE không được tồn tại thiếu paid effect | Sau commit chuẩn bị/kiểm tra encrypted activation envelope; Relayer chỉ submit khi envelope tồn tại, commitment khớp và proposed expiry còn hợp lệ; không giao key |
| 5 | IPN RENEWAL | Composite-check Renewal Order↔đúng Customer/Provider/Product/Plan/commitment của target License; chỉ tạo `RENEW_LICENSE` khi exact Renewal Order có `PAYMENT_ACCEPTED` durable effect, rồi atomic handoff sang sequenced command với `addPlanDuration(max(canonical expiresAt, verified provider_occurred_at), duration_months)` | Relayer submit; chưa kéo dài quyền; lane conflict vào payment review |
| 6 | ActivateDevice | Public bearer key + fresh device proof; không cần purchaser session. DB transaction enforce quota và lưu Device ACTIVE, giữ nguyên owner | Blockchain chỉ nhận aggregate async `activeDeviceCount + deviceStateVersion` |
| 7 | RotateKey | Verify Customer ownership + current activation key + recent password re-auth + one-time token bind `ROTATE_KEY`; lock License; giữ nguyên current commitment/version/trust, ghi pending next commitment/version + exact pending command pointer; không external Redis call trong DB transaction | Sau commit chuẩn bị/verify envelope; relayer submit khi khớp; `KEY_ROTATED` finality mới atomically promote exact pending và giao key mới một lần |
| 8a | SelfRevokeDevice | Owner + activation key + fresh device proof + action token; DB transaction ghi REVOKED | Aggregate sync async; entitlement kiểm tra DB ngay |
| 8b | RemoteRevokeDevice | Owner + password re-auth + action token; không yêu cầu device proof; DB transaction ghi REVOKED | Aggregate sync async; không chờ finality |
| 8c | OwnerKeyRecovery | Verify Customer ownership + recent password re-auth + one-time token bind `KEY_RECOVERY`; không yêu cầu current key; lock License, reject `REVOKED`/unresolved lane và create pending next-version recovery `ROTATE_KEY` | Same envelope/relayer/finality; one-time delivery sau finality, không sửa commitment cũ |
| 9 | Suspend/Resume/Revoke | Provider ownership + policy + audit; create command | Projection đổi sau finality |
| 10 | ChainEvent apply | Idempotent event insert/finality update; enforce one confirmed event/command, immutable evidence, exact key before/after evidence, projection transition + reverse command confirmation pointer | Notification sau commit |
| 11 | PaymentReview | System Admin lock evidence; chỉ `OPEN -> RESOLVED | CLOSED_NO_ACTION`, chọn resolution đúng classification/reason và ghi reviewer/time/reason | `REMATCHED/ACCEPT_AND_FULFILL` dùng cùng exact amount/time/cutoff gate như auto-IPN; effect tuple và terminal review immutable; MATCHED failure chỉ refund/no-action; Order terminal không hồi sinh |
| 12 | Conversation | Customer branch: JWT + ownership; AI branch: system context; Support branch: đúng staff đã claim. CAS lifecycle + ordered/idempotent Message + audit assignment | Socket/polling chỉ là delivery mechanism, không đổi authorization |

## 8. Catalog 35 capability canonical

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
| `COM-06` | Renewal Order | Customer/Worker | JWT xác định owner và trình activation key hiện hành; payment chỉ tạo pending renewal command |

### MOD-04 — Licensing (8)

| ID | Chức năng | Actor | Ràng buộc chính |
|---|---|---|---|
| `LIC-01` | Request/cấp License | Worker/Chain | Payment accepted -> `PENDING_ONCHAIN`; `ACTIVE` chỉ sau `LICENSE_ISSUED` finality |
| `LIC-02` | Activation key lifecycle | Customer owner/Worker/Chain | Commitment on-chain; owner JWT + step-up policy cho rotate/recovery; Customer owner nhận plaintext một lần sau issue/rotate finality; key không định danh người mua |
| `LIC-03` | Xem License và trạng thái projection | Customer/Provider Admin | JWT + ownership; public verify thuộc `BC-05` |
| `LIC-04` | Kích hoạt thiết bị | Public client/Backend | Bearer activation key + device proof; PostgreSQL transaction enforce quota và ACTIVE/REVOKED; không chuyển ownership |
| `LIC-05` | Revoke thiết bị | Customer owner/Worker/Chain | Self-revoke cần owner JWT + action token + activation key + fresh device proof; remote revoke cần owner step-up và không yêu cầu proof của thiết bị bị mất; relayer-only on-chain |
| `LIC-06` | Entitlement issue/refresh/verify | Customer owner/Device/Backend | Token 5 phút; issue/refresh cần fresh device proof; verify re-check chain-confirmed projection + current key/entitlement version |
| `LIC-07` | Áp dụng renewal | Customer/Worker/Chain | Chỉ `LICENSE_RENEWED` finality mới kéo dài expiry |
| `LIC-08` | Suspend/Resume/Revoke/Expire | Provider Admin/Worker/Chain | Provider Admin quyết định lifecycle theo policy; Worker relay/derive; chain finality là quyền cuối; `EXPIRED` suy ra từ on-chain `expiresAt` |

### MOD-05 — Blockchain Core (5)

| ID | Chức năng | Actor | Ràng buộc chính |
|---|---|---|---|
| `BC-01` | Smart Contract License/Device Registry | Chain | Enforce transition, expiry, current key-version, PostgreSQL-enforced individual Device uniqueness/quota và relayer authorization; bind provider address + plan commitment; chain là rights authority |
| `BC-02` | ChainCommand và Relayer | Backend/Worker | Stable idempotency, nonce, uncertain submit, retry/dead-letter |
| `BC-03` | ChainEvent, Indexer và finality/reorg | Worker | Event identity duy nhất; confirmation; reorg không usable |
| `BC-04` | Projection và reconcile | Worker/System Admin | Sở hữu toàn bộ reconcile logic; scheduled reconcile do Worker, manual reconcile chỉ System Admin và phải có audit |
| `BC-05` | Public Blockchain Verification | Public/Worker | Owner duy nhất của public verify: chain state, tx/event/finality, plan commitment; cấm PII/Terms content |

### MOD-06 — Assistance & Support (4)

| ID | Chức năng | Actor | Ràng buộc chính |
|---|---|---|---|
| `AST-01` | Knowledge ingestion | Provider/Worker | FAQ/PDF/TXT gắn Product; version/current; private storage |
| `AST-02` | Grounded RAG + read-only Plan advisory | Customer/AI | Chỉ current READY + catalog published; AI reuse `CAT-05` read-only |
| `AST-03` | Conversation và ordered Message | Customer/AI/Support | Customer ownership; một timeline; idempotent append; server sequence |
| `AST-04` | Handoff/Support queue | Customer/Support | Atomic claim/release/close; Support chỉ conversation đã claim |

### MOD-07 — Operations (3)

| ID | Chức năng | Actor | Ràng buộc chính |
|---|---|---|---|
| `OPS-01` | Notification và Android push | Worker | In-app/email/push, idempotent, retry/dead-letter; adapter lỗi không rollback business |
| `OPS-02` | Audit | System/Worker | Append-only action/outcome/reason, redaction secret/PII |
| `OPS-03` | Dashboard và health operations | Provider Admin/System Admin | Provider chỉ xem aggregate của chính mình; System Admin xem health và có thể trigger `BC-04`; UI không sở hữu reconcile engine; không predictive BI/data warehouse |

**Tổng: 4 + 5 + 6 + 8 + 5 + 4 + 3 = 35 capability.**

## 9. Golden flow

### 9.0. Registration và session

1. Customer đăng ký -> User `PENDING_EMAIL_VERIFICATION`; backend lưu hash của verification token one-time có expiry và gửi link qua Brevo adapter.
2. Verify hợp lệ -> User `ACTIVE`; token đã dùng, bị thay thế hoặc hết hạn không được dùng lại.
3. Resend verification luôn trả response trung tính, rate-limit theo account/IP và atomically thay thế token cũ để account pending không bị kẹt nhưng cũng không lộ email tồn tại.
4. Login kiểm tra Argon2id, status/lockout; backend phát access token ngắn hạn và refresh token rotation. Web giữ refresh token trong cookie `HttpOnly + Secure + SameSite`; Android giữ session token trong OS SecureStore.
5. Lock/disable, reset/change password, logout và phát hiện refresh-token reuse đều tăng `session_version`; toàn bộ access/refresh token cũ của account bị từ chối. Baseline chọn **account-wide logout/revocation**, không có logout riêng từng device.

Các cạnh auth dùng để vẽ diagram:

- `PENDING_EMAIL_VERIFICATION -> ACTIVE`: Customer consume email token one-time còn hạn.
- `ACTIVE -> LOCKED`: đủ số lần login sai (temporary lock có `locked_until`) hoặc System Admin lock; transition tăng `session_version`.
- `LOCKED -> ACTIVE`: temporary lock hết hạn được backend tự mở ở lần login sau, hoặc System Admin unlock; reset failed-login counter.
- `ACTIVE | LOCKED -> DISABLED`: chỉ System Admin; `DISABLED` terminal trong baseline và mọi session bị revoke.
- Forgot password không tiết lộ email tồn tại. Reset dùng token one-time/TTL; change password cần current password. Reset/change thành công tăng `session_version` nhưng không đổi User state.
- Refresh rotation atomically consume token cũ và phát token mới; reuse làm revoke toàn bộ session của account.
- Step-up được định nghĩa theo từng operation. Mọi action token là one-time, TTL tối đa 10 phút và bind `userId + licenseId + action`, chỉ phát sau ownership check. `ROTATE_KEY`, `REMOTE_REVOKE_DEVICE` và `KEY_RECOVERY` còn bắt buộc password re-auth trong tối đa 10 phút; self-revoke dùng current activation key + fresh proof của exact Device/generation làm possession factor và không yêu cầu thêm password re-auth. Action/resource khác không dùng lại token được.

### 9.1. New purchase

1. Provider account đã được approve và có chain namespace/address.
2. Provider publish Product và Plan; Plan bind Terms version/hash hiện hành và có `plan_commitment`.
3. Customer đăng nhập và chọn Plan; client tạo UUID idempotency key cho request.
4. Backend tạo Order từ published Plan, snapshot toàn bộ commercial/rights evidence và snapshot bất biến `ipn_accept_until = payment_due_at + IPN_DELIVERY_GRACE` theo policy đang hiệu lực.
5. Customer owner xem đúng Terms version và đồng ý trước `payment_due_at`; Order -> `WAITING_PAYMENT`. Customer chỉ được hủy `WAITING_TERMS_ACCEPTANCE` hoặc `WAITING_PAYMENT` khi trusted `commerceNow < payment_due_at`; hủy trước Terms không được giả lập `terms_accepted_at`.
6. Customer owner tạo PaymentAttempt và thanh toán SePay. Attempt chỉ được tạo từ `WAITING_PAYMENT` đã accept Terms, có exact Order snapshot amount và `expires_at <= payment_due_at`. Attempt hết hạn chỉ đóng reference/QR đó; Order vẫn `WAITING_PAYMENT` và có thể tạo attempt mới trước `payment_due_at`.
7. Tại `payment_due_at`, backend dừng accept Terms/tạo attempt/hủy Order. Order còn `WAITING_TERMS_ACCEPTANCE` expire ngay; Order `WAITING_PAYMENT` đi vào cửa sổ **callback-only** và `EXPIRED` khi trusted `commerceNow >= ipn_accept_until`. Trong cửa sổ này chỉ IPN cho giao dịch thực sự xảy ra đúng hạn được xét; policy grace phải bao phủ delivery-latency đã cam kết nhưng thay đổi cấu hình sau đó không được sửa cutoff đã snapshot.
8. IPN auto-fulfill chỉ khi Order chính xác là `WAITING_PAYMENT`, đã accept exact Terms, amount/currency khớp Attempt + Order, `provider_occurred_at` thuộc `[max(terms_accepted_at, attempt.created_at), min(attempt.expires_at, payment_due_at))`, nếu attempt đã supersede thì còn `< superseded_at`, và DB-stamped `received_at < ipn_accept_until`. Cùng transaction phải ghi effect khi Attempt/Order còn ở pre-effect state, rồi chuyển Attempt `SUCCEEDED`, Order `PAYMENT_ACCEPTED`, tạo License `PENDING_ONCHAIN` với `period_start = provider_occurred_at`, proposed expiry theo `addPlanDuration`, rồi tạo sequenced `ISSUE_LICENSE`. `received_at` chỉ quyết định delivery cutoff/audit, không thay payment effective time.
9. Sau commit, hệ thống phải bảo đảm encrypted activation envelope tồn tại và decrypt/re-hash khớp commitment. Relayer **không được submit** ISSUE khi precondition này chưa đạt. Nếu preparation lỗi, chỉ được regenerate atomically khi command còn `PENDING` và `nonce`, `signed_transaction`, `transaction_hash` đều `NULL`.
10. Ngay khi bất kỳ `nonce`, `signed_transaction` hoặc `transaction_hash` đã tồn tại, activation commitment immutable dù status chưa đổi sang `SUBMITTED`. RPC uncertain dùng reconcile, không resend mù.
11. Ngay trước submit, nếu proposed expiry không còn ở tương lai so với `canonicalNow`, atomically chuyển command chưa submit sang `ABANDONED/ISSUE_PROPOSAL_EXPIRED`, giữ License `PENDING_ONCHAIN`, mở fulfillment review trên PaymentTransaction `MATCHED` và chỉ xử lý refund/no-action; không tự dời kỳ hạn.
12. Indexer thấy `LICENSE_ISSUED`; chỉ sau finality mới chuyển License `ACTIVE`, key trust `TRUSTED` và cho Customer owner đã đăng nhập nhận activation key một lần.
13. Payment/Order hoàn tất về thương mại nhưng rights luôn đọc từ License projection + chain evidence.

Các cạnh state dùng để vẽ diagram:

- Order: `WAITING_TERMS_ACCEPTANCE -> WAITING_PAYMENT | CANCELLED | EXPIRED`; `WAITING_PAYMENT -> PAYMENT_ACCEPTED | CANCELLED | EXPIRED`; ba trạng thái cuối là terminal.
- PaymentAttempt: `PENDING -> SUCCEEDED | FAILED | EXPIRED | SUPERSEDED`; ngoại lệ correction có bằng chứng là `EXPIRED | SUPERSEDED -> SUCCEEDED` khi provider payment xảy ra trước exact expiry/supersede boundary, webhook được DB nhận trước immutable Order cutoff và Order vẫn `WAITING_PAYMENT`.
- Hủy Order trước due phải atomically chuyển mọi PaymentAttempt còn `PENDING` thành `SUPERSEDED`. Attempt timeout chỉ chuyển attempt đó sang `EXPIRED`; Order chưa accept Terms expire tại due, còn Order chờ payment ở callback-only rồi expire sau delivery grace, và hai nhánh expiry đều atomically chuyển mọi attempt còn `PENDING` sang `EXPIRED`.
- Tạo attempt thay thế phải chuyển attempt `PENDING` cũ sang `SUPERSEDED` trước `expires_at`, bằng DB statement timestamp, trong cùng transaction. On-time provider payment cho attempt `EXPIRED/SUPERSEDED` nhưng webhook tới trễ vẫn được correction sang `SUCCEEDED` nếu thỏa exact half-open time window, riêng attempt đã supersede còn bắt buộc `provider_occurred_at < superseded_at`, `received_at < ipn_accept_until` và Order còn `WAITING_PAYMENT`. Effect row phải được ghi khi Attempt vẫn giữ boundary cũ; sau đó correction lưu immutable `corrected_from_status + correction_boundary_at`, và cùng transaction phải `SUPERSEDED` mọi attempt khác còn `PENDING`. Nếu sai window/cutoff hoặc Order đã terminal thì chỉ lưu evidence + `OPEN` review, tuyệt đối không hồi sinh Order terminal.
- IPN sai authentication hoặc không normalize được stable ID/positive amount/ISO currency/provider time bị từ chối trước business durable effects. IPN đã normalize nhưng unmatched, late, sai amount/currency mapping hoặc sai state phải lưu evidence + `OPEN` review.
- Cùng `provider_event_id` là idempotent replay: trả lại kết quả cũ, không tạo row/effect mới. Một provider event ID khác nhưng trỏ cùng bank transaction/order đã tạo effect — kể cả effect từ `REMATCHED/ACCEPT_AND_FULFILL` — được lưu `DUPLICATE`, link exact effect transaction và không mở review/lặp effect.
- Payment review chỉ do System Admin resolve và luôn lưu `reviewed_by`, thời điểm, lý do, resolution. `REMATCHED` dùng khi xác định lại đúng Order/Attempt rồi chạy transition chuẩn; `ACCEPT_AND_FULFILL` là ngoại lệ khi reference không rematch tự động nhưng chọn được đúng existing Order/Attempt. Hai outcome fulfillment phải chạy lại chính exact amount/time/`ipn_accept_until` gate của auto-IPN; tuyệt đối không từ `WAITING_TERMS_ACCEPTANCE`, `FAILED` attempt hoặc Order terminal. Attempt `EXPIRED/SUPERSEDED` chỉ được late-correction theo exact rule ở trên. `AMOUNT_MISMATCH` không accept trực tiếp; `MATCHED` fulfillment failure chỉ `REFUND_CONFIRMED` hoặc `NO_ACTION`. Review terminal và effect Order/Attempt tuple không được rewrite.

### 9.2. Device activation

1. Client gọi public `/activations/challenge` bằng bearer activation key và device reference; không cần purchaser session. Challenge bind protocol/action/license/device/generation/keyVersion/nonce/expiry.
2. Device ký challenge bằng private key cục bộ. Backend kiểm tra commitment, proof và atomically consume nonce.
3. PostgreSQL transaction khóa License, kiểm tra state/expiry/current key version/quota và tạo Device ACTIVE. Không thay đổi customer ownership; private key không rời thiết bị.
4. DB lưu signer address, device reference và binding generation. Blockchain không nhận individual device identity; worker chỉ đồng bộ async aggregate `activeDeviceCount + deviceStateVersion`.
5. Entitlement kiểm tra license lifecycle/trust và Device ACTIVE trong DB, không chờ aggregate sync finality.
6. Revoke ghi REVOKED trong DB transaction; bind lại tăng binding generation và trả ACTIVE sau kiểm tra quota. Management vẫn yêu cầu owner authorization.

### 9.3. Renewal

1. Customer owner trình activation key hiện hành và chọn đúng Plan/commitment đang gắn với License; renewal không đổi quyền/quota/Plan.
2. Backend khóa License và snapshot đúng Provider/Product/Plan/Terms; cross-owner, cross-provider, cross-plan hoặc key sai bị từ chối trước khi tạo Order. Chỉ tạo khi License không có Renewal Order mở và không có rights-mutating ChainCommand chưa resolve.
3. Accept Terms và thanh toán như flow chuẩn. Expiry đề xuất = `addPlanDuration(max(canonical expiresAt, payment effective time), duration_months)`, với `payment effective time = provider_occurred_at` từ IPN đã xác thực, để License đã hết hạn được gia hạn từ thời điểm giao dịch hợp lệ.
4. Khi payment được accept, cùng transaction khóa License, kết thúc Renewal Order mở và tạo request-scoped `RENEW_LICENSE`; không có trạng thái commit mà Order còn mở đồng thời command đã tồn tại và **không** sửa `expires_at` trước chain.
5. `LICENSE_RENEWED` finality mới cập nhật expiry/entitlement version; entitlement cũ bị invalid vì version thay đổi.
6. Nếu lúc IPN đến đã có mutation command khác, renewal command unresolved hoặc lane không còn hợp lệ, vẫn lưu PaymentTransaction nhưng đưa `OPEN` review; không tạo command thứ hai và không tự kéo dài expiry.

### 9.4. Suspend/Resume/Revoke

Provider request -> authorization/policy -> ChainCommand -> Smart Contract -> ChainEvent/finality -> projection. Backend không tự ghi quyền cuối cùng.

- `ACTIVE + VALID -> SUSPENDED + VALID`; nếu thời gian trôi qua expiry thì giữ administrative `SUSPENDED` nhưng temporal thành `EXPIRED`.
- Renewal của License đang suspended chỉ cập nhật expiry/temporal condition; không tự resume.
- `SUSPENDED + VALID -> ACTIVE + VALID` qua `RESUME_LICENSE`; resume khi temporal `EXPIRED` bị từ chối cho đến khi renewal finality.
- `ACTIVE | SUSPENDED -> REVOKED`; License `REVOKED` không renewal/resume/rotate/activate Device và là terminal.

### 9.5. Rotate key / revoke device

1. Customer owner yêu cầu action verification; backend kiểm tra ownership rồi gửi token bind `userId + licenseId + action` qua email. Action dùng enum tách biệt; self/remote revoke còn bind exact `deviceRef + bindingGeneration`.
2. Normal rotate cần owner JWT + current activation key + recent password re-auth + token `ROTATE_KEY`. Backend consume token đúng một lần, khóa License và tạo pending commitment/version kế tiếp; current commitment/version/trust vẫn canonical cho đến finality.
3. Self-revoke cần owner JWT + activation key + token `SELF_REVOKE_DEVICE` + fresh proof của exact Device/generation; fresh proof là possession factor nên baseline không yêu cầu thêm password re-auth. Remote revoke thiết bị mất cần owner JWT + recent password re-auth + token `REMOTE_REVOKE_DEVICE` + current activation key, nhưng **không** yêu cầu private key/proof của thiết bị bị mất; token không dùng cho Device/generation khác.
4. Tạo command mới theo request -> relayer -> chain confirmation -> projection/version mới. Không reuse command `CONFIRMED` của chu kỳ trước.
5. Từ lúc transaction rotate được include đến finality, backend chặn key-dependent mutation và entitlement issue/refresh cho License đó để không trộn hai key version. Current key/trust không bị pending key ghi đè; plaintext key mới chỉ giao một lần sau `KEY_ROTATED` finality atomically promote pending -> current, lúc đó key/entitlement version cũ mới không còn hợp lệ.

Owner key-recovery khi mất activation key:

1. Chỉ Customer owner có session hợp lệ mới yêu cầu được; backend bắt buộc recent password re-auth + email action token bind `KEY_RECOVERY`, rate-limit mạnh và audit. Flow này không cần current activation key.
2. Backend khóa License, từ chối License `REVOKED`, bảo đảm không có Renewal Order/mutation command chưa resolve rồi tạo một `ROTATE_KEY` recovery command với version kế tiếp. License `SUSPENDED` hoặc temporal `EXPIRED` vẫn được recovery key nhưng quyền sử dụng vẫn bị chặn bởi state tương ứng.
3. Key recovery đi qua cùng envelope, relayer, finality và one-time delivery như normal rotate. Nếu cần remote revoke nhưng đồng thời mất key, hoàn tất recovery trước rồi mới tạo `REVOKE_DEVICE` riêng.

### 9.6. Reorg / uncertain transaction

- `SUBMITTED_UNKNOWN`: query receipt, nonce và canonical contract state trước khi quyết định; không tạo payload/nonce mới khi chưa biết kết quả transaction cũ.
- Khi event `CONFIRMED` thành `REORGED`, dưới per-License lock phải xác định toàn bộ suffix phụ thuộc. Chỉ command mất matching canonical confirmation của chính nó mới demote `CONFIRMED -> SUBMITTED_UNKNOWN`; command vẫn có canonical event đúng identity tiếp tục `CONFIRMED`. Descendant chưa submit dựa trên orphaned basis được park `DEAD_LETTER`; chỉ reopen khi basis đó canonical lại, nếu không phải `ABANDONED` hoặc atomically `SUPERSEDED` cùng reciprocal replacement cùng operation/subject và sequence lớn hơn. Rebuild projection theo causal order; recovery suffix khóa mọi command mới. Khi ISSUE được confirm lại sau deep reorg, transaction apply phải gắn lại exact pending key/pointer của ROTATE unresolved sớm nhất và chưa được đưa trust về `TRUSTED`.
- Nếu reorg xảy ra sau khi key mới đã giao, chuyển trust sang `UNTRUSTED_REORG`. `KEY_ROTATED` rollback current về exact previous commitment/version trong decoded event và giữ orphan key ở pending/recovery evidence; deep multi-ROTATE reorg lùi pending pointer từng bước về exact earliest unresolved ROTATE, không bị immutability guard của ROTATE sau chặn. Nếu chính event đó canonical lại thì promote lại đúng orphan key. Khi deep reorg chạm ISSUE, License về `PENDING_ONCHAIN`, giữ ISSUE proposal, clear pending ROTATE **projection pointer** nhưng vẫn giữ nguyên ordered ROTATE command/evidence suffix và chưa materialize descendant cho đến khi ISSUE canonical lại. Chỉ khi toàn bộ key suffix canonical mới chuyển `TRUSTED`; mất vĩnh viễn thì resolve command cũ rồi owner-recovery, còn ISSUE đi same-raw/replacement ISSUE hoặc refund, tuyệt đối không ROTATE License chưa tồn tại canonical.
- Entitlement refresh luôn re-check current projection/finality/version để giới hạn thời gian ảnh hưởng của state cũ.

### 9.7. Entitlement

1. Customer owner chọn Device `ACTIVE`, xin fresh protocol/domain-separated entitlement challenge theo cùng tuple ở mục 9.2 và Device ký EIP-191 proof.
2. Backend atomically consume challenge và chỉ ký entitlement khi License + Device đều `ACTIVE`, key trust `TRUSTED`, canonical event đều `CONFIRMED`, chưa expiry và version hiện hành khớp.
3. Token có issuer/audience/JTI và TTL tối đa 5 phút hoặc đến License expiry, tùy thời điểm nào đến trước.
4. Verify không chỉ kiểm tra chữ ký JWT mà phải đọc projection hiện hành. Rotate, renewal, suspend, revoke Device/License, expiry hoặc reorg làm token cũ bị từ chối theo key/entitlement version và canonical state.

### 9.8. Envelope/key unavailable

- Trước khi reserve nonce/raw transaction: nếu envelope thiếu/tamper, worker được phép sinh secret/commitment mới, cập nhật command + License pending atomically rồi tạo lại envelope.
- Sau khi đã reserve nonce/raw transaction hoặc broadcast: commitment immutable; worker chỉ reconcile transaction. Envelope hết TTL/mất/đã consume trả `ACTIVATION_KEY_UNAVAILABLE`, ghi audit và không tự phát hành key khác.
- Nếu Customer đã mất activation key hoặc one-time envelope đã consume/hết hạn sau finality, dùng owner key-recovery ở mục 9.5; không tái hiển thị secret cũ và không thay commitment của command cũ.

### 9.9. Retry, dead-letter và manual recovery

- Graph chuẩn: `PENDING -> SUBMITTED | RETRYABLE_FAILED | DEAD_LETTER | ABANDONED` (`PENDING -> DEAD_LETTER` dùng để park orphan-basis/pre-submit failure); `RETRYABLE_FAILED -> PENDING | DEAD_LETTER`; `SUBMITTED -> CONFIRMED | SUBMITTED_UNKNOWN | DEAD_LETTER`; `SUBMITTED_UNKNOWN -> SUBMITTED | CONFIRMED | DEAD_LETTER | ABANDONED | SUPERSEDED`; `DEAD_LETTER -> PENDING` chỉ khi chưa có signed raw/tx hash và, với command không phải ISSUE, latest canonical basis đã trở lại. Raw+hash còn uncertain phải đi `DEAD_LETTER -> SUBMITTED_UNKNOWN` để same-raw reconcile; nếu definitive proof đã có thì được resolve terminal trực tiếp. Terminal resolution bắt buộc immutable typed JSON `resolution_evidence_type + resolution_evidence`: trước cả nonce dùng `PRE_SUBMISSION_ABORT`; nonce đã reserve nhưng chưa có raw/hash có thể audited release bằng `NONCE_RESERVATION_RELEASED` để nonce đó được reuse; signed raw dùng `RECEIPT_REVERTED`, hoặc nếu không có reverted receipt thì `RAW_TX_IRREVOCABLE_NO_EFFECT` sau finalized nonce-consumption + canonical contract-state proof. `CONFIRMED -> SUBMITTED_UNKNOWN` chỉ khi reorg làm mất canonical confirmation.
- Receipt `REVERTED` đi `DEAD_LETTER`, không rebroadcast cùng raw transaction. RPC timeout/unknown chỉ vào `SUBMITTED_UNKNOWN`, sau đó reconcile trước mọi retry.
- `DEAD_LETTER` là parked **unresolved**, không phải terminal. Reserved nonce đơn lẻ chưa phải submission evidence: có thể `-> PENDING` nhưng phải giữ nguyên nonce/payload và, với non-ISSUE, revalidate basis. Nếu basis không thể canonical lại, command nonce-only được terminal-resolve bằng typed `NONCE_RESERVATION_RELEASED`; partial unique index khi đó cho command sau reuse đúng nonce mà không xóa evidence cũ. Khi signed raw + tx hash đã tồn tại mà outcome còn uncertain thì phải `-> SUBMITTED_UNKNOWN` và reconcile/broadcast lại **cùng raw transaction**; raw cũ không bao giờ bị rewrite. Direct terminal chỉ hợp lệ nếu definitive typed proof đã sẵn có. Chỉ receipt `REVERTED` hoặc proof object xác nhận tại finalized block rằng relayer nonce đã bị transaction khác consume **và** canonical contract state không có effect cũ mới cho resolve command cũ; nếu cần retry logic mới thì tạo reciprocal replacement command. `RAW_TX_IRREVOCABLE_NO_EFFECT` không được đồng thời có receipt `SUCCESS` hoặc `REVERTED`. Mọi proof `checkedAt` phải là RFC3339 parse được, nằm trong biên từ mốc evidence muộn nhất (`created/submitted/receipt checked`) đến `resolved_at`; mọi resolution có reason/audit và evidence bất biến, key bắt buộc non-null/đúng kiểu.
- `ABANDONED` và `SUPERSEDED` là terminal resolution; PostgreSQL tự đóng dấu `resolved_at` khi đi vào terminal, và sau đó **toàn bộ row ChainCommand** bất biến, không chỉ status/reason/evidence/link. `CONFIRMED` là terminal trong normal flow; ngoại lệ duy nhất là reorg làm mất chính matching canonical event và đưa command về `SUBMITTED_UNKNOWN` theo mục 9.6.
- Forward flow chỉ có một rights-mutating command chưa resolve; recovery suffix do reorg có thể có nhiều `SUBMITTED_UNKNOWN` nhưng tuyệt đối chặn command mới và phải xử lý theo thứ tự nhân quả. Manual recovery không được bypass per-License serialization và không bao giờ tự sửa License/Device thành `ACTIVE`.

## 10. Dữ liệu on-chain / off-chain

### On-chain tối thiểu

- Provider chain identity/namespace cần cho registry.
- Opaque License ID.
- `plan_commitment` (trong đó đã bind `terms_hash`).
- Activation commitment/key version.
- Expiry, max devices, License/Device state và minimal event metadata.

### Không lưu on-chain

- Terms content hoặc PDF.
- Order snapshot/price/payment reference.
- Email, tên, địa chỉ, tax code hoặc Customer/Provider PII. Các field này có thể tồn tại off-chain trong account/profile nhưng tuyệt đối không đưa lên chain.
- Activation plaintext/private key/raw token.
- IMEI/MAC/serial/device raw identifier.
- AI/Support content.

## 11. Cryptographic protocol tối thiểu

1. Hash dùng cho commitment on-chain là `keccak256`; không dùng JSON/string serialization tùy ý.
2. Terms artefact được normalize **UTF-8 + LF + exactly one final newline** trước khi hash: `terms_hash = keccak256(terms_bytes)`.
3. `entitlements_hash = keccak256(JCS_UTF8(entitlements))`, trong đó JSON canonicalization theo một implementation cố định và có test vector.
4. `plan_commitment = keccak256(abi.encode(DOMAIN_PLAN_V1, provider_chain_address, product_uuid_bytes16, plan_uuid_bytes16, plan_version, duration_months, max_active_devices, entitlements_hash, terms_hash))`.
5. `activation_commitment = keccak256(secret32)` với `secret32` sinh bằng CSPRNG 32 bytes; secret không gửi on-chain.
6. Normal rotate và activate/self/remote revoke device dùng bearer activation key ở backend. Rotate/remote/key-recovery có password re-auth theo policy; self-revoke thay bằng fresh exact-device proof; owner key-recovery không cần key đã mất. Secret không gửi lên chain; smart contract chỉ chấp nhận relayer và enforce state/version/quota.
7. Relayer dùng nonce bền vững, raw signed transaction và receipt reconciliation để chống gửi trùng khi restart/RPC uncertain.
8. TypeScript và Solidity phải dùng cùng test vectors cho Terms hash, entitlements hash, plan commitment và activation commitment.
9. `addPlanDuration` dùng UTC calendar-month + end-of-month clamp và có boundary vectors (tháng 2, leap year, ngày 29/30/31); chỉ epoch expiry đã tính được đưa vào command/contract.

## 12. Client surface

### Web

Public catalog/verify; authenticated Customer workspace; Provider portal; Support workspace; System operations. Mỗi màn hình gọi capability canonical, không sở hữu business transition riêng.

### Android

Đăng nhập Customer, Order/License/activation key/device/entitlement theo JWT và public verify. Android lưu session token, activation key, random `deviceRef` và device private key trong SecureStore (`WHEN_UNLOCKED_THIS_DEVICE_ONLY`); entitlement ngắn hạn chỉ giữ trong memory. Refresh rotation tuân theo AUTH-02; push registration/delivery thuộc OPS-01, không tạo capability mobile riêng.

## 13. Change control

Một đề xuất mới chỉ được nhận nếu trả lời được:

1. Actor nào cần?
2. Capability nào hiện tại không đáp ứng?
3. Có lifecycle/invariant độc lập không?
4. Có nằm trong bài toán Blockchain licensing hay chỉ là tiện ích?
5. Có làm tăng critical path hoặc security boundary không?

Mặc định **không nhận**: table cho cache/report/job chung, role mới, mobile-only feature trùng backend, blockchain environment như feature, hoặc subsystem pháp lý/contract mới.

### Revision history

| Version | Ngày | Nội dung |
|---|---|---|
| **5.1-r4** | **17/09/2026** | **Thống nhất actor, state graph, payment/review, renewal single-flight, owner key-recovery, device revoke, command retry/reorg, ISSUE-vs-ROTATE reorg recovery và client security để làm nguồn duy nhất cho sơ đồ.** |
| **5.1-r3** | **16/09/2026** | **Khóa graph License hai chiều, Device rebind generation, payment effective time và quyền manual reconcile để làm nguồn vẽ sơ đồ.** |
| **5.1-r2** | **16/09/2026** | **Làm rõ owner JWT khác bearer key; bổ sung action-token, entitlement, renewal same-plan, request-scoped idempotency, envelope recovery boundary và các nhánh đủ để vẽ sequence/state diagram.** |
| **5.1** | **11/09/2026** | **Khôi phục Customer account/JWT ownership; vẫn loại Customer Controller và KMS; activation key không định danh người mua; còn 35 capability.** |
| **5.0** | **11/09/2026** | **Loại Buyer identity, Customer Controller và KMS; Buyer ẩn danh dùng bearer secret, contract relayer-only; còn 34 capability.** |
| 3.1 | 06/09/2026 | Historical: 67 feature, Contract 2 chữ ký, 17-table lock, Android/test_client feature duplication. |
| 4.0 | 06/09/2026 | Refactor target: 37 capability, bỏ Contract/signing/test_client, Provider là PROVIDER_ADMIN account, global Terms version/hash, 18-table boundary. |
| **4.1** | **06/09/2026** | **Khóa còn 36 capability; loại Plan advisory duplicate; phân owner verify/reconcile; siết activation flow, payment/chain projection integrity và cryptographic protocol.** |
