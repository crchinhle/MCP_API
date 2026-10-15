import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from '../../../EmuKey/frontend/src/application/auth/authContext';
import { CustomerLayout } from '../../../EmuKey/frontend/src/presentation/components/CustomerLayout';
import { CopyableId, useDebouncedValue } from '../../../EmuKey/frontend/src/presentation/components/WorkspacePrimitives';

import { filterOrders } from '../../../EmuKey/frontend/src/application/workspace/workspaceSelectors';
import {
  buyerShell,
  providerShell,
  supportShell,
  systemShell,
  RoleShell,
} from '../../../EmuKey/frontend/src/presentation/components/RoleShell';

afterEach(cleanup);

describe('workspace foundation', () => {
  it('applies search after 300ms of inactivity and cancels the previous pending value', () => {
    function SearchValue({ value }: { value: string }) { return <output>{useDebouncedValue(value)}</output>; }
    vi.useFakeTimers();
    try {
      const view = render(<SearchValue value="initial" />);
      view.rerender(<SearchValue value="first" />);
      act(() => vi.advanceTimersByTime(299));
      expect(screen.getByText('initial')).toBeTruthy();
      view.rerender(<SearchValue value="latest" />);
      act(() => vi.advanceTimersByTime(299));
      expect(screen.getByText('initial')).toBeTruthy();
      act(() => vi.advanceTimersByTime(1));
      expect(screen.getByText('latest')).toBeTruthy();
    } finally { cleanup(); vi.useRealTimers(); }
  });

  it('copies the complete ID and reports browser clipboard failures accurately', async () => {
    const previous = Object.getOwnPropertyDescriptor(navigator, 'clipboard');
    let copied = '';
    try {
      Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async (value: string) => { copied = value; } } });
      render(<CopyableId value="COMPLETE-ORDER-ID-0123456789" />);
      fireEvent.click(screen.getByRole('button', { name: 'Copy ID' }));
      expect(await screen.findByText('Đã sao chép')).toBeTruthy();
      expect(copied).toBe('COMPLETE-ORDER-ID-0123456789');
      Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async () => { throw new Error('denied'); } } });
      fireEvent.click(screen.getByRole('button', { name: 'Copy ID' }));
      expect(await screen.findByText('Không thể sao chép. Vui lòng sao chép mã thủ công.')).toBeTruthy();
    } finally {
      if (previous) Object.defineProperty(navigator, 'clipboard', previous);
      else Reflect.deleteProperty(navigator, 'clipboard');
    }
  });

  it('links customer management back to shopping and keeps only the matching route active', () => {
    render(<MemoryRouter initialEntries={['/buyer/orders/123/payment']}><Routes><Route path="/buyer" element={<CustomerLayout />}><Route path="orders/:id/payment" element={<p>Payment</p>} /></Route></Routes></MemoryRouter>);
    expect(screen.getByRole('link', { name: 'Mua sắm' }).getAttribute('href')).toBe('/catalog');
    expect(screen.getByRole('link', { name: 'Đơn hàng' }).getAttribute('aria-current')).toBe('page');
    expect(screen.getByRole('link', { name: 'Tổng quan' }).getAttribute('aria-current')).toBeNull();
  });

  it.each([buyerShell, providerShell, supportShell, systemShell])('shows the signed-in account name and email for $role', (config) => {
    render(<QueryClientProvider client={new QueryClient()}><AuthProvider skipBootstrap initialUser={{ id: 'account', email: 'actual@example.test', displayName: 'Actual Account', role: config.role, status: 'ACTIVE' }}><MemoryRouter><RoleShell config={config} /></MemoryRouter></AuthProvider></QueryClientProvider>);
    expect(screen.getByText('Actual Account')).toBeTruthy();
    expect(screen.getByText('actual@example.test')).toBeTruthy();
  });

  it('does not display a demo identity without a signed-in account', () => {
    render(<MemoryRouter><RoleShell config={buyerShell} /></MemoryRouter>);
    expect(screen.queryByText(/@demo\.emukey\.vn|@securedesk\.vn/)).toBeNull();
  });

  it('filters orders without mutating the mock array', () => {
    const orders = [{ id: 'ORD-2026-0218', buyerReference: 'buyer', product: 'product', plan: 'plan', devices: 1, total: 1, status: 'awaiting-payment' as const, statusLabel: 'Chờ thanh toán' }];
    const before = [...orders];

    expect(
      filterOrders(orders, '0218', 'all').map((order) => order.id),
    ).toEqual(['ORD-2026-0218']);
    expect(orders).toEqual(before);
  });

  it('renders the active Customer navigation inside the shared role shell', () => {
    render(
      <MemoryRouter initialEntries={['/buyer/orders']}>
        <Routes>
          <Route element={<RoleShell config={buyerShell} />} path="/buyer">
            <Route element={<h1>Đơn hàng</h1>} path="orders" />
          </Route>
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByText('EmuKey').className).toContain('brand-wordmark');
    expect(screen.getByRole('link', { name: 'Đơn hàng' }).className).toContain(
      'active',
    );
  });
});
