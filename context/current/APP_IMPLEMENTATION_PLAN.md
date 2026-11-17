# APP IMPLEMENTATION PLAN — baseline v5.1-r5

> Cập nhật 17/11/2026: không dùng reset/initializer để nâng cấp database có dữ liệu. `db:migrate` hỗ trợ đúng một transition archive ledger lịch sử, mặc định rollback; thay đổi khác cần review schema nguồn, SQL tăng dần và kiểm thử disposable. Xem HDSD.md và `EmuKey/README.md`. Các kết quả nâng cấp trước đây là bằng chứng lịch sử.

> Phạm vi hiện hành 04/11/2026: phát hành và bàn giao key theo ủy quyền nhà cung cấp. Kế hoạch chi tiết và trạng thái kiểm thử: `docs/emukey/plans/2026-11-04-provider-key-handoff-plan.md`. Các báo cáo continuity trước đây là bằng chứng lịch sử, không chứng minh luồng mới đã nghiệm thu toàn bộ.

## 1. Authority

- Nghiệp vụ: `context/current/chuc_nang_toan_he_thong_ver2.0.md`.
- Kiến trúc: `context/current/cong_nghe_he_thong.md`.
- Schema vật lý duy nhất: `EmuKey/backend/database/schema.sql`.
- API: backend OpenAPI; client generated types không sửa tay.
- Capability: `docs/emukey/traceability/capabilities-v4.1.json`, 34 capability; LIC-04/05/06 đổi sang integration/handoff/synchronization.

## 2. Kết quả cần đạt

Provider cấu hình URL/token và ủy quyền → probe/bật tích hợp → customer mua/chấp nhận điều khoản → SePay IPN → payment/license/command/key ciphertext commit → blockchain confirmation → durable delivery → nhà cung cấp ACK → buyer nhận và ACK lưu key.

Sản phẩm nhà cung cấp kiểm tra whitelist bên ngoài EmuKey. EmuKey không thực thi activation/device proof/entitlement cho mode mới. Web và mobile quản lý thuộc đồ án; hệ thống bên bán được thể hiện như một external system chung.

## 3. Các gói triển khai

| Gói | Owner | Gate |
|---|---|---|
| Policy/contract | Licensing application/domain | Payment, issuance, provider ACK và buyer receipt là các bước riêng |
| Schema/key storage | SQL/pg, khởi tạo mới | 24 bảng; dựng lại sẽ xóa dữ liệu; Redis mất không đổi key đã lưu |
| Provider configuration | Licensing | Ownership, probe version, authorization, encrypted credential, SSRF |
| Durable delivery | Licensing worker | Lease/fencing, idempotency, bounded retry, matching receipt |
| Lifecycle | Licensing/Blockchain/Commerce | Renewal không cộng hạn hai lần, rotate thay key, suspend/revoke/trust gửi snapshot |
| UI/API | Web/mobile quản lý | Trạng thái tách biệt, nhận key có gate, không CTA tiêu thụ quyền ở EmuKey |
| Integration verification | Workspace tests/fixture | Receiver DB độc lập, không đọc DB EmuKey để giả kiểm tra key |
| Documentation/diagrams | Context/draw.io | Cùng boundary, giữ phong cách vẽ hiện có |
| Rollout | Guarded database CLI/operator | Backup/restore disposable, kiểm tra drift và transition được hỗ trợ; không reset dữ liệu vận hành |

## 4. Khởi tạo database và giao dịch

Schema mới được tạo trực tiếp từ `schema.sql`, sau đó chạy kiểm tra cấu trúc. Quy trình dựng lại không giữ dữ liệu của database trước đó.

Bằng chứng lịch sử: ngày 05/11/2026 đã nghiệm thu IPN SePay sandbox thật, Sepolia thật, provider fixture độc lập lưu whitelist/ACK, buyer retrieve/ACK qua HTTP và điều hướng về đơn hàng. Phép đo: 19,039 giây từ tạo license đến vào block, 32,782 giây đến CONFIRMED; chỉ là một mẫu sandbox. Bằng chứng nằm trong canonical golden flow.

Mode trên order/license bất biến; đơn mua mới dùng PROVIDER_HANDOFF, đơn chờ thanh toán cũ giữ LEGACY_DEVICE và renewal kế thừa target. Provider chưa tích hợp không được tiếp tục bán bằng legacy để né gate. Key cũ không thể tái tạo từ hash; không tự rotate/backfill dữ liệu cũ.

Payment commit key ciphertext và command cùng transaction; canonical projection commit snapshot/outbox; HTTP gửi sau transaction; ACK commit receipt/notification cùng transaction. Trạng thái có lease trong PostgreSQL, queue chỉ vận chuyển công việc.

## 5. Các phần được giữ

Giữ session rotation, role/ownership, provider invitation, catalog/gói versioned, pricing backend, điều khoản snapshot, SePay timing/review/receipt, AI có nguồn, knowledge lifecycle, support claim lease/generation, notification retry/idempotency và public blockchain verification. Không gộp thêm contract PDF, KMS ký license, tổ chức nhiều thành viên, NFT hoặc crypto payment.

## 6. Nghiệm thu

Chạy focused tests rồi lint/typecheck/integration/security/contract/build liên quan, generated OpenAPI checks, mobile tests và web flow. Ghi rõ mock payment/chain event/receiver với dịch vụ thật. Không tạo commit/push/deploy hoặc sửa external provider khi chưa được chỉ định.

Danh sách task, file cần sửa, failure cases và bằng chứng cập nhật nằm trong kế hoạch ngày 04/11/2026. Task chỉ đánh dấu xong khi gate tương ứng chạy thực tế. Hướng dẫn vận hành ở HDSD và EmuKey/README; các thông tin xác thực thật chỉ ở môi trường, không vào tài liệu.
