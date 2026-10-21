import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { App } from '../../../EmuKey/frontend/src/presentation/app/App';
import { paymentNeedsReview } from '../../../EmuKey/frontend/src/application/orders/orderQueries';

afterEach(cleanup);

function dashboardResponses(overrides: Record<string, unknown | (() => Promise<Response>)>) {
  const original = vi.mocked(fetch).getMockImplementation()!;
  vi.mocked(fetch).mockImplementation((input, init) => {
    const path = new URL(String(input), 'http://localhost').pathname.replace('/api/v1', '');
    if (Object.hasOwn(overrides, path)) {
      const value = overrides[path];
      return typeof value === 'function' ? value() : Promise.resolve(Response.json(value));
    }
    return original(input, init);
  });
  return () => vi.mocked(fetch).mockImplementation(original);
}

describe('Provider dashboard', () => {
  it.each([
    ['MATCHED', null, false], ['MATCHED', 'OPEN', true], ['DUPLICATE', null, false],
    ['UNMATCHED', 'OPEN', true], ['AMOUNT_MISMATCH', 'OPEN', true], ['INVALID', 'OPEN', true],
    ['UNMATCHED', 'RESOLVED', false], ['INVALID', 'CLOSED_NO_ACTION', false],
  ])('uses backend review state for %s / %s', (classification, reviewStatus, expected) => {
    expect(paymentNeedsReview({ classification, reviewStatus })).toBe(expected);
  });

  it('counts only published, confirmed-active, issuing and open review records', async () => {
    const restore = dashboardResponses({
      '/products/admin': ['PUBLISHED', 'PUBLISHED', 'DRAFT', 'ARCHIVED'].map((status, index) => ({ id: `product-${index}`, name: `Product ${index}`, status })),
      '/licenses': [
        ['ACTIVE', 'CONFIRMED'], ['ACTIVE', 'PENDING'], ['ACTIVE', 'PROJECTION_STALE'],
        ['PENDING_ONCHAIN', 'PENDING'], ['SUSPENDED', 'CONFIRMED'], ['REVOKED', 'CONFIRMED'], ['EXPIRED', 'CONFIRMED'],
      ].map(([status, finality], index) => ({ id: `license-${index}`, publicLicenseId: `PUBLIC-${index}`, productName: `Software ${index}`, plan: { name: 'Plan', version: 1 }, status, finality, createdAt: `2026-10-${String(index + 1).padStart(2, '0')}T00:00:00Z` })),
      '/payments/history': [
        { classification: 'DUPLICATE', reviewStatus: null }, { classification: 'MATCHED', reviewStatus: 'OPEN' },
        { classification: 'INVALID', reviewStatus: 'OPEN' }, { classification: 'UNMATCHED', reviewStatus: 'RESOLVED' },
      ],
      '/plans': () => Promise.resolve(Response.json({ message: 'Plans unavailable' }, { status: 500 })),
    });
    try {
      render(<App initialEntries={['/provider']} />);
      const metrics = await screen.findByRole('region', { name: 'Chỉ số hoạt động' });
      await waitFor(() => expect(within(metrics).getByText('Đang phát hành')).toBeTruthy());
      const cards = within(metrics).getAllByRole('article');
      expect(cards).toHaveLength(4);
      await waitFor(() => expect(cards.map((card) => card.querySelector('strong')?.textContent)).toEqual(['2', '1', '1', '2']));
      expect(within(cards[1]).getByRole('link', { name: /Xem bản quyền/ }).getAttribute('href')).toBe('/provider/licenses?status=ACTIVE&finality=CONFIRMED');
      expect(await screen.findByText('1 sản phẩm chưa công bố')).toBeTruthy();
      expect(screen.getByText('1 bản quyền đang chờ hoàn tất phát hành')).toBeTruthy();
      expect(screen.queryByText('Không thể tải công việc sản phẩm.')).toBeNull();
      const table = screen.getByRole('table');
      expect(within(table).getAllByRole('columnheader')).toHaveLength(5);
      expect(within(table).getAllByRole('row').slice(1).map((row) => within(row).getByRole('link', { name: /Xem chi tiết/ }).getAttribute('href'))).toEqual([6, 5, 4, 3, 2].map((index) => `/provider/licenses?licenseId=license-${index}`));
      expect(within(table).queryByText(/ACTIVE|PENDING|CONFIRMED/)).toBeNull();
    } finally { restore(); }
  });

  it('shows actionable onboarding and hides empty work and progress sections', async () => {
    const restore = dashboardResponses({ '/products/admin': [], '/licenses': [], '/payments/history': [] });
    try {
      render(<App initialEntries={['/provider']} />);
      expect(await screen.findByRole('heading', { name: 'Bạn chưa có sản phẩm nào' })).toBeTruthy();
      expect(screen.getByRole('link', { name: 'Thêm sản phẩm' }).getAttribute('href')).toBe('/provider/catalog?create=product');
      expect(screen.queryByRole('heading', { name: 'Công việc cần hoàn thiện' })).toBeNull();
      expect(screen.queryByText(/đang chờ hoàn tất phát hành/)).toBeNull();
      expect(screen.queryByRole('table')).toBeNull();
    } finally { restore(); }
  });

  it('keeps unavailable metrics unknown and retries the failed query independently', async () => {
    let fail = true;
    const restore = dashboardResponses({
      '/products/admin': () => Promise.resolve(fail ? Response.json({ message: 'Unavailable' }, { status: 500 }) : Response.json([{ id: 'draft', name: 'Draft', status: 'DRAFT' }])),
    });
    try {
      render(<App initialEntries={['/provider']} />);
      const metrics = await screen.findByRole('region', { name: 'Chỉ số hoạt động' });
      expect(await within(metrics).findByText('—')).toBeTruthy();
      expect(await screen.findByRole('heading', { name: 'Bản quyền mới nhất' })).toBeTruthy();
      expect(await screen.findByRole('link', { name: /Xem chi tiết/ })).toBeTruthy();
      fail = false;
      fireEvent.click(within(metrics).getByRole('button', { name: /Thử lại/ }));
      expect(await screen.findByText('1 sản phẩm chưa công bố')).toBeTruthy();
      expect(within(metrics).queryByText('—')).toBeNull();
    } finally { restore(); }
  });

  it('opens the selected license Drawer directly from its URL', async () => {
    render(<App initialEntries={['/provider/licenses?licenseId=00000000-0000-4000-8000-000000000401']} />);
    const drawer = await screen.findByRole('dialog');
    expect(within(drawer).getByRole('heading', { name: 'SecureDesk Pro' })).toBeTruthy();
    expect(within(drawer).queryByText(/activationKey|fingerprint/)).toBeNull();
  });

  it('opens the existing product form from the onboarding URL', async () => {
    render(<App initialEntries={['/provider/catalog?create=product']} />);
    const modal = await screen.findByRole('dialog');
    expect(within(modal).getByText('Tạo sản phẩm')).toBeTruthy();
    expect(within(modal).getByRole('button', { name: 'Lưu' })).toBeTruthy();
  });

  it('retains licenses with unknown creation dates and renders a safe fallback', async () => {
    const restore = dashboardResponses({ '/licenses': [{ id: 'unknown-date', publicLicenseId: 'PUBLIC-UNKNOWN-DATE', productName: 'Unknown date product', plan: { name: 'Plan', version: 1 }, status: 'ACTIVE', finality: 'CONFIRMED', createdAt: 'bad-date' }] });
    try {
      render(<App initialEntries={['/provider']} />);
      const row = (await screen.findByText('Unknown date product')).closest('tr')!;
      expect(within(row).getByText('Chưa có thông tin')).toBeTruthy();
      expect(within(row).getByRole('link', { name: /Xem chi tiết/ }).getAttribute('href')).toBe('/provider/licenses?licenseId=unknown-date');
      expect(screen.queryByText(/Invalid Date/)).toBeNull();
    } finally { restore(); }
  });

  it('does not open a Drawer for a license outside the owned list', async () => {
    render(<App initialEntries={['/provider/licenses?licenseId=not-owned']} />);
    expect(await screen.findByText('Không tìm thấy bản quyền trong danh sách của bạn.')).toBeTruthy();
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});
