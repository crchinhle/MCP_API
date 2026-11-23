import { fireEvent, render, screen } from '@testing-library/react-native';
import * as ReactNative from 'react-native';

import { CustomerSessionProvider } from '../../../../EmuKey/mobile/src/application/auth/useCustomerSession';
import { NotificationProvider } from '../../../../EmuKey/mobile/src/application/notifications/notificationContext';
import { NotificationBell } from '../../../../EmuKey/mobile/src/presentation/components/NotificationBell';
import { TermsAcceptance } from '../../../../EmuKey/mobile/src/presentation/components/TermsAcceptance';
import { AppButton } from '../../../../EmuKey/mobile/src/presentation/components/ui/AppButton';
import { AppText } from '../../../../EmuKey/mobile/src/presentation/components/ui/AppText';
import { BottomActionBar } from '../../../../EmuKey/mobile/src/presentation/components/layout/BottomActionBar';
import { FormField } from '../../../../EmuKey/mobile/src/presentation/components/ui/FormField';
import { LoginScreen } from '../../../../EmuKey/mobile/src/presentation/screens/auth/LoginScreen';
import { colors } from '../../../../EmuKey/mobile/src/presentation/theme/tokens';
import {
  listNotifications,
  restoreSession,
  subscribeSession,
} from '../../../../EmuKey/mobile/src/infrastructure/api/client';

jest.mock('../../../../EmuKey/mobile/src/infrastructure/api/client', () => {
  const actual = jest.requireActual<
    typeof import('../../../../EmuKey/mobile/src/infrastructure/api/client')
  >('../../../../EmuKey/mobile/src/infrastructure/api/client');
  return {
    MobileApiError: actual.MobileApiError,
    login: jest.fn(),
    subscribeSession: jest.fn(() => () => {}),
    restoreSession: jest.fn().mockResolvedValue(null),
    logout: jest.fn().mockResolvedValue(undefined),
    listNotifications: jest.fn().mockResolvedValue([]),
    markNotificationRead: jest.fn(),
  };
});

