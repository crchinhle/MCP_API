import { Link, Outlet, useLocation } from 'react-router-dom';
import { SiteHeader } from './SiteHeader';

function CustomerNavigation() {
  const location = useLocation();
  const items = [
    { label: 'Tổng quan', to: '/buyer', end: true },
    { label: 'Mua sắm', to: '/catalog' },
    { label: 'Đơn hàng', to: '/buyer/orders' },
    { label: 'Bản quyền', to: '/buyer/licenses' },
    { label: 'Hỗ trợ', to: '/buyer/support' },
  ];

  const isItemActive = (to: string, end?: boolean) => {
    if (end) return location.pathname === to;
    if (to === '/catalog') {
      return (
        location.pathname === '/catalog' ||
        location.pathname === '/products' ||
        location.pathname.startsWith('/buyer/products') ||
        location.pathname === '/buyer/checkout'
      );
    }
    return location.pathname.startsWith(to);
  };

  return (
    <nav aria-label="Điều hướng khách hàng" className="customer-navigation">
      {items.map((item) => {
        const active = isItemActive(item.to, item.end);
        return (
          <Link
            className={active ? 'active' : ''}
            aria-current={active ? 'page' : undefined}
            key={item.to}
            to={item.to}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

export function CustomerLayout() {
  return (
    <div className="page-shell customer-layout">
      <SiteHeader skipTargetId="customer-content" />
      <CustomerNavigation />
      <div id="customer-content" tabIndex={-1}><Outlet /></div>
    </div>
  );
}
