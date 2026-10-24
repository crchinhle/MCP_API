# Rà soát và thiết kế lại mô hình dữ liệu EmuKey

Ngày: 24/10/2026. Trạng thái: đã triển khai vào source; kiểm chứng trên PostgreSQL Docker tạm.

Tài liệu này ghi quyết định thiết kế và phạm vi backend cần đổi. Không phải schema thứ hai; `EmuKey/backend/database/schema.sql` tiếp tục là nguồn cấu trúc vật lý duy nhất. Schema/backend/mobile/seed và trang Database của sơ đồ đã được cập nhật. DB đang sử dụng và contract triển khai không bị thay đổi.

## 1. Yêu cầu đã chốt

- Một Provider chỉ có một tài khoản. Không thêm doanh nghiệp, thành viên hay phân quyền nội bộ Provider.
- License không chuyển tài khoản sở hữu.
- Gia hạn chỉ kéo dài thời hạn của đúng gói/version đang dùng; không nâng/hạ gói, không thay quyền hoặc giới hạn thiết bị.
- Mobile cần nhận push khi chạy nền/đóng ứng dụng; một tài khoản được có nhiều thiết bị nhận push.
- Ưu tiên mô hình hợp lý, trách nhiệm rõ và dữ liệu nhất quán; không tối thiểu hóa số bảng bằng mọi giá.
- Backend được phép thiết kế lại cùng DB. Những giới hạn của code hiện tại không phải lý do duy nhất để giữ dữ liệu.

## 2. Kết quả kiểm tra hiện trạng

Schema có 18 bảng. Lần đối chiếu trong cuộc trao đổi ghi nhận 50 FK và 31 cặp quan hệ đang được vẽ. Các đường đang vẽ có cơ sở trong SQL, nhưng sơ đồ đã gộp vai trò và lược bỏ một số quan hệ; không thể coi nó là bản mô tả đầy đủ mọi FK.

Các bằng chứng chính:

| Nguồn | Quan sát |
| --- | --- |
| `identity-access/identity.repository.ts` | Tạo lời mời chỉ ghi email, hash token, người mời và hạn dùng; tên/tổ chức được nhập lúc chấp nhận và lưu vào users. |
| `blockchain/infrastructure/chain-command.repository.ts` | Worker dùng locked_by/locked_at; chưa tìm thấy luồng blockchain sử dụng lease_owner/lease_expires_at. |
| `assistance-support/infrastructure/knowledge.repository.ts` | token_count được ghi bằng số từ tách theo khoảng trắng, không phải tokenizer; truy vấn tìm kiếm không dùng field này. |
| `operations/infrastructure/notification.repository.ts` | Nội dung và trạng thái delivery cùng nằm trong notifications; list không lọc IN_APP; claim chỉ lấy một push token mới nhất. |
| Cùng repository thông báo | Upsert token không đổi user_id khi token đã tồn tại; cần chính sách rõ khi đổi tài khoản trên thiết bị. |
| `mobile/src/infrastructure/api/client.ts` | Có hàm đăng ký/hủy token; tìm kiếm source chưa thấy caller nối luồng đăng ký push thực tế. Cần kiểm tra end-to-end khi triển khai. |
| `commerce-payment/infrastructure/commerce.repository.ts` | Gia hạn kiểm tra đúng customer, plan, product, provider; đồng thời đang yêu cầu plan/product PUBLISHED. |
| `schema.sql` | Nhiều field không xuất hiện trong TypeScript được dùng bởi generated columns, CHECK và trigger. Không được kết luận là dư chỉ bằng tìm kiếm code. |

Đây là kiểm tra tĩnh schema/source/sơ đồ; chưa phải kiểm thử lỗi runtime hoặc đo tải. Các lỗi hành vi nêu trên phải có regression test trước khi sửa.

## 3. Các phương án và lựa chọn

1. Chỉ dọn field không dùng: ít rủi ro, nhưng không giải quyết thông báo đa thiết bị và quan hệ bị trộn vai trò.
2. **Tái cấu trúc có chọn lọc (đề xuất):** bỏ dữ liệu không có trách nhiệm, giảm FK thật sự lặp, sửa ownership và notification delivery; giữ bằng chứng thanh toán/blockchain cùng các ràng buộc chống sai dữ liệu.
3. Chuẩn hóa triệt để mọi dữ liệu suy ra được: giảm cột nhưng tăng JOIN, trigger kiểm tra xuyên bảng và chi phí bảo trì. Không chọn chỉ để có ERD ít đường hơn.

