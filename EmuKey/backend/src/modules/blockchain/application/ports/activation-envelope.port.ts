import type { Hex } from 'viem';

export const ACTIVATION_ENVELOPE = Symbol('ACTIVATION_ENVELOPE');

export interface ActivationEnvelopeData {
  commandId: string;
  commitment: Hex;
  keyVersion: number;
  licenseId: string;
  secret: Hex;
}

export interface ActivationEnvelopePort {
  consume(commandId: string): Promise<ActivationEnvelopeData | null>;
  exists(commandId: string): Promise<boolean>;
  read(commandId: string): Promise<ActivationEnvelopeData | null>;
  prepare(data: ActivationEnvelopeData, ttlSeconds: number): Promise<void>;
}
