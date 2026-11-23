import { act, fireEvent, render, renderHook, screen, waitFor } from '@testing-library/react-native';

import { useActivationKeyAccess } from '../../../../EmuKey/mobile/src/application/licenses/useLicenses';
import {
  ActivationKeyScreen,
  DevicesScreen,
  LicenseDetailScreen,
  LicensesScreen,
  VerifyLicenseScreen,
} from '../../../../EmuKey/mobile/src/presentation/EmuKeyMobileApp';
import {
  getLicense,
  listDevices,
  listLicenses,
  loadActivationKey,
  remoteRevokeDevice,
  updateDeviceMetadata,
  requestLicensingActionVerification,
  retrieveActivationKey,
  verifyPublicLicense,
} from '../../../../EmuKey/mobile/src/infrastructure/api/client';

jest.mock('../../../../EmuKey/mobile/src/infrastructure/api/client', () => ({
  getLicense: jest.fn(),
  listLicenses: jest.fn(),
  listDevices: jest.fn().mockResolvedValue([]),
  remoteRevokeDevice: jest.fn(),
  updateDeviceMetadata: jest.fn(),
  requestLicensingActionVerification: jest.fn().mockResolvedValue({ accepted: true }),
  verifyPublicLicense: jest.fn(),
  retrieveActivationKey: jest.fn(),
  loadActivationKey: jest.fn().mockResolvedValue(null),
}));

const getLicenseMock = getLicense as jest.MockedFunction<typeof getLicense>;
const listLicensesMock = listLicenses as jest.MockedFunction<typeof listLicenses>;
const listDevicesMock = listDevices as jest.MockedFunction<typeof listDevices>;
const remoteRevokeDeviceMock = remoteRevokeDevice as jest.MockedFunction<typeof remoteRevokeDevice>;
const updateDeviceMetadataMock = updateDeviceMetadata as jest.MockedFunction<typeof updateDeviceMetadata>;
const verifyPublicLicenseMock = verifyPublicLicense as jest.MockedFunction<typeof verifyPublicLicense>;
const loadActivationKeyMock = loadActivationKey as jest.MockedFunction<typeof loadActivationKey>;

const activeLicense = {
  activationKeyTrustStatus: 'TRUSTED',
  activeDeviceCount: 0,
  deviceStateVersion: 0,
  confirmationCount: 3,
  createdAt: '2026-09-10T00:00:00.000Z',
  entitlementVersion: 1,
  expiresAt: '2027-09-10T00:00:00.000Z',
  finality: 'CHAIN_CONFIRMED',
  id: 'license-1',
  keyVersion: 1,
  maxActiveDevices: 2,
  originOrderId: 'order-1',
  periodStart: '2026-09-10T00:00:00.000Z',
  plan: { commitment: `0x${'11'.repeat(32)}`, name: 'Pro', version: 1 },
  productName: 'Emukey Desktop',
  provider: { displayName: 'Emukey' },
  publicLicenseId: 'EMU-LICENSE-1',
  status: 'ACTIVE',
  updatedAt: '2026-09-10T00:00:00.000Z',
};