Đích đề xuất là 19 bảng: giữ 18 khái niệm hiện có và thêm `notification_deliveries`. Số field giảm ở nhiều bảng nhưng chưa chốt tổng số trước khi xác định đầy đủ ràng buộc thay thế. Không cam kết giảm số bảng hoặc mọi loại quan hệ.

## 4. Quyết định cho từng bảng

| Bảng | Quyết định | Trách nhiệm và thay đổi |
| --- | --- | --- |
| users | Giữ | Danh tính, xác thực và hồ sơ; Provider là user. Giữ session_version, failed_login_count, locked_until phục vụ bảo mật. |
| provider_invitations | Tinh gọn | Chỉ quản lý lời mời và kết quả chấp nhận. Bỏ display_name, organization_name. Hồ sơ chính thức nằm ở users. |
| products | Giữ | Nguồn sở hữu Provider của catalog; provider_user_id bắt buộc và không chuyển chủ. |
| plans | Tinh gọn | Thuộc product; loại provider_user_id và provider_role khỏi đích thiết kế, suy ra qua product. Giữ version, giá, quyền, commitment. |
| orders | Giữ snapshot | Ghi thỏa thuận tại lúc mua/gia hạn. Giữ customer, provider, product, plan để bảo vệ ownership và đối soát; không biến snapshot lịch sử thành JOIN dữ liệu hiện tại. |
| payment_attempts | Giữ riêng | Một đơn có nhiều lần khởi tạo thanh toán; reference, hạn dùng và trạng thái riêng. |
| payment_transactions | Giữ riêng | Sự kiện thực tế từ cổng thanh toán, kể cả không khớp, trùng, đến muộn. Không gộp với attempt hoặc order. |
| licenses | Giữ | Quyền đã cấp và projection hiện tại; giữ origin order, owner bất biến và plan/version bất biến. |
| license_devices | Giữ | Các thiết bị kích hoạt license. Không gộp với thiết bị nhận push: hai loại thiết bị có mục đích và danh tính khác nhau. |
| chain_commands | Tinh gọn | Ý định durable gửi blockchain, retry và bằng chứng transaction. Bỏ lease_owner/lease_expires_at đang không được dùng; giữ một cơ chế claim. |
| chain_events | Giữ | Bằng chứng quan sát on-chain, finality và reorg. Không gộp với command: ý định và kết quả quan sát có vòng đời khác nhau. |
| chain_indexer_checkpoints | Giữ | Vị trí quét từng chain/contract và quyền quét; vẫn cần dù block không có event. Không tạo FK giả chỉ để nối sơ đồ. |
| knowledge_documents | Tinh gọn ownership | Giữ metadata, version, trạng thái công bố. Bỏ provider_user_id ở đích thiết kế, lấy owner qua product. |
| knowledge_chunks | Tinh gọn | Giữ các đoạn tìm kiếm và thứ tự; bỏ token_count hiện tại. |
| conversations | Sửa tham chiếu | Giữ vòng đời hỗ trợ, khách, người tiếp nhận và version chống tranh chấp. Thay context_type/context_id bằng các FK ngữ cảnh có kiểu rõ. |
| messages | Giữ | Giữ nguồn AI, thứ tự và khóa chống gửi lặp. Bỏ read_at nếu không triển khai xác nhận đọc tin nhắn; hiện chưa thấy luồng ghi/đọc nghiệp vụ cho field này. |
| notifications | Tách trách nhiệm | Một nội dung cho một người nhận và event_key; giữ read_at, bỏ is_read lưu độc lập. Chuyển trạng thái gửi sang bảng deliveries. |
| mobile_push_tokens | Giữ, sửa vòng đời | Một tài khoản nhiều token; đăng ký, đổi token, logout, đổi tài khoản, vô hiệu token phải nhất quán. |
| notification_deliveries | Thêm | Một lần gửi logic theo notification + kênh + đích; retry, lease và kết quả riêng. |

