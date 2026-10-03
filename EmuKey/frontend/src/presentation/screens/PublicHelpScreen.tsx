import { Button, Empty, Input } from 'antd';
import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { SiteHeader } from '../components/SiteHeader';
import { useOptionalAuth } from '../../application/auth/authContext';
import { roleHomePath } from '../../domain/workspace';

const helpSections = [
  { title: '1. Chọn sản phẩm và gói', content: 'Mở danh mục, xem giá, thời hạn và số thiết bị. Dùng tính năng so sánh để đối chiếu từ hai đến bốn gói trước khi quyết định.' },
  { title: '2. Xác nhận đơn hàng và thanh toán', content: 'Đăng nhập, đọc điều khoản của đơn hàng và xác nhận trước khi đến cổng SePay. Sau thanh toán, quay về EmuKey để theo dõi kết quả. Nếu giao dịch chưa rõ kết quả, kiểm tra trạng thái đơn trước khi thanh toán lại.' },
  { title: '3. Nhận mã và kích hoạt phần mềm', content: 'Khi bản quyền sẵn sàng, nhận mã bản quyền và lưu ở nơi an toàn: mã chỉ được hiển thị một lần. Nhập mã trong phần mềm trên thiết bị cần sử dụng. Không chia sẻ mã trong hội thoại hỗ trợ.' },
  { title: '4. Quản lý và gia hạn', content: 'Vào Bản quyền & thiết bị, chọn bản quyền rồi bấm Gia hạn. Kiểm tra giá, thời hạn và điều khoản trước khi thanh toán. Không cần nhập mã; mã bản quyền và thiết bị hiện tại được giữ nguyên. Nếu đã có đơn gia hạn đang chờ, hãy tiếp tục đơn đó.' },
  { title: '5. Xác minh công khai', content: 'Dùng mã tra cứu công khai tại trang Xác minh để kiểm tra trạng thái trên blockchain. Đây không phải mã bản quyền dùng trong phần mềm và không dùng để đăng nhập.' },
] as const;

export function PublicHelpScreen() {
  const navigate = useNavigate();
  const auth = useOptionalAuth();
  const [query, setQuery] = useState('');
  const filteredSections = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase('vi-VN');
    if (!normalized) return helpSections;
    return helpSections.filter((section) => `${section.title} ${section.content}`.toLocaleLowerCase('vi-VN').includes(normalized));
  }, [query]);


  return (
    <div className="page-shell">
      <SiteHeader />
      <main className="public-help-content">
        <section aria-labelledby="public-help-title" className="public-help-card">
          <h1 id="public-help-title">Hướng dẫn sử dụng EmuKey</h1>
          <p>Từ chọn phần mềm đến quản lý bản quyền, bạn có thể theo dõi từng bước trong tài khoản của mình.</p>
          <Input.Search
            allowClear
            aria-label="Tìm trong hướng dẫn"
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Tìm trong hướng dẫn..."
            style={{ marginBottom: 24 }}
            value={query}
          />
          {filteredSections.length === 0 ? <Empty description="Không tìm thấy nội dung phù hợp" /> : filteredSections.map((section) => (
            <section key={section.title} aria-labelledby={`help-${section.title.slice(0, 1)}`}>
              <h2>{section.title}</h2>
              <p>{section.content}</p>
            </section>
          ))}
          <h2>Cần trợ giúp thêm?</h2>
          <p>Nếu mất mã, gặp lỗi thanh toán hoặc kích hoạt, hãy gửi yêu cầu hỗ trợ kèm mã đơn hàng hoặc mã tra cứu công khai. Không gửi mã bản quyền bí mật.</p>
          <Button type="primary" onClick={() => void navigate(auth?.user ? auth.user.role === 'CUSTOMER' ? '/buyer/support' : roleHomePath(auth.user.role) : '/auth?redirect=/buyer/support')}>
            {auth?.user ? 'Mở khu vực hỗ trợ' : 'Đăng nhập để được hỗ trợ'}
          </Button>
          <Link className="public-help-close" to="/products">Khám phá sản phẩm</Link>
        </section>
      </main>
    </div>
  );
}
