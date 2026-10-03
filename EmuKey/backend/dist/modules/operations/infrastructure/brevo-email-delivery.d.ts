import type { DeliveryReceipt, EmailDeliveryInput, EmailDeliveryPort } from '../application/ports/email-delivery.port.js';
interface BrevoSendEmailRequest {
    headers: {
        idempotencyKey: string;
    };
    htmlContent: string;
    sender: {
        email: string;
        name: string;
    };
    subject: string;
    textContent: string;
    to: Array<{
        email: string;
    }>;
}
interface BrevoSendEmailResponse {
    messageId?: string | undefined;
    messageIds?: string[] | undefined;
}
export interface BrevoEmailClient {
    transactionalEmails: {
        sendTransacEmail(request: BrevoSendEmailRequest): PromiseLike<BrevoSendEmailResponse>;
    };
}
interface BrevoEmailDeliveryOptions {
    publicWebUrl: string;
    sender: {
        email: string;
        name: string;
    };
}
export declare class BrevoEmailDelivery implements EmailDeliveryPort {
    private readonly options;
    private readonly client;
    constructor(options: BrevoEmailDeliveryOptions, client: BrevoEmailClient);
    private render;
    deliver(input: EmailDeliveryInput): Promise<DeliveryReceipt>;
}
export {};
