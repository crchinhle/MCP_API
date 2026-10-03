import type { EmailDeliveryPort } from '../../operations/application/ports/email-delivery.port.js';
import type { IdentityTokenDelivery } from '../identity.service.js';

export class IdentityEmailDelivery implements IdentityTokenDelivery {
  constructor(private readonly email: EmailDeliveryPort) {}

  async sendLicensingActionVerification(email: string, token: string, action: string): Promise<void> {
    await this.email.deliver({
      data: { action, token },
      eventKey: `licensing-action-verification:${email}:${action}`,
      template: 'licensing-action-verification-v1',
      to: email,
    });
  }

  async sendEmailVerification(address: string, token: string): Promise<void> {
    await this.email.deliver({
      data: { email: address, token },
      eventKey: `email-verification:${address}`,
      template: 'identity-email-verification-v1',
      to: address,
    });
  }

  async sendPasswordReset(address: string, token: string): Promise<void> {
    await this.email.deliver({
      data: { token },
      eventKey: `password-reset:${address}`,
      template: 'identity-password-reset-v1',
      to: address,
    });
  }
}
