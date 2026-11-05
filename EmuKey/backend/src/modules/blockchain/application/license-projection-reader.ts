export interface EntitlementContext {
  bindingGeneration: number;
  deviceStatus: string;
  entitlementVersion: number;
  entitlements: Record<string, unknown>;
  expiresAt: Date;
  licenseFinality: string;
  keyVersion: number;
  status: string;
}

/** Published canonical projection queries consumed by Licensing. */
export abstract class LicenseProjectionReader {
  abstract entitlementContext(licenseId: string, deviceId: string): Promise<EntitlementContext | null>;
}
