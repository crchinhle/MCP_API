import { SettingOutlined, LockOutlined } from '@ant-design/icons';
import { Button, Dropdown } from 'antd';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useEffect, useRef, useState } from 'react';

import { roleSettingsPath, type RoleShellConfig } from '../../domain/workspace';
import { useOptionalAuth } from '../../application/auth/authContext';
import { NotificationCenter } from './NotificationCenter';
import { Brand } from './Brand';

export const buyerShell: RoleShellConfig = {
  role: 'CUSTOMER',
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
  items: [
    { label: 'Tổng quan', to: '/provider', end: true },
    { label: 'Sản phẩm & gói', to: '/provider/catalog' },
    { label: 'Bản quyền', to: '/provider/licenses' },
    { label: 'Thanh toán & đối soát', to: '/provider/operations' },
    { label: 'Tài liệu sản phẩm', to: '/provider/knowledge' },
  ],
};

export const supportShell: RoleShellConfig = {
  role: 'SUPPORT_STAFF',
  items: [
    { label: 'Hàng đợi', to: '/support', end: true },
    { label: 'Đang xử lý', to: '/support?view=active' },
     { label: 'Đã giải quyết', to: '/support?view=resolved' },
     { label: 'Hồ sơ', to: '/support/profile' },
  ],
};

export const systemShell: RoleShellConfig = {
  role: 'SYSTEM_ADMIN',
  items: [
    { label: 'Tổng quan', to: '/system/console', end: true },
    { label: 'Người dùng', to: '/system/console?view=users' },
    { label: 'Thanh toán', to: '/system/console?view=payments' },
    { label: 'Blockchain', to: '/system/console?view=blockchain' },
    { label: 'Duyệt tài liệu', to: '/system/console/knowledge' },
  ],
};