## 5. Field và ràng buộc cần xử lý cụ thể

### 5.1. Danh tính và lời mời

- Giữ email, token_hash, invited_by_user_id, expires_at, sent_at, accepted_at, accepted_user_id và timestamps của lời mời.
- Giữ hai quan hệ riêng: người mời là System Admin; người nhận là Provider sau khi chấp nhận. accepted_user_id nullable trước lúc nhận, và UNIQUE khi đã nhận để một account không nhận nhiều lời mời độc lập.
- Bỏ tên/tổ chức trong lời mời: chúng không phải nguồn hồ sơ và luồng gửi email-only không cần chúng.
- provider_chain_address/provider_chain_namespace trong lời mời hiện còn là đường tương thích lúc nhận. Đích namespace-only bỏ cả hai khỏi lời mời và sinh namespace khi tạo user. Chỉ bỏ đường address cũ sau khi xác nhận không còn phụ thuộc contract cũ; không triển khai contract tự động.
- Không bỏ password_hash, session_version, khóa tạm thời hoặc trạng thái xác minh chỉ vì chúng không xuất hiện trên màn hình quản trị.

### 5.2. Catalog và dữ liệu suy ra

- Product là nguồn duy nhất xác định Provider trong catalog; plan và tài liệu JOIN qua product.
- Với plans, thay FK ghép có provider bằng product_id → products.id. Với orders/licenses, FK tới plan dùng `(plan_id, product_id, plan_commitment)`; provider được kiểm tra qua FK ghép `(product_id, provider_user_id)` → products.
- Khi đó orders/licenses vẫn có bằng chứng không thể tham chiếu plan khác product hoặc product khác Provider. Không chỉ bỏ FK rồi giao toàn bộ tính nhất quán cho controller.
- Product owner và plan.product_id phải bất biến sau khi có dữ liệu phụ thuộc. Kiểm thử SQL trực tiếp để không thể đổi chủ gián tiếp.
- Tài liệu dùng UNIQUE `(product_id, logical_document_key, version)` và một phiên bản current cho mỗi `(product_id, logical_document_key)`. Khóa công bố đồng thời chuyển sang cùng phạm vi này.
- Chọn duration_months làm dữ liệu gốc với tập giá trị hiện tại 1/12; billingCycle trên API được suy ra. Bỏ billing_cycle và billing_cycle_snapshot lưu độc lập khi serializer commitment vẫn tái tạo chính xác biểu diễn cũ. Không thay hash/ABI do đổi cách lưu SQL.

### 5.3. Thanh toán, snapshot và gia hạn

- Giữ tên, giá, thời hạn, quyền, commitment và nội dung điều khoản tại lúc đặt hàng. Dữ liệu snapshot là lịch sử, không phải dư thừa vô ích.
- Giữ payment_due_at và ipn_accept_until: hạn thao tác của người mua khác hạn chấp nhận callback đến trễ.
- Giữ khóa idempotency, event_id, liên kết transaction trùng và bằng chứng rà soát; xóa chúng có thể cấp license nhiều lần.
- Một origin_order tạo tối đa một license; một license có nhiều renewal orders. Hai quan hệ này cùng tồn tại và phải được đặt tên trên sơ đồ.
- Gia hạn lấy plan_id từ license do server đọc; client không được chọn plan khác. Giữ nguyên customer, product, Provider, plan/version, commitment và quyền.
- Đề xuất cho phép gia hạn đúng version đã mua dù version đó ngừng bán mới, nếu Provider/account còn được phép hoạt động và license không bị thu hồi. Đây là thay đổi hành vi cần duyệt trong phương án, không suy ra rằng quy tắc hiện tại đã cho phép.
- Giá gia hạn dùng giá của version bất biến đã mua; đơn gia hạn vẫn snapshot giá và điều khoản lúc tạo. Không tự động chuyển khách sang version mới có giá khác.
- Gia hạn license còn hạn cộng tiếp vào hạn cũ; đã hết hạn tính từ thời điểm hiệu lực theo domain policy hiện có. Test phải giữ đúng quy tắc thời gian, không thay ngầm khi dọn schema.

### 5.4. Blockchain

