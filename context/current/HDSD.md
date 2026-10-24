# Import dữ liệu demo

> Từ 22/10/2026, `EmuKey/backend/database/schema.sql` là file khởi tạo duy nhất, khai báo thẳng cấu trúc cuối cùng. `db:initialize` (và alias `db:reset`) mặc định xóa schema `public` cùng các đối tượng phụ thuộc rồi tạo lại; không DROP DATABASE. Dừng API/worker và xác nhận đúng database, bản sao phục hồi trước khi chạy. Không còn lệnh `db:migrate`; file này không dùng để nâng cấp tại chỗ và giữ dữ liệu cũ.

> Seed demo cũng nằm ở cuối `schema.sql`: từ thư mục `EmuKey`, chạy `corepack pnpm --dir backend db:seed:demo` sau khi build backend, với `NODE_ENV=development`. Database mới có thể dùng `corepack pnpm --dir backend db:initialize --demo` để tạo cấu trúc và seed trong cùng transaction. Dữ liệu gồm 50 sản phẩm, 30 gói và 30 tài khoản demo; seed không tự chạy khi khởi động API.

> Phạm vi cập nhật 20/10/2026: gỡ nhật ký hoạt động người dùng (`OPS-02`), schema còn 18 bảng và danh mục còn 34 capability. Giữ lịch sử nghiệp vụ và log lỗi kỹ thuật tối thiểu; không có màn hình/API audit tổng quát. Các kết quả có ngày của phiên bản cũ là dữ liệu lịch sử.

Chạy từ thư mục `D:\TLHT\KLTN\UY\EmuKey`:

```powershell
# Chỉ kiểm tra cấu trúc seed và 50 URL ảnh, không ghi database
node seed-demo-data.mjs --validate-only

# Import seed vào DATABASE_URL trong backend/.env
$env:NODE_ENV = 'development'
node --env-file-if-exists=backend/.env seed-demo-data.mjs --yes --skip-image-check
```

# Chạy API

## Chính sách thời gian SePay Sandbox

Chỉ cho môi trường thử nghiệm: đặt `SEPAY_SANDBOX_RECEIPT_TIMING=true` và
`SEPAY_SANDBOX_CLOCK_OFFSET_SECONDS=0` trong `backend/.env`, với `SEPAY_ENV=sandbox`
và `NODE_ENV` khác `production`. Production phải giữ receipt timing là `false`.
Chính sách này dùng thời điểm PostgreSQL nhận webhook đã xác thực để xét hạn;
không dùng giờ Windows, không bù giây cố định, không sửa thời gian gốc trong chứng từ.
Webhook đến sau hạn vẫn bị từ chối, kể cả Sandbox. Đây là chính sách EmuKey,
không phải cam kết thời gian của SePay.

Schema cuối cùng đã chứa chính sách Sandbox; lệnh đối soát không sửa schema.
Chạy `corepack pnpm build` từ `EmuKey/backend` trước khi dùng CLI.
Đối soát **một giao dịch Sandbox đã xác thực** bị lỗi giờ: xem trước rồi mới áp dụng.
Thay các giá trị mẫu bằng mã giao dịch nội bộ và tài khoản quản trị đang ACTIVE:

```powershell
corepack pnpm reconcile:payment:sandbox --confirm-sandbox --transaction <transaction-uuid> --admin <admin-uuid> --reason "Sandbox clock drift reconciliation"
# Sau khi kiểm tra chứng từ và receipt_within_window=true, thêm --apply vào lệnh trên.
```

Đối soát giữ nguyên payload, thời gian gốc, mã sự kiện và phân loại `UNMATCHED`;
ghi `RESOLVED / ACCEPT_AND_FULFILL` cùng người thực hiện. Chỉ nhận
`PAYMENT_OUTSIDE_ACCEPTED_WINDOW` trên đơn còn `WAITING_PAYMENT`, đúng số tiền,
đúng attempt và thời điểm nhận ban đầu nằm trong hạn. Gọi lại không cấp trùng.
Đơn khách chủ động hủy/hết hạn hoặc sai số tiền phải xử lý riêng, không ép thành đã thanh toán.
Sau chấp nhận thanh toán, worker/blockchain vẫn phải hoàn tất để bản quyền ACTIVE.

