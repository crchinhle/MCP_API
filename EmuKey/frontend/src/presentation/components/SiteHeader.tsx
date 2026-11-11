import { AppstoreOutlined, LogoutOutlined, UserOutlined } from '@ant-design/icons';
import { Button, Dropdown, type MenuProps } from 'antd';
import { Link, NavLink, useLocation, useMatch, useNavigate } from 'react-router-dom';
import { useEffect, useRef, useState } from 'react';

import { roleHomePath, roleSettingsPath } from '../../domain/workspace';
import { useOptionalAuth } from '../../application/auth/authContext';
import { computeInitials, UserAvatar } from './Avatar';
import { NotificationCenter } from './NotificationCenter';

const roleLabels: Record<string, string> = {
  CUSTOMER: 'Khách hàng',
  PROVIDER_ADMIN: 'Nhà cung cấp',
  SYSTEM_ADMIN: 'Quản trị viên',
  SUPPORT_STAFF: 'Nhân viên hỗ trợ',
};

/**
 * Single, shared site header used for public navigation across the application.
 * Brand (wordmark) -> /, public navigation (Trang chủ, Sản phẩm, Xác minh, Tài liệu),
 * and a clean account cluster (notifications + personal account dropdown) when logged in.
 */
export function SiteHeader({ skipTargetId = 'main-content' }: { readonly skipTargetId?: string }) {
  const location = useLocation();
  const publicCatalogMatch = useMatch('/products/*');
  const customerCatalogMatch = useMatch('/buyer/products/*');
  const navigate = useNavigate();
  const auth = useOptionalAuth();
  const user = auth?.user ?? null;
  const [menuOpen, setMenuOpen] = useState(false);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const mobileMenuRef = useRef<HTMLDivElement>(null);

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

  const accountMenu: MenuProps['items'] = user
    ? [
        {
          key: 'identity',
          disabled: true,
          label: (
            <div className="account-dropdown-identity">
              <UserAvatar name={user.displayName} />
              <div className="account-dropdown-identity-text">
                <span className="account-dropdown-name">{user.displayName}</span>
                <span className="account-dropdown-role">{roleLabels[user.role] ?? user.role}</span>
                {user.email ? <span className="account-dropdown-email">{user.email}</span> : null}
              </div>
            </div>
          ),
        },
        { type: 'divider' },
        {
          key: 'overview',
          icon: <AppstoreOutlined style={{ fontSize: 16 }} />,
          label: 'Tổng quan tài khoản',
          onClick: () => void navigate(roleHomePath(user.role)),
        },
        {
          key: 'profile',
          icon: <UserOutlined style={{ fontSize: 16 }} />,
          label: 'Hồ sơ cá nhân',
          onClick: () => void navigate(roleSettingsPath(user.role)),
        },
        { type: 'divider' },
        {
          key: 'logout',
          danger: true,
          icon: <LogoutOutlined style={{ fontSize: 16 }} />,
          label: 'Đăng xuất',
          onClick: () => void auth?.logout(),
        },
      ]
    : [];

  return (
    <header className="site-header public-header">
      <a className="skip-link" href={`#${skipTargetId}`}>Bỏ qua đến nội dung chính</a>
      <Link aria-label="Về trang chủ EmuKey" className="brand-wordmark brand-wordmark--header" to="/">
        EmuKey
      </Link>

      <div className="site-header-right">
        <nav aria-label="Điều hướng chính" className="public-nav">
          <NavLink className={({ isActive }) => (isActive ? 'active' : '')} end to="/">
            Trang chủ
          </NavLink>
          <NavLink
            aria-current={publicCatalogMatch || customerCatalogMatch ? 'page' : undefined}
            className={({ isActive }) => (isActive || publicCatalogMatch || customerCatalogMatch ? 'active' : '')}
            to="/catalog"
          >
            Sản phẩm
          </NavLink>
          <NavLink className={({ isActive }) => (isActive ? 'active' : '')} to="/verify">
            Xác minh
          </NavLink>
          <NavLink className={({ isActive }) => (isActive ? 'active' : '')} to="/help">
            Tài liệu
          </NavLink>
        </nav>

        {user ? <NotificationCenter /> : null}
        <div className="header-actions">
          {user ? (
            <div className="header-action-group">
              <Dropdown
                menu={{ items: accountMenu }}
                rootClassName="site-account-dropdown"
                placement="bottomRight"
                trigger={['click']}
              >
                <button
                  aria-label={`Mở menu tài khoản ${computeInitials(user.displayName)} ${user.displayName}`}
                  className="account-pill"
                  type="button"
                >
                  <UserAvatar name={user.displayName} />{' '}
                  <span className="account-name">{user.displayName}</span>
                </button>
              </Dropdown>
            </div>
          ) : (
            <div className="header-action-group">
              <Button type="text" onClick={() => void navigate('/auth')}>
                Đăng nhập
              </Button>
              <Button onClick={() => void navigate('/auth?mode=register')}>
                Đăng ký
              </Button>
            </div>
          )}
        </div>
      </div>

      <button
        ref={menuButtonRef}
        aria-controls="site-mobile-menu"
        aria-expanded={menuOpen}
        aria-label={menuOpen ? 'Đóng menu' : 'Mở menu'}
        className="mobile-menu-trigger"
        onClick={() => setMenuOpen((open) => !open)}
        type="button"
      >
        <span aria-hidden="true">☰</span>
      </button>

      {menuOpen ? (
        <>
          <button
            aria-label="Đóng menu"
            className="mobile-menu-backdrop"
            onClick={() => setMenuOpen(false)}
            type="button"
          />
          <div
            ref={mobileMenuRef}
            className="mobile-menu-panel"
            id="site-mobile-menu"
            role="dialog"
            aria-modal="true"
            aria-label="Menu chính"
          >
            <Button onClick={() => { setMenuOpen(false); menuButtonRef.current?.focus(); }}>
              Đóng menu
            </Button>
            <nav aria-label="Điều hướng chính trên thiết bị di động">
              <Link to="/">Trang chủ</Link>
              <Link to="/catalog">Sản phẩm</Link>
              <Link to="/verify">Xác minh</Link>
              <Link to="/help">Tài liệu</Link>
            </nav>
            <div className="mobile-menu-actions">
              {user ? (
                <div className="header-action-group">
                  <Button onClick={() => { setMenuOpen(false); void navigate(roleHomePath(user.role)); }}>
                    Tổng quan tài khoản
                  </Button>
                  <Button onClick={() => { setMenuOpen(false); void navigate(roleSettingsPath(user.role)); }}>
                    Hồ sơ cá nhân
                  </Button>
                  <Button type="primary" danger onClick={() => void auth?.logout()}>
                    Đăng xuất
                  </Button>
                </div>
              ) : (
                <div className="header-action-group">
                  <Button onClick={() => { setMenuOpen(false); void navigate('/auth'); }}>
                    Đăng nhập
                  </Button>
                  <Button type="primary" onClick={() => { setMenuOpen(false); void navigate('/auth?mode=register'); }}>
                    Đăng ký
                  </Button>
                </div>
              )}
            </div>
          </div>
        </>
      ) : null}
    </header>
  );
}
