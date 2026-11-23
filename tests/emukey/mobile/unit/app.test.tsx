import { render, screen } from '@testing-library/react-native';

import App from '../../../../EmuKey/mobile/App';
import {
  logout,
  restoreSession,
} from '../../../../EmuKey/mobile/src/infrastructure/api/client';

jest.mock('../../../../EmuKey/mobile/src/infrastructure/api/client', () => ({
  subscribeSession: jest.fn(() => () => {}),
  restoreSession: jest.fn().mockResolvedValue(null),
  logout: jest.fn().mockResolvedValue(undefined),
  observeDevicePushTokens: jest.fn(() => () => {}),
  observeNotificationResponses: jest.fn(() => () => {}),
  listNotifications: jest.fn().mockResolvedValue([]),
  listOrders: jest.fn().mockResolvedValue([]),
  listLicenses: jest.fn().mockResolvedValue([]),
  listProducts: jest.fn().mockResolvedValue([]),
}));

const restoreSessionMock = restoreSession as jest.MockedFunction<typeof restoreSession>;

describe('mobile application shell', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    restoreSessionMock.mockResolvedValue(null);
  });

  it('requires a customer account before showing private buyer data', async () => {
    await render(<App />);
    expect(await screen.findByText('EmuKey')).toBeOnTheScreen();
    expect(screen.getByText('Đăng nhập để quản lý đơn hàng và bản quyền của bạn')).toBeOnTheScreen();
    expect(screen.getByText('Xác minh bản quyền công khai')).toBeOnTheScreen();
  });

  it('rejects non-CUSTOMER restored sessions at the login gate', async () => {
    restoreSessionMock.mockResolvedValue({
      accessToken: 'tok',
      refreshToken: 'ref',
      user: {
        id: 'prov-1',
        email: 'provider@emukey.app',
        displayName: 'Provider',
        role: 'PROVIDER',
        status: 'ACTIVE',
      },
    });
    await render(<App />);
    expect(await screen.findByText('EmuKey')).toBeOnTheScreen();
    expect(await screen.findByText('Ứng dụng này dành cho tài khoản khách hàng.')).toBeOnTheScreen();
    expect(logout).toHaveBeenCalled();
    expect(screen.queryByText('Trang chủ')).toBeNull();
  });

  it('renders the 4 fixed bottom tabs for an authenticated CUSTOMER session', async () => {
    restoreSessionMock.mockResolvedValue({
      accessToken: 'tok',
      refreshToken: 'ref',
      user: {
        id: 'cust-1',
        email: 'customer@emukey.app',
        displayName: 'Minh',
        role: 'CUSTOMER',
        status: 'ACTIVE',
      },
    });
    await render(<App />);
    expect(await screen.findByText('Trang chủ')).toBeOnTheScreen();
    expect(screen.getByText('Giỏ hàng')).toBeOnTheScreen();
    expect(screen.getByText('Đơn hàng')).toBeOnTheScreen();
    expect(screen.getByText('Tài khoản')).toBeOnTheScreen();
  });
});