- Giữ tách command/event/checkpoint và các trạng thái phân biệt chưa gửi, đã gửi không rõ kết quả, xác nhận, lỗi và reorg.
- Bỏ cặp lease không dùng của commands. locked_by/locked_at vẫn cần timeout và kiểm tra đúng worker sở hữu khi kết thúc.
- Giữ signed_transaction, nonce, transaction_hash: mất chúng có thể khiến retry phát giao dịch khác thay vì khôi phục giao dịch đã gửi.
- Giữ các con trỏ basis, confirmation, last_applied và pending rotation trong đợt này. Chúng có ý nghĩa khác nhau; chỉ bỏ khi có phép suy ra duy nhất và kiểm thử replay/reorg chứng minh tương đương.
- Giữ active_device_count trong transaction với bảng thiết bị nếu dùng để khóa và kiểm tra giới hạn. Không tính COUNT ở ngoài transaction rồi cấp thiết bị.
- Có thể bỏ FK trực tiếp tới users ở chain_commands/chain_events khi FK ghép tới license vẫn chứng minh đúng provider. Cột provider có thể vẫn giữ để ràng buộc chain subject, không bắt buộc xóa cùng FK.
- Generated fields phục vụ chứng cứ xác nhận và matching thanh toán được giữ cho đến khi có thiết kế thay thế tương đương. Chưa thấy TypeScript dùng không đồng nghĩa DB không dùng.

### 5.5. Ngữ cảnh hỗ trợ

- Thay context_id đa nghĩa bằng product_id, plan_id, order_id, license_id nullable; tối đa một field khác NULL. Tất cả NULL nghĩa là GENERAL.
- Mỗi field có FK thật. Ngữ cảnh order/license còn phải kiểm tra thuộc đúng customer; có thể dùng FK ghép cùng customer_user_id để bảo vệ tại DB.
- API có thể tiếp tục nhận/trả contextType/contextId; repository ánh xạ sang FK có kiểu. Không để thay đổi lưu trữ kéo theo UI mới không cần thiết.
- Đây là trường hợp cố ý tăng field/quan hệ để ngăn tham chiếu mồ côi. Lợi ích toàn vẹn dữ liệu lớn hơn lợi ích ERD ít đường.
- Giữ messages.sources như snapshot trích dẫn AI có cấu trúc; không biến mọi tham chiếu trong JSON thành FK bắt buộc làm mất lịch sử câu trả lời.

### 5.6. Thông báo và nhiều thiết bị

`notifications` giữ: id, user_id, event_key, type, title, content, data, inbox_visible, read_at, created_at, updated_at. UNIQUE `(user_id, event_key)`. inbox_visible phân biệt thông báo được xem trong inbox với sự kiện chỉ gửi email; không đưa nội dung riêng của email vào inbox ngoài ý muốn.

`notification_deliveries` giữ: id, notification_id, channel, push_token_id nullable, destination_key, token_generation nullable, delivery_status, attempt_count, next_attempt_at, lease_owner, lease_expires_at, last_error, sent_at, created_at, updated_at. UNIQUE `(notification_id, channel, destination_key)`; channel chỉ EMAIL/PUSH. EMAIL dùng địa chỉ nhận được snapshot; PUSH dùng định danh bản đăng ký token. Không lưu token thô trong log/error.