export function RoleShell({ config }: { readonly config: RoleShellConfig }) {
  const location = useLocation();
  const auth = useOptionalAuth();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const mobileMenuRef = useRef<HTMLDivElement>(null);
  const current = `${location.pathname}${location.search}`;
  const isSystem = config.role === 'SYSTEM_ADMIN';
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const systemItemActive = (to: string) => {
    const [pathname, search] = to.split('?');
    return location.pathname === pathname && (new URLSearchParams(location.search).get('view') ?? '') === (new URLSearchParams(search).get('view') ?? '');
  };

  useEffect(() => {
    setMenuOpen(false);
  }, [location.pathname, location.search]);

  useEffect(() => {
    if (!menuOpen) return;
    const focusable = () => Array.from(mobileMenuRef.current?.querySelectorAll<HTMLElement>('a[href], button:not([disabled]), [tabindex="0"]') ?? []);
    focusable()[0]?.focus();
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setMenuOpen(false);
        menuButtonRef.current?.focus();
      }
      if (event.key === 'Tab') {
        const elements = focusable();
        const first = elements[0];
        const last = elements.at(-1);
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
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
      {config.role === 'CUSTOMER' ? <Link onClick={() => setMenuOpen(false)} to="/catalog">Mua sắm</Link> : null}
      {config.items.map((item) => isSystem || item.to.includes('?') ? (
        <Link
          className={(isSystem ? systemItemActive(item.to) : current === item.to) ? 'active' : ''}
          aria-current={(isSystem ? systemItemActive(item.to) : current === item.to) ? 'page' : undefined}
          key={`${item.to}-${item.label}`}
          onClick={() => setMenuOpen(false)}
          to={item.to}
          aria-label={item.ariaLabel}
        >
          {item.label}
        </Link>
      ) : (
        <NavLink
          className={({ isActive }) => isActive && (!item.end || !location.search) ? 'active' : ''}
          aria-current={item.end && location.search ? false : 'page'}
          {...(item.end ? { end: true } : {})}
          key={`${item.to}-${item.label}`}
          onClick={() => setMenuOpen(false)}
          to={item.to}
          aria-label={item.ariaLabel}
        >{item.label}</NavLink>
      ))}
    </nav>
  );

  return (
    <div className={`role-shell${config.role === 'PROVIDER_ADMIN' ? ' role-shell--provider' : isSystem ? ' role-shell--system' : ''}`}>
      <aside className="role-sidebar">
        <div className="role-brand"><Brand /></div>
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
        {auth?.user && isSystem ? <div className="role-account-footer">
          <Dropdown placement="topLeft" trigger={['click']} autoFocus open={accountMenuOpen} onOpenChange={setAccountMenuOpen} menu={{ 'aria-label': 'Tài khoản quản trị', items: [
            { key: 'email', label: auth.user.email, disabled: true },
            { type: 'divider' },
            { key: 'profile', label: 'Hồ sơ tài khoản', icon: <SettingOutlined /> },
            { key: 'password', label: 'Đổi mật khẩu', icon: <LockOutlined /> },
            { type: 'divider' },
            { key: 'logout', label: 'Đăng xuất', danger: true },
          ], onClick: ({ key }) => {
            setAccountMenuOpen(false);
            if (key === 'logout') void auth.logout();
            else void navigate(`${roleSettingsPath(auth.user!.role)}${key === 'password' ? '?password=change' : ''}`);
          } }}>
            <button type="button" className="system-account-trigger" aria-label={`Mở menu tài khoản ${auth.user.displayName}`} aria-haspopup="menu" aria-expanded={accountMenuOpen} onKeyDown={(event) => { if (event.key === ' ') { event.preventDefault(); setAccountMenuOpen((open) => !open); } }}>
              <span className="system-account-avatar" aria-hidden="true">{auth.user.displayName.trim().split(/\s+/).slice(-2).map((part) => part[0]).join('').toLocaleUpperCase('vi')}</span>
              <span className="role-account-identity"><strong>{auth.user.displayName}</strong></span>
            </button>
          </Dropdown>
        </div> : auth?.user && config.role === 'PROVIDER_ADMIN' ? <div className="role-account-footer">
          <Dropdown placement="topLeft" trigger={['click']} autoFocus menu={{ items: [
            { key: 'email', label: auth.user.email, disabled: true },
            { type: 'divider' },
            { key: 'profile', label: 'Hồ sơ tài khoản', icon: <SettingOutlined /> },
            { key: 'password', label: 'Đổi mật khẩu', icon: <LockOutlined /> },
            { type: 'divider' },
            { key: 'logout', label: 'Đăng xuất', danger: true },
          ], onClick: ({ key }) => {
            if (key === 'logout') void auth.logout();
            else void navigate(`${roleSettingsPath(auth.user!.role)}${key === 'password' ? '?password=change' : ''}`);
          } }}>
            <button type="button" className="provider-account-trigger" aria-label={`Mở menu tài khoản ${auth.user.displayName}`}>
              <span className="provider-account-avatar" aria-hidden="true">{auth.user.displayName.trim().split(/\s+/).slice(-2).map((part) => part[0]).join('').toLocaleUpperCase('vi')}</span>
              <span className="role-account-identity"><strong title={auth.user.displayName}>{auth.user.displayName}</strong></span>
            </button>
          </Dropdown>
        </div> : auth?.user ? <div className="role-account-footer">
          <div className="role-account-identity"><strong title={auth.user.displayName}>{auth.user.displayName}</strong><small title={auth.user.email}>{auth.user.email}</small></div>
          <div className="role-account-row">
            <Button icon={<SettingOutlined />} onClick={() => void navigate(roleSettingsPath(auth.user!.role))}>Hồ sơ</Button>
            <NotificationCenter />
            <Button aria-label="Đăng xuất" title="Đăng xuất" onClick={() => void auth.logout()}>Đăng xuất</Button>
          </div>
        </div> : null}
      </aside>
      {menuOpen ? (
        <>
          <button
            aria-label="Đóng menu vai trò"
            className="mobile-menu-backdrop"
            onClick={() => setMenuOpen(false)}
            type="button"
          />
          <div ref={mobileMenuRef} className="mobile-menu-panel role-mobile-menu" id="role-mobile-menu" role="dialog" aria-modal="true" aria-label="Menu điều hướng">
            <Button onClick={() => { setMenuOpen(false); menuButtonRef.current?.focus(); }}>Đóng menu</Button>
            {navigation}
            {auth?.user ? <div className="mobile-menu-actions">{!isSystem && config.role !== 'PROVIDER_ADMIN' ? <NotificationCenter /> : null}<Button onClick={() => { setMenuOpen(false); void navigate(roleSettingsPath(auth.user!.role)); }}>Hồ sơ tài khoản</Button><Button onClick={() => { setMenuOpen(false); void auth.logout(); }}>Đăng xuất</Button></div> : null}
          </div>
        </>
      ) : null}
      <main className="role-main"><Outlet /></main>
    </div>
  );
}
