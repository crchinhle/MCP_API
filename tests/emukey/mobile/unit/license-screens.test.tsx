import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import { LicensesScreen, VerifyLicenseScreen } from '../../../../EmuKey/mobile/src/presentation/EmuKeyMobileApp';
import {
  listLicenses,
  listDevices,
  remoteRevokeDevice,
  verifyPublicLicense,
  retrieveActivationKey,
  requestLicensingActionVerification,
} from '../../../../EmuKey/mobile/src/infrastructure/api/client';

jest.mock('../../../../EmuKey/mobile/src/infrastructure/api/client', () => ({
  listLicenses: jest.fn(),
  listDevices: jest.fn().mockResolvedValue([]),
  remoteRevokeDevice: jest.fn(),
  requestLicensingActionVerification: jest.fn().mockResolvedValue({ accepted: true }),
  verifyPublicLicense: jest.fn(),
  retrieveActivationKey: jest.fn(),
  loadActivationKey: jest.fn().mockResolvedValue(null),
}));

const listLicensesMock = listLicenses as jest.MockedFunction<typeof listLicenses>;
const listDevicesMock = listDevices as jest.MockedFunction<typeof listDevices>;
const remoteRevokeDeviceMock = remoteRevokeDevice as jest.MockedFunction<typeof remoteRevokeDevice>;
const verifyPublicLicenseMock = verifyPublicLicense as jest.MockedFunction<typeof verifyPublicLicense>;

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
  beforeEach(() => jest.clearAllMocks());
  it('waits for blockchain before describing provider delivery',async()=>{
    listLicensesMock.mockResolvedValue([{...activeLicense,fulfillmentMode:'PROVIDER_HANDOFF',status:'PENDING_ONCHAIN',activationKeyTrustStatus:'PENDING_FINALITY',finality:'PENDING_FINALITY',providerDeliveryStatus:null,activationKeyAvailable:false}]);
    await render(<LicensesScreen/>);
    expect(await screen.findByText('Đang xác nhận blockchain')).toBeOnTheScreen();
    expect(screen.queryByText('Đang bàn giao bản quyền cho nhà cung cấp')).toBeNull();
    expect(screen.queryByText('Nhận mã bản quyền')).toBeNull();
  });
  it('does not describe a delivered snapshot as usable while chain evidence is being checked',async()=>{
    listLicensesMock.mockResolvedValue([{...activeLicense,fulfillmentMode:'PROVIDER_HANDOFF',activationKeyTrustStatus:'UNTRUSTED_REORG',finality:'REORGED',providerDeliveryStatus:'DELIVERED',activationKeyAvailable:true}]);
    await render(<LicensesScreen/>);
    expect(await screen.findByText('Đang xác minh lại blockchain')).toBeOnTheScreen();
    expect(screen.queryByText('Nhà cung cấp đã nhận bản quyền')).toBeNull();
    expect(screen.queryByText('Nhận mã bản quyền')).toBeNull();
  });
  it.each(['PENDING', 'RETRY_WAIT', 'FAILED'] as const)('keeps provider-managed %s licenses out of device and key actions', async (providerDeliveryStatus) => {
    listLicensesMock.mockResolvedValue([{ ...activeLicense, fulfillmentMode: 'PROVIDER_HANDOFF', providerDeliveryStatus, activationKeyAvailable: false }]);
    await render(<LicensesScreen />);
    expect(await screen.findByText('EMU-LICENSE-1')).toBeOnTheScreen();
    expect(screen.queryByText('Xem thiết bị')).toBeNull();
    expect(screen.queryByText('Nhận mã bản quyền')).toBeNull();
    expect(screen.queryByText('Xem mã đã lưu')).toBeNull();
    expect(listDevicesMock).not.toHaveBeenCalled();
    expect(retrieveActivationKey).not.toHaveBeenCalled();
    expect(screen.getByText(providerDeliveryStatus === 'FAILED' ? 'Bàn giao bản quyền cần xử lý. Không thanh toán lại.' : 'Đang bàn giao cho nhà cung cấp')).toBeOnTheScreen();
  });

  it('receives an acknowledged provider key without opening EmuKey device management', async () => {
    listLicensesMock.mockResolvedValue([{ ...activeLicense, fulfillmentMode: 'PROVIDER_HANDOFF', providerDeliveryStatus: 'DELIVERED', activationKeyAvailable: true }]);
    jest.mocked(retrieveActivationKey).mockResolvedValue({ activationKey: 'provider-ready-key', keyVersion: 1, deliveryId: 'delivery', retryUntil: '2026-11-01T00:05:00Z' });
    await render(<LicensesScreen />);
    expect(await screen.findByText('Nhà cung cấp đã nhận bản quyền')).toBeOnTheScreen();
    await act(async () => fireEvent.press(screen.getByText('Nhận mã bản quyền')));
    expect(await screen.findByDisplayValue('provider-ready-key')).toBeOnTheScreen();
    expect(listDevicesMock).not.toHaveBeenCalled();
  });

  it('lets the owner receive an available key immediately after mobile purchase', async () => {
    listLicensesMock.mockResolvedValue([{ ...activeLicense, activationKeyAvailable: true }]);
    jest.mocked(retrieveActivationKey).mockResolvedValue({ activationKey: 'received-secret', keyVersion: 1, deliveryId: 'delivery', retryUntil: '2026-11-01T00:05:00Z' });
    await render(<LicensesScreen />);
    await act(async () => fireEvent.press(await screen.findByText('Nhận mã bản quyền')));
    expect(retrieveActivationKey).toHaveBeenCalledWith('license-1', 1);
    expect(await screen.findByDisplayValue('received-secret')).toBeOnTheScreen();
  });

  it('continues a device action through its bound email link without copying tokens into mobile', async () => {
    listLicensesMock.mockResolvedValue([activeLicense]);
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
    await render(<LicensesScreen />);
    expect(await screen.findByText('EMU-LICENSE-1')).toBeOnTheScreen();
    expect(screen.queryByText('Nhận activation key')).toBeNull();
    expect(screen.queryByText('Kích hoạt thiết bị này')).toBeNull();
    expect(remoteRevokeDeviceMock).not.toHaveBeenCalled();
    await act(async () => fireEvent.press(await screen.findByText('Xem thiết bị')));
    expect(listDevicesMock).toHaveBeenCalledWith('license-1');
    expect(await screen.findByText(/playwright-device · Đang hoạt động/)).toBeOnTheScreen();
    jest.mocked(requestLicensingActionVerification).mockResolvedValue({ accepted: true });
    await act(async () => fireEvent.press(screen.getByText('Gửi email xác nhận thu hồi')));
    await waitFor(() => expect(requestLicensingActionVerification).toHaveBeenCalledWith('license-1', 'REMOTE_REVOKE_DEVICE', 'device-1'));
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
    await act(async () => fireEvent.changeText(screen.getByLabelText('Mã License công khai'), 'EMU-LICENSE-1'));
    await act(async () => fireEvent.press(screen.getByText('Xác minh')));
    await waitFor(() => expect(verifyPublicLicenseMock).toHaveBeenCalledWith('EMU-LICENSE-1'));
  });
});
