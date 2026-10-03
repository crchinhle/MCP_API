import type { DeliveryReceipt } from '../application/ports/email-delivery.port.js';
import type { PushDeliveryInput, PushDeliveryPort } from '../application/ports/push-delivery.port.js';
interface FcmOptions {
    projectId: string;
    clientEmail: string;
    privateKey: string;
    timeoutMs: number;
}
export declare class FcmPushDelivery implements PushDeliveryPort {
    private readonly options;
    private tokenState;
    constructor(options: FcmOptions);
    verifyProvider(): Promise<void>;
    deliver(input: PushDeliveryInput): Promise<DeliveryReceipt>;
    private accessToken;
}
export {};
