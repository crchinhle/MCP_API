import { type Address, type Hex } from 'viem';
export declare const DOMAIN_PLAN_V2: `0x${string}`;
export declare function canonicalizeEntitlements(value: unknown): string;
export declare function entitlementsHash(value: unknown): Hex;
export declare function uuidToBytes16(value: string): Hex;
export interface PlanCommitmentInput {
    durationMonths: number;
    entitlements: unknown;
    maxActiveDevices: number;
    planId: string;
    planVersion: number;
    productId: string;
    providerChainAddress: Address;
}
export declare function planCommitment(input: PlanCommitmentInput): Hex;
export declare function activationCommitment(secret32: Hex): Hex;
