import { Link, Outlet, NavLink, useLocation } from 'react-router-dom';
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

  return (
    <nav aria-label="Điều hướng Customer" className="customer-navigation">
      {items.map((item) => item.to === '/catalog' && location.pathname.startsWith('/buyer/products') ? (
        <Link className="active" aria-current="page" key={item.to} to={item.to}>{item.label}</Link>
      ) : (
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
      <SiteHeader skipTargetId="customer-content" />
      <CustomerNavigation />
      <div id="customer-content" tabIndex={-1}><Outlet /></div>
    </div>
  );
}