- Tạo notification và deliveries trong cùng transaction với sự kiện nghiệp vụ. Một push delivery cho mỗi đăng ký thiết bị đang active; inbox chỉ có một bản nội dung.
- read_at là nguồn trạng thái đọc; API vẫn trả isRead bằng biểu thức `read_at IS NOT NULL`.
- Trạng thái gửi riêng cho từng đích. Thiết bị A thành công, B lỗi thì retry B, không retry A.
- Thêm generation cho đăng ký token, tăng khi token được chuyển owner hoặc vô hiệu/đăng ký lại. Worker chỉ gửi khi user, status và generation còn khớp; hủy delivery cũ nếu khác.
- Logout vô hiệu đăng ký; chuyển tài khoản cập nhật owner theo phiên đăng nhập mới và hủy deliveries chưa gửi của owner cũ. Không phát lại thông báo cũ cho thiết bị đăng ký sau sự kiện.
- Trường hợp tài khoản đổi ngay sau khi worker kiểm tra vẫn có cửa sổ race với dịch vụ push. Payload chỉ chứa thông tin tối thiểu, không chứa nội dung nhạy cảm; app tải chi tiết qua API được kiểm tra quyền.
- Không có thiết bị active thì không tạo push delivery; notification vẫn tồn tại trong inbox. Đây không phải lỗi cần retry vô hạn.
- Claim nguyên tử, lease có hạn và kiểm tra lease owner trước cập nhật kết quả. Retry độc lập theo đích. Không hứa exactly-once bên ngoài DB; app deduplicate theo notification id khi cần.
- Chỉ chấp nhận token thuộc provider có adapter thật; hiện cần xử lý sự lệch giữa DTO nhận FCM/EXPO và adapter delivery cấu hình FCM/fake. Việc chọn native FCM hay Expo gateway phải kiểm chứng với cấu hình mobile trước khi viết integration.
- Email xác thực/reset mật khẩu đang có luồng riêng không bị tự động chuyển vào notifications. Không đưa mật khẩu, reset token hoặc activation key vào data.

## 6. Sơ đồ cần chỉnh khi triển khai

- Vẽ đúng mô hình đã được SQL kiểm chứng; giữ phong cách bảng và nhãn không viền của người dùng.
- Khôi phục orders → users với tên vai trò customer/provider.
- Phân biệt inviter/accepted provider, customer/assigned support, origin order/renewal order. Không gộp chỉ vì cùng nối hai bảng.
- Thể hiện optional: người nhận lời mời trước acceptance, reviewer trước review, người hỗ trợ trước claim, sender đối với AI, license trước fulfillment.
- Từ một order mua mới có 0..1 license; mỗi license có đúng 1 origin order. Mỗi license có 0..N renewal orders; renewal order trỏ đúng 1 license.
- Phân biệt sơ đồ nghiệp vụ với toàn bộ constraint vật lý: có thể bỏ các đường chứng cứ kỹ thuật khỏi bản tổng quan, nhưng phải ghi rõ phạm vi và không gọi đó là toàn bộ FK.
- Checkpoint độc lập là hợp lý. Không thêm liên kết chỉ để bảng không đứng một mình.

## 7. Chia triển khai thành các phần có thể kiểm chứng

Mỗi phần gồm regression test, sửa schema/backend, seed/verify và tài liệu tương ứng; không triển khai bằng cách sửa SQL trước rồi để backend lỗi.

| Thứ tự | Phần việc và owner hiện có | Kiểm chứng bắt buộc |
| --- | --- | --- |
| 1 | identity.repository, knowledge.repository, chain-command.repository, schema.sql: bỏ field không dùng | Lời mời single-use, tạo/tìm tài liệu, worker claim và timeout; không đổi ABI/commitment. |
| 2 | catalog repositories, commerce.repository, knowledge.repository, schema.sql: ownership và duration | SQL từ chối plan/product/provider lệch; commitment trước/sau giống nhau; publish đồng thời không có hai current versions. |
| 3 | commerce service/domain/repository và license guards | Không chuyển license; không đổi plan khi renew; hai request renew đồng thời; IPN trùng/đến muộn; chỉ gia hạn một lần. |
| 4 | operations repository/service/processor, mobile registration lifecycle | Hai thiết bị; lỗi một đích; đổi tài khoản; logout; token invalid; worker crash; không có token; inbox không lặp theo kênh. |
| 5 | assistance-support repository, knowledge search | FK context, đúng customer, tối đa một context, chống truy cập order/license người khác; vẫn hỗ trợ GENERAL. |
| 6 | schema verifier, fixtures, KLTN.drawio và hướng dẫn | Khởi tạo DB trống + seed + chạy lại trên Docker tạm; toàn bộ invariant tests; đối chiếu diagram với SQL sau cùng. |

Tận dụng các test hiện có trong `tests/emukey/backend/integration/{identity,catalog,commerce,blockchain,database,operations}` và unit tests notification/knowledge/catalog/chain-command. Không thêm framework/dependency mới cho việc này. Các test cần mới thuộc cùng nhóm nghiệp vụ hiện có.

