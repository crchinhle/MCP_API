import { Outlet, NavLink } from 'react-router-dom';
import { SiteHeader } from './SiteHeader';

function CustomerNavigation() {
  const items = [
    { label: 'Tổng quan', to: '/buyer', end: true },
    { label: 'Mua sắm', to: '/catalog' },
    { label: 'Đơn hàng', to: '/buyer/orders' },
    { label: 'Bản quyền & thiết bị', to: '/buyer/licenses' },
    { label: 'Hỗ trợ', to: '/buyer/support' },
  ];

  return (
    <nav aria-label="Điều hướng Customer" className="customer-navigation">
      {items.map((item) => (
        <NavLink
          className={({ isActive }) => isActive ? 'active' : ''}
          {...(item.end ? { end: true } : {})}
          key={item.to}
          to={item.to}
        >
          {item.label}
        </NavLink>
      ))}
    </nav>
  );
}

export function CustomerLayout() {
  return (
    <div className="page-shell customer-layout">
      <SiteHeader />
      <CustomerNavigation />
      <Outlet />
    </div>
  );
}