describe('mobile design system primitives', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    jest.mocked(subscribeSession).mockImplementation(() => () => {});
    jest.mocked(restoreSession).mockResolvedValue(null);
    jest.mocked(listNotifications).mockResolvedValue([]);
  });

  it('uses Web brand light canvas, semantic roles, and overlay tokens without drift', () => {
    expect(colors.canvas).toBe('#f7f9fb');
    expect(colors.primary).toBe('#1a4dc7');
    expect(colors.primaryPressed).toBe('#163fa4');
    expect(colors.link).toBe('#163fa4');
    expect(colors.surface).toBe('#ffffff');
    expect(colors.subtle).toBe('#f1f5f9');
    expect(colors.surfaceDisabled).toBe('#f1f5f9');
    expect(colors.overlayBackdrop).toBe('rgba(28, 28, 26, 0.45)');
    expect(colors.dangerPressed).toBe('#7f1b1e');
  });

  it('uses semantic surfaceDisabled styling (not container opacity) for disabled AppButton and link tone for tertiary', async () => {
    await render(
      <>
        <AppButton disabled label="Nút khóa" onPress={jest.fn()} variant="primary" />
        <AppButton label="Liên kết" onPress={jest.fn()} variant="tertiary" />
      </>,
    );
    const json = JSON.stringify(screen.toJSON());
    expect(json).toContain(`"backgroundColor":"${colors.surfaceDisabled}"`);
    expect(json).toContain(`"color":"${colors.link}"`);
    expect(json).not.toContain('"opacity":0.55');
  });

  it('keeps readable label tones across all AppButton variants while loading, including disabled+loading', async () => {
    const onPress = jest.fn();
    await render(
      <>
        <AppButton label="Chính đang tải" loading onPress={onPress} variant="primary" />
        <AppButton label="Nguy hiểm đang tải" loading onPress={onPress} variant="danger" />
        <AppButton label="Phụ đang tải" loading onPress={onPress} variant="secondary" />
        <AppButton label="Liên kết đang tải" loading onPress={onPress} variant="tertiary" />
        <AppButton disabled label="Khóa và đang tải" loading onPress={onPress} variant="secondary" />
      </>,
    );

    const primaryLabel = screen.getByText('Chính đang tải');
    const dangerLabel = screen.getByText('Nguy hiểm đang tải');
    const secondaryLabel = screen.getByText('Phụ đang tải');
    const tertiaryLabel = screen.getByText('Liên kết đang tải');
    const bothLabel = screen.getByText('Khóa và đang tải');

    expect(JSON.stringify(primaryLabel.props.style)).toContain(`"color":"${colors.onPrimary}"`);
    expect(JSON.stringify(dangerLabel.props.style)).toContain(`"color":"${colors.onPrimary}"`);
    expect(JSON.stringify(secondaryLabel.props.style)).toContain(`"color":"${colors.text}"`);
    expect(JSON.stringify(tertiaryLabel.props.style)).toContain(`"color":"${colors.link}"`);
    expect(JSON.stringify(bothLabel.props.style)).toContain(`"color":"${colors.text}"`);

    const lockedBtn = screen.getByRole('button', { name: 'Khóa và đang tải' });
    expect(lockedBtn.props.accessibilityState).toEqual({ busy: true, disabled: true });
    await fireEvent.press(lockedBtn);
    await fireEvent.press(screen.getByRole('button', { name: 'Phụ đang tải' }));
    expect(onPress).not.toHaveBeenCalled();
  });

  it('uses >= 3:1 controlBorderStrong on unchecked TermsAcceptance checkbox and enforces toggle/disabled accessibility', async () => {
    const hexToLum = (hex: string) => {
      const clean = hex.replace('#', '');
      const [r, g, b] = [0, 2, 4].map((i) => {
        const v = parseInt(clean.slice(i, i + 2), 16) / 255;
        return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
      });
      return 0.2126 * r + 0.7152 * g + 0.0722 * b;
    };
    const l1 = hexToLum(colors.surface);
    const l2 = hexToLum(colors.controlBorderStrong);
    const ratio = (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
    expect(ratio).toBeGreaterThanOrEqual(3);

    const onChangeAccepted = jest.fn();
    const terms = {
      version: 'v1.0',
      hash: 'a'.repeat(64),
      content: 'Nội dung điều khoản dịch vụ mẫu.',
    };

    const view = await render(
      <TermsAcceptance
        accepted={false}
        onChangeAccepted={onChangeAccepted}
        onRetry={jest.fn()}
        state="ready"
        terms={terms}
      />,
    );

    const checkbox = screen.getByRole('checkbox');
    expect(checkbox.props.accessibilityState).toEqual({ checked: false, disabled: false });
    expect(JSON.stringify(screen.toJSON())).toContain(
      `"borderColor":"${colors.controlBorderStrong}"`,
    );

    await fireEvent.press(checkbox);
    expect(onChangeAccepted).toHaveBeenCalledWith(true);

    await view.rerender(
      <TermsAcceptance
        accepted
        onChangeAccepted={onChangeAccepted}
        onRetry={jest.fn()}
        state="ready"
        terms={terms}
      />,
    );
    expect(screen.getByRole('checkbox').props.accessibilityState).toEqual({
      checked: true,
      disabled: false,
    });

    onChangeAccepted.mockClear();
    await view.rerender(
      <TermsAcceptance
        accepted={false}
        disabled
        onChangeAccepted={onChangeAccepted}
        onRetry={jest.fn()}
        state="ready"
        terms={terms}
      />,
    );
    const disabledCheckbox = screen.getByRole('checkbox');
    expect(disabledCheckbox.props.accessibilityState).toEqual({ checked: false, disabled: true });
    await fireEvent.press(disabledCheckbox);
    expect(onChangeAccepted).not.toHaveBeenCalled();
  });

  it('keeps AppText scalable with allowFontScaling enabled by default', async () => {
    await render(<AppText>Văn bản kiểm tra</AppText>);
    const node = screen.getByText('Văn bản kiểm tra');
    expect(node.props.allowFontScaling).not.toBe(false);
  });

  it('respects AppButton disabled and loading accessibility states', async () => {
    const onPress = jest.fn();
    await render(<AppButton label="Đang gửi" loading onPress={onPress} />);
    const button = screen.getByRole('button', { name: 'Đang gửi' });
    expect(button.props.accessibilityState).toEqual({ busy: true, disabled: true });
    await fireEvent.press(button);
    expect(onPress).not.toHaveBeenCalled();
  });

  it('toggles password visibility and renders accessible FormField errors', async () => {
    await render(
      <FormField
        errorText="Mật khẩu không hợp lệ"
        label="Mật khẩu"
        onChangeText={jest.fn()}
        passwordToggle
        secureTextEntry
        value="Secret@123"
      />,
    );

    const input = screen.getByLabelText('Mật khẩu');
    expect(input.props.secureTextEntry).toBe(true);
    await fireEvent.press(screen.getByRole('button', { name: 'Hiện mật khẩu' }));
    expect(screen.getByLabelText('Mật khẩu').props.secureTextEntry).toBe(false);
    expect(screen.getByText('Mật khẩu không hợp lệ')).toBeOnTheScreen();
  });

  it('caps NotificationBell visual badge at 99+ while announcing exact unread count', async () => {
    jest.mocked(restoreSession).mockResolvedValue({
      accessToken: 'tok',
      refreshToken: 'ref',
      user: {
        id: 'cust-1',
        email: 'cust@emukey.app',
        displayName: 'Customer',
        role: 'CUSTOMER',
        status: 'ACTIVE',
      },
    });
    jest.mocked(listNotifications).mockResolvedValue({
      items: [],
      nextCursor: null,
      unreadCount: 120,
    });

    await render(
      <CustomerSessionProvider>
        <NotificationProvider>
          <NotificationBell onPress={jest.fn()} />
        </NotificationProvider>
      </CustomerSessionProvider>,
    );

    expect(await screen.findByText('99+')).toBeOnTheScreen();
    expect(
      screen.getByRole('button', { name: 'Thông báo, 120 chưa đọc' }),
    ).toBeOnTheScreen();
  });

  it('stacks BottomActionBar actions vertically on narrow 320dp or large fontScale screens', async () => {
    const spy = jest.spyOn(ReactNative, 'useWindowDimensions').mockReturnValue({
      width: 320,
      height: 640,
      scale: 2,
      fontScale: 2,
    });

    await render(
      <BottomActionBar
        primary={<AppButton label="Mua ngay" onPress={jest.fn()} />}
        secondary={<AppButton label="Thêm vào giỏ" onPress={jest.fn()} variant="secondary" />}
        summaryLabel="Gói Pro"
        summaryValue="990.000 ₫"
      />,
    );

    expect(screen.getByText('Mua ngay')).toBeOnTheScreen();
    expect(screen.getByText('Thêm vào giỏ')).toBeOnTheScreen();
    const json = JSON.stringify(screen.toJSON());
    expect(json).toContain('column-reverse');
    spy.mockRestore();
  });

  it('keeps LoginScreen keyboard-friendly and accessible on narrow 320dp and large fontScale screens', async () => {
    const spy = jest.spyOn(ReactNative, 'useWindowDimensions').mockReturnValue({
      width: 320,
      height: 640,
      scale: 2,
      fontScale: 2,
    });

    await render(<LoginScreen onAuthenticated={jest.fn()} onVerify={jest.fn()} />);

    expect(screen.getByLabelText('Email')).toBeOnTheScreen();
    expect(screen.getByLabelText('Mật khẩu')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Đăng nhập' })).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Hiện mật khẩu' })).toBeOnTheScreen();
    spy.mockRestore();
  });

  it.each([
    { width: 320, fontScale: 2 },
    { width: 360, fontScale: 1.5 },
    { width: 450, fontScale: 1 },
  ])(
    'never clips or ellipsizes summaryValue in BottomActionBar with long labels at width=$width fontScale=$fontScale',
    async ({ width, fontScale }) => {
      const spy = jest.spyOn(ReactNative, 'useWindowDimensions').mockReturnValue({
        width,
        height: 800,
        scale: 2,
        fontScale,
      });

      await render(
        <BottomActionBar
          primary={<AppButton label="Xem lại & tạo đơn" onPress={jest.fn()} size="large" />}
          secondary={<AppButton label="Lưu vào giỏ" onPress={jest.fn()} size="large" variant="secondary" />}
          summaryLabel="Giá gốc Gói Doanh nghiệp siêu dài (11 thiết bị · 12 tháng)"
          summaryValue="23.220.000 ₫"
        />,
      );

      const priceNode = screen.getByText('23.220.000 ₫');
      expect(priceNode).toBeOnTheScreen();
      expect(priceNode.props.numberOfLines).toBeUndefined();
      const json = JSON.stringify(screen.toJSON());
      expect(json).toContain('"flexWrap":"wrap"');
      expect(json).toContain('"flexShrink":0');
      spy.mockRestore();
    },
  );

  it('renders BottomActionBar summaryLabel even when summaryValue is omitted for custom pricing', async () => {
    await render(
      <BottomActionBar
        primary={<AppButton label="Xem lại & tạo đơn" onPress={jest.fn()} />}
        summaryLabel="Giá gốc Gói Doanh nghiệp: 2.322.000 ₫ · Tổng xác nhận ở bước sau"
      />,
    );
    expect(
      screen.getByText('Giá gốc Gói Doanh nghiệp: 2.322.000 ₫ · Tổng xác nhận ở bước sau'),
    ).toBeOnTheScreen();
  });

  it('preserves internal FormField focus/blur styling when external onFocus and onBlur callbacks are passed', async () => {
    const onFocus = jest.fn();
    const onBlur = jest.fn();
    await render(
      <FormField
        label="Tên hiển thị"
        onBlur={onBlur}
        onChangeText={jest.fn()}
        onFocus={onFocus}
        value="Khách hàng"
      />,
    );

    const input = screen.getByLabelText('Tên hiển thị');
    await fireEvent(input, 'focus');
    expect(onFocus).toHaveBeenCalledTimes(1);
    expect(JSON.stringify(screen.toJSON())).toContain(`"borderColor":"${colors.primary}"`);

    await fireEvent(input, 'blur');
    expect(onBlur).toHaveBeenCalledTimes(1);
    expect(JSON.stringify(screen.toJSON())).not.toContain(`"borderColor":"${colors.primary}"`);
  });
});