Các bất biến tuyệt đối phải giữ: không trả tiền hai lần cho cùng hiệu lực; không cấp/gia hạn trùng; không đọc dữ liệu khác khách/Provider; không coi transaction chưa final là quyền chắc chắn; không làm mất khả năng replay/reorg; không vượt giới hạn thiết bị do request đồng thời.

## 8. Phạm vi triển khai và dữ liệu hiện có

- schema.sql vẫn là initializer cho DB mới. Chạy file đó trên DB đang có dữ liệu sẽ xóa public; việc duyệt thiết kế không đồng nghĩa cho phép reset DB thật.
- Kiểm thử triển khai trên container tạm trước. Nếu cần giữ dữ liệu thật, phải có phương án chuyển dữ liệu riêng được kiểm chứng; không coi sửa initializer là migration.
- Không deploy contract, commit hoặc push trong phạm vi thiết kế này.
- Người dùng đã duyệt triển khai phương án, gồm gia hạn version ngừng bán mới và tách notification/delivery.
- Tổng số field/FK và hiệu năng chỉ được báo cáo chính xác sau khi có schema đích chạy được; không lấy số dòng SQL hoặc số đường vẽ làm bằng chứng chất lượng.


## 9. Kết quả triển khai

- DB đích: 19 bảng, 344 cột, 52 FK. Trước đó: 18 bảng, 345 cột, 50 FK. Có 47 đường quan hệ logic trong sơ đồ; các FK kỹ thuật cùng ý nghĩa được gom nhưng vai trò người dùng và mua/gia hạn được tách.
- Đã bỏ 6 field không dùng, ownership lặp ở plans/knowledge_documents, billing cycle lưu độc lập và trạng thái đọc boolean độc lập. Các field delivery chuyển sang bảng có trách nhiệm riêng; FK context có kiểu thay tham chiếu đa nghĩa.
- Giá/quyền của plan đã công bố được bảo vệ tại DB; đổi quyền phải tạo version. Gia hạn version đã ngừng bán không đổi version hoặc chủ sở hữu.
- Giữ hai field blockchain tương thích trong provider_invitations vì contract cũ vẫn được hỗ trợ; namespace-only cleanup phụ thuộc việc loại bỏ registry cũ, không thuộc lần triển khai contract này.
- Mobile hiện là bản build Android và đăng ký native FCM bằng expo-notifications đã cài. EXPO bị từ chối rõ ràng; không gửi APNs token tới FCM. Plugin notifications được khai báo, logout hủy token trước khi xóa phiên, listener theo dõi token rotation.
- Push thực tế cần Firebase native configuration của bản Android và credentials backend. Không có thiết bị/cấu hình phát hành trong phiên nên chưa xác nhận nhận push thật khi app đóng. Backend nhiều thiết bị được kiểm thử với PostgreSQL thật; mobile lifecycle được kiểm thử bằng Jest.
- Tham chiếu SDK: https://docs.expo.dev/versions/latest/sdk/notifications/ ; chữ ký getDevicePushTokenAsync/addPushTokenListener được đối chiếu trực tiếp với package expo-notifications ~57.0.23 đang cài.
- Phần provider namespace/contract hiện hành được giữ, không deploy contract. Schema initializer chỉ chạy trên container tạm; áp dụng vào DB hiện dùng là một bước triển khai riêng.

### Kiểm chứng cuối phiên

- Toàn bộ backend: 46 file / 361 test đạt. Sau sửa đường dẫn tài liệu theo sản phẩm: 13 test knowledge/assistance đạt, gồm test hồi quy mới (đã xác nhận thất bại trước sửa).
- Mobile: 20 test đạt. Backend/mobile typecheck và lint các file thay đổi đạt; backend build đạt.
- Docker PostgreSQL tạm: initializer và seed chạy thành công; xác nhận 19 bảng, 344 cột, 50 sản phẩm mẫu; container tạm đã được dọn.
- Draw.io: 94 nhãn hệ số, 13 kiểm tra di chuyển, không chồng nhãn với bảng hoặc với nhãn khác; các trang ngoài DB được giữ nguyên.
- git diff --check đạt ở cả hai repository. DB thật và contract triển khai không thay đổi.
