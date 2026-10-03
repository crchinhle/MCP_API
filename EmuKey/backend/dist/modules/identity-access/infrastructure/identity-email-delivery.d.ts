import type { EmailDeliveryPort } from '../../operations/application/ports/email-delivery.port.js';
import type { IdentityTokenDelivery } from '../identity.service.js';
export declare class IdentityEmailDelivery implements IdentityTokenDelivery {
    private readonly email;
    constructor(email: EmailDeliveryPort);
    sendLicensingActionVerification(email: string, token: string, action: string): Promise<void>;
    sendEmailVerification(address: string, token: string): Promise<void>;
    sendPasswordReset(address: string, token: string): Promise<void>;
}
