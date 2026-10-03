import type { Redis } from 'ioredis';
import type { ActivationEnvelopeData, ActivationEnvelopePort } from '../application/ports/activation-envelope.port.js';
export declare class RedisActivationEnvelope implements ActivationEnvelopePort {
    private readonly redis;
    private readonly key;
    constructor(redis: Redis, keyHex: string);
    prepare(data: ActivationEnvelopeData, ttlSeconds: number): Promise<void>;
    exists(commandId: string): Promise<boolean>;
    consume(commandId: string): Promise<ActivationEnvelopeData | null>;
    read(commandId: string): Promise<ActivationEnvelopeData | null>;
    private decrypt;
    private aad;
    private keyName;
}
