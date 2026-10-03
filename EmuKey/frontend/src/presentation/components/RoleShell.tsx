import { SettingOutlined } from '@ant-design/icons';
import { Button } from 'antd';
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useEffect, useRef, useState } from 'react';

import { roleSettingsPath, type RoleShellConfig } from '../../domain/workspace';
import { useOptionalAuth } from '../../application/auth/authContext';
import { NotificationCenter } from './NotificationCenter';
import { Brand } from './Brand';

export const buyerShell: RoleShellConfig = {
  role: 'CUSTOMER',
  account: 'buyer@demo.emukey.vn',
  items: [
    { label: 'Tổng quan', to: '/buyer', end: true },
    { label: 'Sản phẩm & gói', to: '/buyer/products' },
    { label: 'Đơn hàng & thanh toán', ariaLabel: 'Đơn hàng', to: '/buyer/orders' },
    { label: 'Bản quyền & thiết bị', to: '/buyer/licenses' },
    { label: 'Hỗ trợ & AI', to: '/buyer/support' },
  ],
};

export const providerShell: RoleShellConfig = {
  role: 'PROVIDER_ADMIN',
  account: 'admin@securedesk.vn',
  items: [
    { label: 'Tổng quan', to: '/provider', end: true },
    { label: 'Sản phẩm & gói', to: '/provider/catalog' },
    { label: 'Bản quyền', to: '/provider/licenses' },
    { label: 'Đơn hàng & vận hành', to: '/provider/operations' },
    { label: 'Kho tri thức AI', to: '/provider/knowledge' },
    { label: 'Hồ sơ', to: '/provider/profile' },
  ],
};

export const supportShell: RoleShellConfig = {
  role: 'SUPPORT_STAFF',
  account: 'support@demo.emukey.vn',
  items: [
    { label: 'Hàng đợi', to: '/support', end: true },
    { label: 'Đang xử lý', to: '/support?view=active' },
     { label: 'Đã giải quyết', to: '/support?view=resolved' },
     { label: 'Hồ sơ', to: '/support/profile' },
  ],
};

export const systemShell: RoleShellConfig = {
  role: 'SYSTEM_ADMIN',
  account: 'sysadmin@demo.emukey.vn',
  items: [
    { label: 'Tổng quan', to: '/system/console', end: true },
    { label: 'Người dùng', to: '/system/console?view=users' },
    { label: 'Thanh toán', to: '/system/console?view=payments' },
    { label: 'Blockchain', to: '/system/console?view=blockchain' },
     { label: 'Nhật ký', to: '/system/console?view=audit' },
     { label: 'Hồ sơ', to: '/system/console/profile' },
  ],
};

const roleLabels: Record<RoleShellConfig['role'], string> = {
  CUSTOMER: 'NGƯỜI MUA',
  PROVIDER_ADMIN: 'PROVIDER',
  SUPPORT_STAFF: 'SUPPORT',
  SYSTEM_ADMIN: 'SYSTEM',
};

export function RoleShell({ config }: { readonly config: RoleShellConfig }) {
  const location = useLocation();
  const auth = useOptionalAuth();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const current = `${location.pathname}${location.search}`;

  useEffect(() => {
    setMenuOpen(false);
  }, [location.pathname, location.search]);

  useEffect(() => {
    if (!menuOpen) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setMenuOpen(false);
        menuButtonRef.current?.focus();
      }
    };
    document.addEventListener('keydown', closeOnEscape);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', closeOnEscape);
      document.body.style.overflow = previousOverflow;
    };
  }, [menuOpen]);

  const navigation = (
    <nav aria-label={`Điều hướng ${config.role}`} className="role-nav">
      {config.items.map((item) => (
        <Link
          className={
            item.end
              ? current === item.to
                ? 'active'
                : ''
              : current === item.to || (!item.to.includes('?') && location.pathname.startsWith(item.to))
                ? 'active'
                : ''
          }
          key={`${item.to}-${item.label}`}
          onClick={() => setMenuOpen(false)}
          to={item.to}
          aria-label={item.ariaLabel}
        >
          {item.label}
        </Link>
      ))}
    </nav>
  );

  return (
    <div className="role-shell">
      <aside className="role-sidebar">
        <div className="role-brand"><Brand /></div>
        <span className="role-label">{roleLabels[config.role]}</span>
        <button
          ref={menuButtonRef}
          aria-controls="role-mobile-menu"
          aria-expanded={menuOpen}
          aria-label={menuOpen ? 'Đóng menu vai trò' : 'Mở menu vai trò'}
          className="mobile-menu-trigger role-menu-trigger"
          onClick={() => setMenuOpen((open) => !open)}
          type="button"
        >
          <span aria-hidden="true">☰</span>
          <span>Điều hướng</span>
        </button>
        <div className="role-desktop-nav">{navigation}</div>
        <div className="role-account-footer">
          {auth?.user ? <NotificationCenter /> : null}
          <div className="role-account-row">
            <small>{auth?.user?.email ?? config.account}</small>
            {auth?.user ? <Button type="text" onClick={() => void auth.logout()}>Đăng xuất</Button> : null}
            {auth?.user ? <Button aria-label="Cài đặt tài khoản" icon={<SettingOutlined />} onClick={() => void navigate(roleSettingsPath(auth.user!.role))} type="text" /> : null}
          </div>
        </div>
      </aside>
      {menuOpen ? (
        <>
          <button
            aria-label="Đóng menu vai trò"
            className="mobile-menu-backdrop"
            onClick={() => setMenuOpen(false)}
            type="button"
          />
          <div className="mobile-menu-panel role-mobile-menu" id="role-mobile-menu" role="dialog" aria-label={`Menu ${roleLabels[config.role]}`}>
            {navigation}
            {auth?.user ? <div className="mobile-menu-actions"><NotificationCenter /><Button onClick={() => { setMenuOpen(false); void navigate(roleSettingsPath(auth.user!.role)); }}>Hồ sơ tài khoản</Button><Button onClick={() => { setMenuOpen(false); void auth.logout(); }}>Đăng xuất</Button></div> : null}
          </div>
        </>
      ) : null}
      <main className="role-main"><Outlet /></main>
    </div>
  );
}
