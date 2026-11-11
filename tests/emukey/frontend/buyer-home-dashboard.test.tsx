import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import { BuyerHomeScreen } from '../../../EmuKey/frontend/src/presentation/screens/BuyerHomeScreen';
import * as licenseQueries from '../../../EmuKey/frontend/src/application/licenses/licenseQueries';
import * as orderQueries from '../../../EmuKey/frontend/src/application/orders/orderQueries';

vi.mock('../../../EmuKey/frontend/src/application/licenses/licenseQueries', async (importOriginal) => {
  const actual = await importOriginal<typeof licenseQueries>();
  return {
    ...actual,
    useLicenses: vi.fn(),
  };
});

vi.mock('../../../EmuKey/frontend/src/application/orders/orderQueries', async (importOriginal) => {
  const actual = await importOriginal<typeof orderQueries>();
  return {
    ...actual,
    useOrders: vi.fn(),
  };
});

afterEach(cleanup);

function renderWithClient(ui: React.ReactElement, initialEntries = ['/buyer']) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={initialEntries}>
        <Routes>
          <Route path="/buyer" element={ui} />
          <Route path="/buyer/licenses" element={<div data-testid="licenses-page" />} />
          <Route path="/help" element={<div data-testid="help-page" />} />
          <Route path="/verify" element={<div data-testid="verify-page" />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('Customer Dashboard (BuyerHomeScreen)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(orderQueries.useOrders).mockReturnValue({
      data: [{ id: 'order-1' }] as never[],
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    } as never);
  });

  it('renders 0 for empty licenses and hides the attention section', () => {
    vi.mocked(licenseQueries.useLicenses).mockReturnValue({
      data: [],
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    } as never);

    renderWithClient(<BuyerHomeScreen />);

    expect(screen.getByRole('heading', { name: 'Tổng quan tài khoản' })).toBeTruthy();
    expect(screen.getByText('Bản quyền đang hoạt động')).toBeTruthy();
    expect(screen.getByText('Thiết bị đang sử dụng')).toBeTruthy();
    expect(screen.getByText('Sắp hết hạn trong 30 ngày')).toBeTruthy();

    // Attention section must not appear when expiring count is 0
    expect(screen.queryByText('Cần chú ý')).toBeNull();
  });

  it('renders correct active licenses, active devices and shows attention banner when licenses expire soon', () => {
    const futureExpiry = new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString();
    const farFutureExpiry = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString();

    vi.mocked(licenseQueries.useLicenses).mockReturnValue({
      data: [
        {
          id: 'lic-1',
          status: 'ACTIVE',
          expiresAt: futureExpiry,
          activeDeviceCount: 3,
        },
        {
          id: 'lic-2',
          status: 'ACTIVE',
          expiresAt: farFutureExpiry,
          activeDeviceCount: 2,
        },
        {
          id: 'lic-3',
          status: 'REVOKED',
          expiresAt: farFutureExpiry,
          activeDeviceCount: 5,
        },
      ] as never[],
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    } as never);

    renderWithClient(<BuyerHomeScreen />);

    // Active count: lic-1 and lic-2 = 2
    expect(screen.getByLabelText(/Bản quyền đang hoạt động: 2/)).toBeTruthy();
    // Device count on active licenses: 3 + 2 = 5 (lic-3 is revoked, not counted)
    expect(screen.getByLabelText(/Thiết bị đang sử dụng: 5/)).toBeTruthy();
    // Expiring within 30 days: lic-1 = 1
    expect(screen.getByLabelText(/Sắp hết hạn trong 30 ngày: 1/)).toBeTruthy();

    // Attention section must appear
    expect(screen.getByRole('heading', { name: 'Cần chú ý' })).toBeTruthy();
    expect(screen.getByText('1 bản quyền sắp hết hạn')).toBeTruthy();
    expect(screen.getByText('Kiểm tra thời hạn sử dụng để gia hạn kịp thời.')).toBeTruthy();

    // Clicking KPI 1 navigates to licenses
    fireEvent.click(screen.getByLabelText(/Bản quyền đang hoạt động: 2/));
    expect(screen.getByTestId('licenses-page')).toBeTruthy();
  });

  it('navigates to help and verify from the shortcut cards', () => {
    vi.mocked(licenseQueries.useLicenses).mockReturnValue({
      data: [],
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    } as never);

    renderWithClient(<BuyerHomeScreen />);

    // Check shortcuts exist
    expect(screen.getByRole('heading', { name: 'Quản lý bản quyền' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Đọc hướng dẫn' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Xác minh' })).toBeTruthy();

    // Click Read Guide shortcut
    fireEvent.click(screen.getByLabelText('Đọc hướng dẫn: Cài đặt và sử dụng'));
    expect(screen.getByTestId('help-page')).toBeTruthy();
  });

  it('renders error alert when license query fails', () => {
    vi.mocked(licenseQueries.useLicenses).mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true,
      refetch: vi.fn(),
    } as never);

    renderWithClient(<BuyerHomeScreen />);

    expect(screen.getByText('Không thể tải dữ liệu trang chủ.')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Thử lại' })).toBeTruthy();
  });
});