Nguồn: [SePay IPN](https://developer.sepay.vn/vi/cong-thanh-toan/IPN),
[PostgreSQL statement timestamp](https://www.postgresql.org/docs/15/functions-datetime.html#FUNCTIONS-DATETIME-CURRENT).

## Điều khoản dịch vụ theo từng đơn

- Khi tạo đơn, hệ thống snapshot phiên bản, SHA-256 và nội dung Điều khoản dịch vụ trong PostgreSQL. Người mua chỉ có thể chấp thuận đúng snapshot đã hiển thị; thay đổi tài liệu hiện tại không làm thay đổi đơn cũ.
- Schema cuối cùng khai báo trực tiếp các cột `orders.service_terms_version_snapshot`, `orders.service_terms_hash_snapshot`, `orders.service_terms_content_snapshot` và trigger `trg_orders_terms_snapshot`. Không có bước migration trong file khởi tạo; không dùng lệnh khởi tạo để nâng cấp database cần giữ dữ liệu.

- Đơn legacy không có bằng chứng snapshot lịch sử sẽ không được gán ngược nội dung hiện tại; cần tạo snapshot hợp lệ theo luồng đơn mới trước khi chấp thuận.
- Nếu tải điều khoản thất bại, nút chấp thuận bị khóa và nút **Thử lại** chỉ tải lại điều khoản của cùng order, không tạo order mới.

## Tự hủy đơn sau 30 phút

- Thời hạn tính từ lúc tạo đơn, không gia hạn lại khi mở cổng thanh toán.
- Worker kiểm tra mỗi 15 giây và tự chuyển đơn chưa chấp nhận thanh toán sang `CANCELLED`. API đọc đơn cũng đồng bộ các đơn quá hạn của khách.
- Đơn đã chấp nhận thanh toán, kể cả đang chờ blockchain, không bị hủy.
- Đơn tự hủy có dấu `auto_cancelled`; vẫn chấp nhận webhook hợp lệ của giao dịch thực hiện trước hạn, trong cửa sổ nhận IPN đã cấu hình. Đơn khách chủ động hủy không được tự khôi phục. Thời điểm hủy được giữ lại kể cả khi sau đó chấp nhận thanh toán.
- Sandbox dùng `SANDBOX_RECEIPT` vẫn lấy thời điểm backend nhận làm căn cứ; không dùng đồng hồ Sandbox lệch để tự kết luận giao dịch đúng hạn.
- Schema cuối cùng đã bao gồm tự hủy đơn; không cần chạy thêm migration sau khởi tạo.
- Cần chạy cả `api` và `worker` để tự hủy ngay cả khi người dùng không mở trang.

Tác vụ nền dùng [BullMQ Job Scheduler](https://docs.bullmq.io/guide/job-schedulers); chu kỳ quét không phải cam kết thực thi chính xác từng giây khi worker/Redis mất kết nối.

- Sau khi quay về từ cổng thanh toán trên mobile, ứng dụng chỉ thông báo đang kiểm tra và đọc lại trạng thái đơn từ backend; redirect không được coi là bằng chứng thanh toán thành công. Nếu cần, mở lại đơn để xem trạng thái cập nhật.
- Bộ lọc danh mục được giữ trong URL; dùng nút Back/Forward hoặc tải lại trang vẫn giữ từ khóa tìm kiếm.
- Trạng thái blockchain hiển thị rõ đang chờ finality, đã xác nhận, dữ liệu stale hoặc reorg; không coi trạng thái tạm thời là license đã sẵn sàng.


- Vào **Hồ sơ tài khoản → Đổi mật khẩu** để xác minh mật khẩu hiện tại và đặt mật khẩu mới. Sau khi đổi thành công, phiên hiện tại được đăng xuất để đăng nhập lại bằng mật khẩu mới.
- Trong **Hội thoại hỗ trợ**, có thể hỏi AI, gửi tin nhắn, hoặc bấm **Chuyển cho nhân viên**. Yêu cầu chuyển hỗ trợ ghi rõ lý do; retry giữ nguyên intent để không tạo tin trùng. Nhân viên có thể mở bản xem trước hàng đợi, nhận xử lý, trả lại hàng đợi hoặc hoàn tất hội thoại.
- Mobile hiển thị số thông báo chưa đọc trên nút **Thông báo** và tự cập nhật định kỳ. Màn hình đăng nhập có **Quên mật khẩu**; hệ thống luôn dùng thông báo chung, không xác nhận email có tồn tại hay không.
- Trang **Hướng dẫn sử dụng** có ô tìm kiếm cục bộ. Đường dẫn không tồn tại hiển thị trang 404; lỗi quyền hiển thị trang 403 riêng, không đẩy người dùng đã đăng nhập về màn hình login.
- Trang chi tiết sản phẩm mặc định chọn gói public đầu tiên, không giả định số thiết bị cố định. Màn so sánh hiển thị từng giá trị entitlement (kể cả `Không`/`0`) và có nút mua riêng cho từng cột.


- Provider có thể xem chi tiết tài liệu và các chunk theo đúng product ownership; hệ thống không trả storage key/private file path.
- Khi publish, gửi phiên bản hiện tại kỳ vọng. Nếu provider khác đã publish phiên bản mới, thao tác bị từ chối do conflict thay vì âm thầm ghi đè.
- Các câu hỏi không có nguồn phù hợp đi theo fallback an toàn; không mở rộng scope sang tài liệu private của customer/provider khác.


- Chu kỳ **Hàng tháng** tự đặt thời hạn 1 tháng; **Hàng năm** tự đặt 12 tháng. Không nhập duration trái với billing cycle.
- Xóa entitlements nâng cao sẽ gửi object rỗng `{}`, không giữ lại quyền lợi cũ ngoài ý muốn.
- Gói đã công bố không sửa trực tiếp; hãy tạo bản nháp/phiên bản mới theo quy trình publish. Khi đóng form có thay đổi chưa lưu, hệ thống hỏi xác nhận trước khi bỏ dữ liệu.

 Không cần nhập mã: backend xác nhận quyền sở hữu bằng tài khoản đăng nhập.
- **Sở hữu License** xác định tài khoản/customer nào được xem và quản lý License (thiết bị, gia hạn, thu hồi, xoay/khôi phục key, billing và hỗ trợ). **Activation key** là thông tin bearer do quản trị viên doanh nghiệp cung cấp để cho phép một thiết bị kích hoạt License; người nhập key không cần là người mua hoặc `customer_id` của License và không nhận quyền quản lý. **Device identity/proof** ràng buộc thiết bị đã kích hoạt với License.
- Giao diện gọi activation key là **Mã bản quyền** (mã bí mật để nhập trong phần mềm); **Mã tra cứu** là mã công khai để xem trạng thái, không dùng để kích hoạt. Luồng phần mềm chỉ cần mã bản quyền, challenge và device proof; không yêu cầu đăng nhập tài khoản purchaser.
- Hiển thị giá hiện tại, số tháng và ngày hết hạn dự kiến trước khi tạo đơn. Nếu đã có đơn gia hạn còn hạn thanh toán hoặc đã thanh toán đang xử lý, tiếp tục đơn đó thay vì tạo trùng.
- Giữ nguyên bản quyền, mã bản quyền và thiết bị; không cấp mã mới khi gia hạn. Chỉ gia hạn gói đang gắn với bản quyền; không tự chuyển sang gói khác hoặc mở lại bản quyền bị tạm ngưng.
- Hạn mới = mốc muộn hơn giữa hạn hiện tại và thời điểm thanh toán đã xác thực, cộng thời hạn gói theo tháng lịch UTC. Nếu ngày không tồn tại trong tháng đích thì lấy ngày cuối tháng (ví dụ 31/01 + 1 tháng = 28/02 trong năm thường).
- Trang thanh toán theo dõi đúng lệnh `RENEW_LICENSE` của đơn gia hạn. Chỉ báo hoàn tất khi lệnh `CONFIRMED` và license đã phản ánh hạn mới, không dựa riêng vào trạng thái `ACTIVE` cũ.
- Giao dịch mất xác nhận hoặc cần xử lý lại không được tiếp tục hiển thị là gia hạn hoàn tất. Bản quyền bị tạm ngưng/thu hồi vẫn cần kiểm tra riêng; gia hạn không tự gỡ hạn chế.

## Lệnh chạy

```powershell
Set-Location D:\TLHT\KLTN\UY\EmuKey\backend
corepack pnpm start:api
docker compose up -d
& "C:\Program Files (x86)\cloudflared\cloudflared.exe" tunnel --url http://localhost:3000
```


## Công bố tài liệu tri thức

Nhà cung cấp vào **Tài liệu sản phẩm** tại `/provider/knowledge` để tải hướng dẫn PDF/TXT (tối đa 10 MB), chọn sản phẩm, xem nội dung và lọc theo sản phẩm hoặc trạng thái. Tải lại cùng tên cho cùng sản phẩm tạo phiên bản mới. Nhà cung cấp không tự duyệt tài liệu.

Quản trị viên vào **Duyệt tài liệu** tại `/system/console/knowledge`, đọc nội dung rồi chọn **Công bố**. Bản đã công bố vẫn được dùng trong khi bản mới chờ duyệt; bản cũ và bản chờ duyệt được hiển thị riêng. Khách hàng có bản quyền của sản phẩm và trợ lý AI chỉ sử dụng tài liệu đã công bố trong phạm vi sản phẩm đó.

Khi bấm **Công bố**, hệ thống kiểm tra phiên bản đang được sử dụng. Nếu phiên bản đã thay đổi do thao tác khác, màn hình hiển thị lỗi xung đột. Chọn **Tải lại danh sách**, xem lại phiên bản rồi chủ động công bố; hệ thống không tự ghi đè bằng thao tác thử lại.

## Giao diện nhà cung cấp

Menu chính gồm **Tổng quan**, **Sản phẩm & gói**, **Bản quyền**, **Thanh toán & đối soát** và **Tài liệu sản phẩm**. Bấm khối tên tài khoản ở cuối menu để mở hồ sơ, đổi mật khẩu hoặc đăng xuất. Trên điện thoại, mở **Điều hướng** để truy cập menu và hồ sơ.

Các liên kết từ Tổng quan mở danh sách với bộ lọc tương ứng. Chọn tên sản phẩm để xem các gói; chỉ sản phẩm và gói nháp mới có thao tác xóa, kèm xác nhận. Tên sản phẩm trong danh sách bản quyền mở phần chi tiết. Giao dịch đã giải quyết hoặc đóng được giữ trong lịch sử nhưng không còn tính vào số giao dịch cần kiểm tra.

## Điều khoản khi mua và gia hạn

Web và mobile gửi phiên bản và mã kiểm tra của đúng điều khoản đã hiển thị khi bạn xác nhận. Khi đổi đơn hoặc phiên bản điều khoản, bạn cần đọc và đồng ý lại.

Trên mobile, nếu tải điều khoản gia hạn thất bại, chọn **Tải lại điều khoản**. Thao tác này đọc lại điều khoản của đơn đã tạo, không tạo đơn gia hạn mới. Giá hiển thị sau khi tạo đơn là giá đã lưu trên đơn; nếu khác giá dự kiến, hãy xem lại trước khi đồng ý.

## Khôi phục mã từ email và xem thông báo

Liên kết khôi phục được kiểm tra trước khi mở đúng bản quyền. Nếu liên kết hết hạn, mở danh sách bản quyền để yêu cầu email mới. Nếu lỗi kết nối, chọn **Thử lại**. Mã xác nhận được xóa khỏi URL; tải lại trang trước khi gửi yêu cầu có thể cần mở lại liên kết email. Liên kết thu hồi thiết bị hoặc đổi mã không dùng cho form khôi phục; tiếp tục trong ứng dụng đã gửi yêu cầu.

Trong biểu tượng thông báo, chọn **Xem thêm thông báo** để tải trang tiếp theo từ backend; cursor được giới hạn và sắp xếp ổn định, không chỉ cắt mảng trên UI. Mobile cũng có **Tải thêm thông báo**, refresh và retry. Khi đánh dấu đã đọc thất bại, trạng thái không tự đổi và hiển thị lỗi để thử lại. Target hợp lệ điều hướng theo order/license/conversation ở màn hình tương ứng; target không còn quyền không được mở dữ liệu. Trên màn hình nhỏ của Provider/Support/System, mở menu vai trò để thấy biểu tượng thông báo. Nếu tạo hỗ trợ từ chi tiết đơn hàng thất bại, thông báo lỗi xuất hiện ngay trong chi tiết đơn; có thể bấm lại **Cần hỗ trợ về đơn này**.

## Trạng thái môi trường demo 02/10/2026

- Kết quả lịch sử 02/10/2026: Neon demo đã được nâng cấp snapshot điều khoản. Kiểm tra `corepack pnpm db:verify:terms` phải trả `REAL_VERIFIED`; không khởi tạo lại database cần giữ dữ liệu.
- Notification worker đã được đăng ký trong `WorkerModule`; cần cung cấp Redis reachable (biến hiện tại đang là `REDIS_URL=redis://127.0.0.1:6379`) trước khi chạy `corepack pnpm start:worker`.
- Chưa gọi là nghiệm thu thật nếu chưa có domain HTTPS/CORS/callback, hộp thư kiểm thử, Redis host, SePay sandbox callback, Gemini/Brevo thật và giao dịch Sepolia có receipt/finality/indexer. Mobile chưa được nghiệm thu trên thiết bị Android thật.

## Kiến trúc trạng thái thiết bị

Individual device state is operational data owned by PostgreSQL. Blockchain does not store device identity. Blockchain stores only an asynchronously synchronized aggregate active-device count. License lifecycle finality remains on-chain.

- Activate/revoke xác minh ownership, license ACTIVE/chưa hết hạn, activation commitment, challenge, EIP-191 proof, signer và binding generation; sau đó ghi `license_devices.ACTIVE` hoặc `REVOKED` ngay trong transaction PostgreSQL.
- License row được khóa khi tính quota. `active_device_count` lấy từ các row `ACTIVE`; `device_state_version` tăng đơn điệu trong cùng transaction. Retry không chờ blockchain và không cấp thêm quota.
- Backend enqueue command `SYNC_DEVICE_COUNT` bất đồng bộ. Payload chỉ gồm license id, active count, version, protocol version và command id. Worker retry lỗi; lỗi/reorg không rollback device state và không chặn entitlement.
- Entitlement cần license lifecycle chain-confirmed, còn hạn, và device `ACTIVE` trong PostgreSQL. Device không có finality blockchain riêng.
- Cấu trúc thiết bị PostgreSQL đã nằm trong schema cuối cùng. Contract có `syncActiveDeviceCount`; cần quy trình deploy riêng và cập nhật địa chỉ/ABI trước khi chạy relayer thật. Việc sửa file SQL không deploy contract.
