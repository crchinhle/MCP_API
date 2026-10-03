import { render, screen } from '@testing-library/react-native';

import App from '../../App';

jest.mock('../../src/infrastructure/api/client', () => ({
  restoreSession: jest.fn().mockResolvedValue(null),
}));

describe('mobile application shell', () => {
  it('requires a customer account before showing private buyer data', async () => {
    await render(<App />);
    expect(await screen.findByText('Emukey')).toBeOnTheScreen();
    expect(screen.getByText('Đăng nhập để quản lý đơn hàng và license của bạn')).toBeOnTheScreen();
    expect(screen.getByText('Xác minh License công khai')).toBeOnTheScreen();
  });
});
