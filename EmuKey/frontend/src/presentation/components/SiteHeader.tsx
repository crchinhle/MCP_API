import { Button, Dropdown, type MenuProps } from 'antd';
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useEffect, useRef, useState } from 'react';

import { roleHomePath, roleSettingsPath } from '../../domain/workspace';
import { useOptionalAuth } from '../../application/auth/authContext';
import { UserAvatar } from './Avatar';
import { NotificationCenter } from './NotificationCenter';

function activeFor(pathname: string, target: string, prefix = false): boolean {
  if (prefix) return pathname.startsWith(target);
  return pathname === target;
}

/**
 * Single, shared site header used on every public and Customer route.
 * Brand (wordmark) -> /, public navigation in the middle, and a fixed
 * account cluster (Tổng quan + notification + account dropdown) when logged in.
 */
export function SiteHeader() {
  const location = useLocation();
  const navigate = useNavigate();
  const auth = useOptionalAuth();
  const user = auth?.user ?? null;
  const [menuOpen, setMenuOpen] = useState(false);
  const menuButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    setMenuOpen(false);
  }, [location.pathname]);

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

  const accountMenu: MenuProps['items'] = user
    ? [
        { key: 'overview', label: <button className="menu-link-button" onClick={() => void navigate(roleHomePath(user.role))} type="button">Tổng quan tài khoản</button> },
        { key: 'profile', label: <button className="menu-link-button" onClick={() => void navigate(roleSettingsPath(user.role))} type="button">Hồ sơ</button> },
        { type: 'divider' },
        { key: 'logout', label: <button className="menu-link-button" onClick={() => void auth?.logout()} type="button">Đăng xuất</button> },
      ]
    : [];

  return (
    <header className="site-header public-header">
      <a className="skip-link" href="#main-content">Bỏ qua đến nội dung chính</a>
      <Link aria-label="Về trang chủ EmuKey" className="brand-wordmark brand-wordmark--header" to="/">
        EmuKey
      </Link>

      <div className="site-header-right">
      <nav aria-label="Điều hướng chính" className="public-nav">
        <NavLink aria-current={activeFor(location.pathname, '/') ? 'page' : undefined} className={({ isActive }) => (isActive && location.pathname === '/' ? 'active' : '')} end to="/">
          Trang chủ
        </NavLink>
        <NavLink aria-current={activeFor(location.pathname, '/products', true) ? 'page' : undefined} className={({ isActive }) => (isActive ? 'active' : '')} to="/products">
          Sản phẩm
        </NavLink>
        <NavLink aria-current={activeFor(location.pathname, '/verify') ? 'page' : undefined} className={({ isActive }) => (isActive ? 'active' : '')} to="/verify">
          Xác minh
        </NavLink>
        <NavLink aria-current={activeFor(location.pathname, '/help') ? 'page' : undefined} className={({ isActive }) => (isActive ? 'active' : '')} to="/help">
          Tài liệu
        </NavLink>
        {user ? (
          <NavLink aria-current={location.pathname === roleHomePath(user.role) ? 'page' : undefined} className={({ isActive }) => (isActive ? 'active' : '')} end to={roleHomePath(user.role)}>
            Tổng quan
          </NavLink>
        ) : null}
      </nav>

      <div className="header-actions">
        {user ? (
          <div className="header-action-group">
            <NotificationCenter />
            <Dropdown menu={{ items: accountMenu }} placement="bottomRight" trigger={['click']}>
              <button aria-label="Mở menu tài khoản" className="account-pill" type="button">
                <UserAvatar name={user.displayName} />
                <span className="account-name">{user.displayName}</span>
                <span aria-hidden="true" className="account-chevron">⌄</span>
              </button>
            </Dropdown>
          </div>
        ) : (
          <div className="header-action-group">
            <Button type="text" onClick={() => void navigate('/auth')}>Đăng nhập</Button>
            <Button onClick={() => void navigate('/auth?mode=register')}>Đăng ký</Button>
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
          <div className="mobile-menu-panel" id="site-mobile-menu" role="dialog" aria-label="Menu chính">
            <nav aria-label="Điều hướng chính trên thiết bị di động">
              <Link to="/">Trang chủ</Link>
              <Link to="/products">Sản phẩm</Link>
              <Link to="/verify">Xác minh</Link>
              <Link to="/help">Tài liệu</Link>
              {user ? <Link onClick={() => setMenuOpen(false)} to={roleHomePath(user.role)}>Tổng quan</Link> : null}
            </nav>
            <div className="mobile-menu-actions">
              {user ? (
                <div className="header-action-group">
                  <Button onClick={() => { setMenuOpen(false); void navigate(roleSettingsPath(user.role)); }}>Hồ sơ</Button>
                  <Button type="primary" onClick={() => void auth?.logout()}>Đăng xuất</Button>
                </div>
              ) : (
                <div className="header-action-group">
                  <Button onClick={() => { setMenuOpen(false); void navigate('/auth'); }}>Đăng nhập</Button>
                  <Button type="primary" onClick={() => { setMenuOpen(false); void navigate('/auth?mode=register'); }}>Đăng ký</Button>
                </div>
              )}
            </div>
          </div>
        </>
      ) : null}
    </header>
  );
}
