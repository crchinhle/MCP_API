# Quy chuẩn giao diện dùng trong đợt audit

Nguồn triển khai: `EmuKey/frontend/src/presentation/theme.ts` và `styles.css`. Tiếp tục dùng Ant Design; không tạo thư viện control song song.

## Nhận diện và token

- Giữ wordmark Great Vibes, body IBM Plex Sans, chữ mã dùng IBM Plex Mono.
- Giữ primary xanh `#1a4dc7`, canvas `#f7f9fb`, surface trắng, text `#1c1c1a`, border `#e2e8f0`. Màu trạng thái lấy từ `colorPalette`, không thêm mã màu riêng trong từng màn.
- Body 16px; heading theo hierarchy của theme. Dùng PageHeader hiện có cho tiêu đề màn và semantic h1.
- Spacing dùng nhịp 4/8/12/16/24/32; border/radius hiện hữu, shadow tiết chế. Console ưu tiên đọc dữ liệu, không dùng bố cục hero của landing.

## Layout và tương tác

- Mỗi màn có tiêu đề, điều hướng active đúng và entry point tác vụ dễ tìm.
- Main có đích skip link duy nhất. Menu mobile là modal có tên, focus ban đầu, vòng Tab, Escape và trả focus.
- Catalog card chỉ các link/nút mới là vùng hành động. Ảnh lỗi chuyển artwork local; nội dung và nút vẫn dùng được.
- So sánh gói dùng grid có align-content start; không kéo giãn khoảng trắng theo chiều cao trang. Tablet/mobile xếp nội dung thành một cột khi cần.
- Bảng rộng cuộn trong vùng bảng; không che thao tác hoặc làm toàn trang tràn ngang.
- Loading/empty/error/retry và submitting/validation/success phải phân biệt; không báo 0 hoặc hoàn tất nếu chưa có dữ liệu.
- Giữ nhãn nghiệp vụ: mã bản quyền bí mật, mã tra cứu công khai, bàn giao cho nhà cung cấp; trạng thái thanh toán/cấp phép/blockchain đọc từ backend.

## Accessibility và bằng chứng

Mục tiêu WCAG 2.2 AA ở tiêu chí áp dụng. Kiểm tra keyboard, tên/label, focus, contrast, reflow/text scaling và reduced motion. Vùng chạm khoảng 44px cho tác vụ chính là mục tiêu UX nội bộ. Kiểm tra tự động không thay thế thao tác và review ảnh.

Ảnh thật theo desktop 1440×900, tablet 768×1024 và mobile 390×844. Ảnh giả lập API vẫn ghi CONTROLLED_FIXTURE; không dùng chúng để kết luận luồng sandbox đã chạy.

UI UX Pro Max được dùng để đối chiếu khả năng đọc và tính nhất quán, không thay font/màu/framework theo gợi ý mặc định.

## Các quyết định đã áp dụng

- StatusChip thay preset Tag cho trạng thái hồ sơ/tích hợp; màu success/warning/neutral dùng token đang có.
- Nội dung bảng rỗng và chữ phân cách khoảng thời gian dùng muted, không nhận màu disabled.
- Form tích hợp dùng section-card có padding 20px, thống nhất form hồ sơ.
- Chấm carousel giữ hình 12px nhưng vùng bấm 32px; nhóm cho phép xuống hàng.
- Bàn giao không render bảng/phân trang ở trang đầu rỗng; loading và lỗi API có cách hiển thị riêng, giữ nút tải lại.
