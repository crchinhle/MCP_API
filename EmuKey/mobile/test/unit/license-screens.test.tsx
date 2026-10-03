import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import { LicensesScreen, VerifyLicenseScreen } from '../../src/presentation/EmuKeyMobileApp';
import {
  listLicenses,
  retrieveActivationKey,
  verifyPublicLicense,
} from '../../src/infrastructure/api/client';

jest.mock('../../src/infrastructure/api/client', () => ({
  listLicenses: jest.fn(),
  loadActivationKey: jest.fn().mockResolvedValue(null),
  retrieveActivationKey: jest.fn(),
  verifyPublicLicense: jest.fn(),
}));

const listLicensesMock = listLicenses as jest.MockedFunction<typeof listLicenses>;
const retrieveActivationKeyMock = retrieveActivationKey as jest.MockedFunction<typeof retrieveActivationKey>;
const verifyPublicLicenseMock = verifyPublicLicense as jest.MockedFunction<typeof verifyPublicLicense>;

describe('mobile License screens', () => {
  beforeEach(() => jest.clearAllMocks());

  it('retrieves an activation key through the authenticated customer session', async () => {
    listLicensesMock.mockResolvedValue([
      {
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
      },
    ]);
    retrieveActivationKeyMock.mockResolvedValue({
      activationKey: `0x${'aa'.repeat(32)}`,
      keyVersion: 1,
    });
    await render(<LicensesScreen />);
    await act(async () => fireEvent.press(await screen.findByText('Nhận activation key')));
    expect(retrieveActivationKeyMock).toHaveBeenCalledWith('license-1');
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
