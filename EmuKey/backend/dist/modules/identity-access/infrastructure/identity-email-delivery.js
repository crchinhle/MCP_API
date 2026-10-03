export class IdentityEmailDelivery {
    email;
    constructor(email) {
        this.email = email;
    }
    async sendLicensingActionVerification(email, token, action) {
        await this.email.deliver({
            data: { action, token },
            eventKey: `licensing-action-verification:${email}:${action}`,
            template: 'licensing-action-verification-v1',
            to: email,
        });
    }
    async sendEmailVerification(address, token) {
        await this.email.deliver({
            data: { email: address, token },
            eventKey: `email-verification:${address}`,
            template: 'identity-email-verification-v1',
            to: address,
        });
    }
    async sendPasswordReset(address, token) {
        await this.email.deliver({
            data: { token },
            eventKey: `password-reset:${address}`,
            template: 'identity-password-reset-v1',
            to: address,
        });
    }
}
//# sourceMappingURL=identity-email-delivery.js.map