describe('mobile License screens', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    listDevicesMock.mockResolvedValue([]);
    jest.mocked(requestLicensingActionVerification).mockResolvedValue({ accepted: true });
    loadActivationKeyMock.mockResolvedValue(null);
  });

  it('renders masked key preview on list and keeps secret keys hidden', async () => {
    listLicensesMock.mockResolvedValue([
      { ...activeLicense, activationKeyLast4: 'ABCD', activationKeyAvailable: true },
    ]);
    await render(<LicensesScreen onOpenLicenseDetail={jest.fn()} />);
    expect(await screen.findByText('EMU-LICENSE-1')).toBeOnTheScreen();
    expect(screen.getByText(/•••• ABCD/)).toBeOnTheScreen();
    expect(screen.getByText(/Hiển thị 1\/1 bản quyền · Bộ lọc: Tất cả/)).toBeOnTheScreen();
    expect(retrieveActivationKey).not.toHaveBeenCalled();
  });

  it('waits for blockchain before describing provider delivery', async () => {
    getLicenseMock.mockResolvedValue({
      ...activeLicense,
      fulfillmentMode: 'PROVIDER_HANDOFF',
      status: 'PENDING_ONCHAIN',
      activationKeyTrustStatus: 'PENDING_FINALITY',
      finality: 'PENDING_FINALITY',
      providerDeliveryStatus: null,
      activationKeyAvailable: false,
    });
    await render(<ActivationKeyScreen licenseId="license-1" onBack={jest.fn()} />);
    expect(await screen.findByText('Đang xác nhận blockchain')).toBeOnTheScreen();
    expect(screen.queryByText('Đang bàn giao bản quyền cho nhà cung cấp')).toBeNull();
    expect(screen.queryByText('Nhận mã bản quyền')).toBeNull();
  });

  it('does not describe a delivered snapshot as usable while chain evidence is being checked', async () => {
    getLicenseMock.mockResolvedValue({
      ...activeLicense,
      fulfillmentMode: 'PROVIDER_HANDOFF',
      activationKeyTrustStatus: 'UNTRUSTED_REORG',
      finality: 'REORGED',
      providerDeliveryStatus: 'DELIVERED',
      activationKeyAvailable: true,
    });
    await render(<ActivationKeyScreen licenseId="license-1" onBack={jest.fn()} />);
    expect(await screen.findByText('Đang xác minh lại blockchain')).toBeOnTheScreen();
    expect(screen.queryByText('Nhà cung cấp đã nhận bản quyền')).toBeNull();
    expect(screen.queryByText('Nhận mã bản quyền')).toBeNull();
  });

  it.each(['PENDING', 'RETRY_WAIT', 'FAILED'] as const)(
    'hides device actions on LicenseDetailScreen for provider-managed %s',
    async (providerDeliveryStatus) => {
      getLicenseMock.mockResolvedValue({
        ...activeLicense,
        fulfillmentMode: 'PROVIDER_HANDOFF',
        providerDeliveryStatus,
        activationKeyAvailable: false,
      });

      await render(
        <LicenseDetailScreen
          licenseId="license-1"
          onBack={jest.fn()}
          onOpenDevices={jest.fn()}
          onOpenKey={jest.fn()}
          onOpenRenewal={jest.fn()}
          onOpenSupport={jest.fn()}
        />,
      );
      expect(await screen.findByText('EMU-LICENSE-1')).toBeOnTheScreen();
      expect(screen.queryByText(/Quản lý thiết bị/)).toBeNull();
      expect(
        screen.getByText(
          providerDeliveryStatus === 'FAILED'
            ? 'Bàn giao bản quyền cần xử lý. Không thanh toán lại.'
            : 'Đang bàn giao cho nhà cung cấp',
        ),
      ).toBeOnTheScreen();
      expect(listDevicesMock).not.toHaveBeenCalled();
    },
  );

  it.each(['PENDING', 'RETRY_WAIT', 'FAILED'] as const)(
    'hides key retrieval on ActivationKeyScreen for provider-managed %s',
    async (providerDeliveryStatus) => {
      getLicenseMock.mockResolvedValue({
        ...activeLicense,
        fulfillmentMode: 'PROVIDER_HANDOFF',
        providerDeliveryStatus,
        activationKeyAvailable: false,
      });

      await render(<ActivationKeyScreen licenseId="license-1" onBack={jest.fn()} />);
      expect(await screen.findByText(/EMU-LICENSE-1/)).toBeOnTheScreen();
      expect(screen.queryByText('Nhận mã bản quyền')).toBeNull();
      expect(screen.queryByText('Xem mã đã lưu')).toBeNull();
      expect(retrieveActivationKey).not.toHaveBeenCalled();
    },
  );

  it('receives an acknowledged provider key without opening EmuKey device management', async () => {
    getLicenseMock.mockResolvedValue({
      ...activeLicense,
      fulfillmentMode: 'PROVIDER_HANDOFF',
      providerDeliveryStatus: 'DELIVERED',
      activationKeyAvailable: true,
    });
    jest.mocked(retrieveActivationKey).mockResolvedValue({
      activationKey: 'provider-ready-key',
      keyVersion: 1,
      deliveryId: 'delivery',
      retryUntil: '2026-11-01T00:05:00Z',
    });

    await render(<ActivationKeyScreen licenseId="license-1" onBack={jest.fn()} />);
    await act(async () => fireEvent.press(await screen.findByText('Nhận mã bản quyền')));
    expect(screen.queryByText('provider-ready-key')).toBeNull();
    await act(async () => fireEvent.press(await screen.findByText('Hiện mã')));
    expect(await screen.findByText('provider-ready-key')).toBeOnTheScreen();
    expect(listDevicesMock).not.toHaveBeenCalled();
  });

  it('shows delivered provider handoff status on LicenseDetailScreen without device actions', async () => {
    getLicenseMock.mockResolvedValue({
      ...activeLicense,
      fulfillmentMode: 'PROVIDER_HANDOFF',
      providerDeliveryStatus: 'DELIVERED',
      activationKeyAvailable: true,
    });
    await render(
      <LicenseDetailScreen
        licenseId="license-1"
        onBack={jest.fn()}
        onOpenDevices={jest.fn()}
        onOpenKey={jest.fn()}
        onOpenRenewal={jest.fn()}
        onOpenSupport={jest.fn()}
      />,
    );
    expect(await screen.findByText('Nhà cung cấp đã nhận bản quyền')).toBeOnTheScreen();
    expect(screen.getByText('Mã đã sẵn sàng và chưa lưu trên thiết bị này.')).toBeOnTheScreen();
    expect(screen.queryByText(/Quản lý thiết bị/)).toBeNull();
    expect(listDevicesMock).not.toHaveBeenCalled();
  });

  it('lets the owner receive an available key immediately and hides it until revealed', async () => {
    getLicenseMock.mockResolvedValue({ ...activeLicense, activationKeyAvailable: true });
    jest.mocked(retrieveActivationKey).mockResolvedValue({
      activationKey: 'received-secret-key',
      keyVersion: 1,
      deliveryId: 'delivery',
      retryUntil: '2026-11-01T00:05:00Z',
    });

    await render(<ActivationKeyScreen licenseId="license-1" onBack={jest.fn()} />);
    await act(async () => fireEvent.press(await screen.findByText('Nhận mã bản quyền')));
    expect(retrieveActivationKey).toHaveBeenCalledWith('license-1', 1);
    expect(screen.queryByText('received-secret-key')).toBeNull();
    await act(async () => fireEvent.press(await screen.findByText('Hiện mã')));
    expect(await screen.findByText('received-secret-key')).toBeOnTheScreen();
  });

  it('renames a device and continues device revocation through bound email link without copying tokens', async () => {
    getLicenseMock.mockResolvedValue({ ...activeLicense, activeDeviceCount: 1 });
    listDevicesMock.mockResolvedValue([
      {
        id: 'device-1',
        deviceRef: 'playwright-device',
        status: 'ACTIVE',
        bindingGeneration: 1,
        activatedAt: '2026-09-10T00:01:00.000Z',
        revokedAt: null,
      },
    ]);
    updateDeviceMetadataMock.mockResolvedValue({
      id: 'device-1',
      deviceRef: 'playwright-device',
      displayName: 'Laptop Công Ty',
      status: 'ACTIVE',
      bindingGeneration: 1,
      activatedAt: '2026-09-10T00:01:00.000Z',
      revokedAt: null,
    });

    await render(<DevicesScreen licenseId="license-1" onBack={jest.fn()} />);
    expect(await screen.findByText('playwright-device')).toBeOnTheScreen();
    expect(screen.getByText('Đang hoạt động')).toBeOnTheScreen();
    expect(remoteRevokeDeviceMock).not.toHaveBeenCalled();

    await act(async () =>
      fireEvent.changeText(screen.getByLabelText('Tên thiết bị'), 'Laptop Công Ty'),
    );
    await act(async () => fireEvent.press(screen.getByText('Lưu tên thiết bị')));
    await waitFor(() =>
      expect(updateDeviceMetadataMock).toHaveBeenCalledWith(
        'license-1',
        'device-1',
        'Laptop Công Ty',
      ),
    );

    await act(async () => fireEvent.press(screen.getByText('Thu hồi từ xa')));
    await act(async () => fireEvent.press(await screen.findByText('Gửi email xác nhận thu hồi')));
    await waitFor(() =>
      expect(requestLicensingActionVerification).toHaveBeenCalledWith(
        'license-1',
        'REMOTE_REVOKE_DEVICE',
        'device-1',
      ),
    );
    expect(screen.queryByLabelText('Action token')).toBeNull();
    expect(remoteRevokeDeviceMock).not.toHaveBeenCalled();
  });

  it('verifies a public license without authentication data', async () => {
    verifyPublicLicenseMock.mockResolvedValue({
      blockNumber: 42,
      finality: 'CHAIN_CONFIRMED',
      licenseId: 'EMU-LICENSE-1',
      productName: 'Emukey Desktop',
      provider: { displayName: 'Emukey' },
      state: 'CHAIN_CONFIRMED',
    });
    await render(<VerifyLicenseScreen />);
    await act(async () =>
      fireEvent.changeText(screen.getByLabelText('Mã bản quyền công khai'), 'EMU-LICENSE-1'),
    );
    await act(async () => fireEvent.press(screen.getByText('Xác minh')));
    await waitFor(() => expect(verifyPublicLicenseMock).toHaveBeenCalledWith('EMU-LICENSE-1'));
    expect(await screen.findByText('Emukey Desktop')).toBeOnTheScreen();
    expect(screen.getAllByText('Đã xác nhận trên chuỗi').length).toBeGreaterThan(0);
    expect(screen.queryByText('CHAIN_CONFIRMED')).toBeNull();
  });

  it('auto-opens detail for owned targetLicenseId', async () => {
    listLicensesMock.mockResolvedValue([activeLicense]);
    const onOpenLicenseDetail = jest.fn();
    await render(
      <LicensesScreen
        onOpenLicenseDetail={onOpenLicenseDetail}
        targetLicenseId="license-1"
      />,
    );
    await waitFor(() => expect(onOpenLicenseDetail).toHaveBeenCalledWith('license-1'));
  });

  it('reports unavailable for foreign targetLicenseId', async () => {
    listLicensesMock.mockResolvedValue([activeLicense]);
    const onOpenLicenseDetail = jest.fn();
    await render(
      <LicensesScreen
        onOpenLicenseDetail={onOpenLicenseDetail}
        targetLicenseId="foreign-license"
      />,
    );
    expect(
      await screen.findByText('Không tìm thấy bản quyền hoặc bạn không có quyền truy cập.'),
    ).toBeOnTheScreen();
    expect(onOpenLicenseDetail).not.toHaveBeenCalled();
  });

  it('prioritizes usage status, key action and Vietnamese labels on LicenseDetailScreen', async () => {
    getLicenseMock.mockResolvedValue({
      ...activeLicense,
      activationKeyAvailable: true,
    });

    await render(
      <LicenseDetailScreen
        licenseId="license-1"
        onBack={jest.fn()}
        onOpenDevices={jest.fn()}
        onOpenKey={jest.fn()}
        onOpenRenewal={jest.fn()}
        onOpenSupport={jest.fn()}
      />,
    );

    expect(await screen.findByText('Chưa nhận mã (đã sẵn sàng)')).toBeOnTheScreen();
    expect(screen.queryByText('Chưa có thông tin')).toBeNull();
    expect(screen.getByText('Nhận mã bản quyền')).toBeOnTheScreen();
    expect(screen.getByText('Gia hạn bản quyền')).toBeOnTheScreen();
    expect(screen.getByText('Thông tin đối chiếu kỹ thuật')).toBeOnTheScreen();

    const treeText = JSON.stringify(screen.toJSON());
    expect(treeText.indexOf('Nhận mã bản quyền')).toBeLessThan(
      treeText.indexOf('Mã tra cứu công khai'),
    );

    await act(async () => fireEvent.press(screen.getByText('Xem chi tiết')));
    expect(screen.getByText('Trạng thái xác thực')).toBeOnTheScreen();
    expect(screen.getByText('Đáng tin cậy')).toBeOnTheScreen();
    expect(screen.queryByText('TRUSTED')).toBeNull();
    expect(screen.queryByText('Finality')).toBeNull();
  });

  it('distinguishes network error from missing permission on LicenseDetailScreen and syncs filter changes on LicensesScreen', async () => {
    getLicenseMock.mockRejectedValueOnce(new TypeError('Network request failed'));

    await render(
      <LicenseDetailScreen
        licenseId="license-1"
        onBack={jest.fn()}
        onOpenDevices={jest.fn()}
        onOpenKey={jest.fn()}
        onOpenRenewal={jest.fn()}
        onOpenSupport={jest.fn()}
      />,
    );

    expect(
      await screen.findByText('Không thể kết nối máy chủ. Kiểm tra kết nối mạng và thử lại.'),
    ).toBeOnTheScreen();
    expect(screen.queryByText(/không có quyền/)).toBeNull();

    listLicensesMock.mockResolvedValue([
      activeLicense,
      {
        ...activeLicense,
        id: 'license-expiring',
        publicLicenseId: 'EMU-EXP-1',
        expiresAt: new Date(Date.now() + 5 * 86_400_000).toISOString(),
      },
    ]);

    const view = await render(
      <LicensesScreen initialFilter="ACTIVE" onOpenLicenseDetail={jest.fn()} />,
    );
    expect(await screen.findByText(/Bộ lọc: Đang hoạt động/)).toBeOnTheScreen();

    await view.rerender(
      <LicensesScreen initialFilter="expiring" onOpenLicenseDetail={jest.fn()} />,
    );
    expect(await screen.findByText(/Bộ lọc: Sắp hết hạn/)).toBeOnTheScreen();
    expect(screen.getByText('EMU-EXP-1')).toBeOnTheScreen();
    expect(screen.queryByText('EMU-LICENSE-1')).toBeNull();
  });

  it('surfaces refreshError warning banner on ActivationKeyScreen without discarding loaded license state', async () => {
    getLicenseMock
      .mockResolvedValueOnce({ ...activeLicense, activationKeyAvailable: true })
      .mockRejectedValueOnce(new TypeError('Network request failed'))
      .mockResolvedValueOnce({ ...activeLicense, activationKeyAvailable: true });

    await render(<ActivationKeyScreen licenseId="license-1" onBack={jest.fn()} />);
    expect(await screen.findByText(/EMU-LICENSE-1/)).toBeOnTheScreen();

    await act(async () => fireEvent.press(screen.getByText('Làm mới')));
    expect(
      await screen.findByText('Không thể kết nối máy chủ. Kiểm tra kết nối mạng và thử lại.'),
    ).toBeOnTheScreen();
    expect(screen.getByText(/EMU-LICENSE-1/)).toBeOnTheScreen();

    await act(async () => fireEvent.press(screen.getByText('Thử lại')));
    await waitFor(() =>
      expect(
        screen.queryByText('Không thể kết nối máy chủ. Kiểm tra kết nối mạng và thử lại.'),
      ).toBeNull(),
    );
  });
});

it('ignores a late key for another license with the same key version', async () => {
  let finishRead!: (key: string) => void;
  loadActivationKeyMock.mockReturnValueOnce(new Promise((resolve) => { finishRead = resolve; }));
  const licenseA = { ...activeLicense, id: 'license-a' };
  const licenseB = { ...activeLicense, id: 'license-b' };
  const hook = await renderHook(({ license }) => useActivationKeyAccess(license), {
    initialProps: { license: licenseA },
  });

  let pending!: Promise<string | null>;
  await act(async () => { pending = hook.result.current.fetchOrLoad(); });
  await hook.rerender({ license: licenseB });
  await act(async () => {
    finishRead('fixture-key-for-a');
    await pending;
  });

  expect(hook.result.current.activationKey).toBeNull();
  expect(hook.result.current.busy).toBe(false);
});
