import type { ConfigService } from '@nestjs/config';
import { type Address, type Hex } from 'viem';
import type { ReadinessProbe } from './platform-readiness.service.js';
export interface EvmReadinessClient {
    getChainId(): Promise<number>;
    getCode(input: {
        address: Address;
    }): Promise<Hex | undefined>;
}
export declare class EvmReadinessProbe implements ReadinessProbe {
    readonly name = "blockchain";
    private readonly address;
    private readonly chainId;
    private readonly client;
    constructor(config: Pick<ConfigService, 'get' | 'getOrThrow'>, client?: EvmReadinessClient);
    check(): Promise<void>;
}
