import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import { LicensesScreen, VerifyLicenseScreen } from '../../../../EmuKey/mobile/src/presentation/EmuKeyMobileApp';
import {
  listLicenses,
  listDevices,
  remoteRevokeDevice,
  verifyPublicLicense,
} from '../../../../EmuKey/mobile/src/infrastructure/api/client';

jest.mock('../../../../EmuKey/mobile/src/infrastructure/api/client', () => ({
  listLicenses: jest.fn(),
  listDevices: jest.fn().mockResolvedValue([]),
  remoteRevokeDevice: jest.fn(),
  requestLicensingActionVerification: jest.fn().mockResolvedValue({ accepted: true }),
  verifyPublicLicense: jest.fn(),
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

  it('manages licenses and devices without exposing an activation-key retrieval or self-activation CTA', async () => {
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
    expect(await screen.findByText(/playwright-device · ACTIVE/)).toBeOnTheScreen();
    await act(async () => fireEvent.changeText(screen.getByLabelText('Mật khẩu hiện tại'), 'CurrentPassword1!'));
    await act(async () => fireEvent.changeText(screen.getByLabelText('Action token'), 'remote-action-token'));
    remoteRevokeDeviceMock.mockResolvedValue({
      ...listDevicesMock.mock.results[0]?.value,
      activatedAt: '2026-09-10T00:01:00.000Z',
      bindingGeneration: 1,
      deviceRef: 'playwright-device',
      id: 'device-1',
      licenseId: 'license-1',
      revokedAt: '2026-09-10T00:02:00.000Z',
      status: 'REVOKED',
    } as Awaited<ReturnType<typeof remoteRevokeDevice>>);
    await act(async () => fireEvent.press(screen.getByText('Thu hồi thiết bị')));
    await waitFor(() => expect(remoteRevokeDeviceMock).toHaveBeenCalledWith('license-1', 'device-1', {
      actionToken: 'remote-action-token',
      currentPassword: 'CurrentPassword1!',
    }));
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
