export type LicenseLifecycleCommand =
  | 'SUSPEND_LICENSE'
  | 'RESUME_LICENSE'
  | 'REVOKE_LICENSE';

export interface DeviceProofInput {
  deviceRef: string;
  devicePublicKey: string;
  proof: string;
}
