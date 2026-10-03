import { createHash } from 'node:crypto';
const UUID_V5_DNS_NAMESPACE = Buffer.from('6ba7b8109dad11d180b400c04fd430c8', 'hex');
function escapeHtml(value) {
    return value
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#39;');
}
function deterministicUuid(value) {
    const bytes = createHash('sha1')
        .update(UUID_V5_DNS_NAMESPACE)
        .update(value)
        .digest()
        .subarray(0, 16);
    bytes[6] = (bytes[6] & 0x0f) | 0x50;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;
    const hex = bytes.toString('hex');
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
function requiredToken(input) {
    const token = input.data.token;
    if (typeof token !== 'string' || token.trim() === '') {
        throw new Error(`Email template ${input.template} requires a token`);
    }
    return token;
}
export class BrevoEmailDelivery {
    options;
    client;
    constructor(options, client) {
        this.options = options;
        this.client = client;
    }
    render(input) {
        const token = requiredToken(input);
        const url = new URL('/auth', this.options.publicWebUrl);
        if (input.template === 'identity-email-verification-v1') {
            url.searchParams.set('mode', 'verify');
            url.searchParams.set('token', token);
            if (typeof input.data.email === 'string' && input.data.email.trim() !== '') {
                url.searchParams.set('email', input.data.email.trim());
            }
            const verificationUrl = url.toString();
            const testRunId = typeof input.data.testRunId === 'string' ? input.data.testRunId : undefined;
            return {
                htmlContent: `<p>Chào bạn,</p><p>Nhấn vào liên kết sau để xác minh tài khoản Emukey:</p><p><a href="${escapeHtml(verificationUrl)}">Xác minh email</a></p><p>Liên kết có hiệu lực trong 24 giờ.</p>`,
                subject: testRunId ? `[EmuKey E2E] ${testRunId} - Xác minh email Emukey` : 'Xác minh email Emukey',
                textContent: `Chào bạn,\n\nMở liên kết sau để xác minh tài khoản Emukey:\n${verificationUrl}\n\nLiên kết có hiệu lực trong 24 giờ.`,
                token,
            };
        }
        if (input.template === 'licensing-action-verification-v1') {
            url.searchParams.set('mode', 'licensing-action');
            url.searchParams.set('token', token);
            const verificationUrl = url.toString();
            const action = typeof input.data.action === 'string' ? input.data.action : 'licensing operation';
            return {
                htmlContent: `<p>Chào bạn,</p><p>Nhấn vào liên kết sau để xác nhận thao tác ${escapeHtml(action)} trên giấy phép Emukey:</p><p><a href="${escapeHtml(verificationUrl)}">Xác nhận thao tác</a></p><p>Mã xác nhận: <strong>${escapeHtml(token)}</strong></p><p>Mã xác nhận có hiệu lực trong 15 phút và chỉ sử dụng một lần.</p>`,
                subject: 'Xác nhận thao tác giấy phép Emukey',
                textContent: `Chào bạn,\n\nMở liên kết sau để xác nhận thao tác ${action}:\n${verificationUrl}\n\nMã xác nhận: ${token}\n\nMã có hiệu lực trong 15 phút và chỉ sử dụng một lần.`,
                token,
            };
        }
        if (input.template === 'identity-password-reset-v1') {
            url.searchParams.set('mode', 'reset');
            url.searchParams.set('token', token);
            const resetUrl = url.toString();
            return {
                htmlContent: `<p>Chào bạn,</p><p>Nhấn vào liên kết sau để đặt lại mật khẩu Emukey:</p><p><a href="${escapeHtml(resetUrl)}">Đặt lại mật khẩu</a></p><p>Mã đặt lại mật khẩu: <strong>${escapeHtml(token)}</strong></p><p>Liên kết và mã có hiệu lực trong 1 giờ.</p>`,
                subject: 'Đặt lại mật khẩu Emukey',
                textContent: `Chào bạn,\n\nMở liên kết sau để đặt lại mật khẩu Emukey:\n${resetUrl}\n\nMã đặt lại mật khẩu: ${token}\n\nLiên kết và mã có hiệu lực trong 1 giờ.`,
                token,
            };
        }
        throw new Error(`Unsupported Brevo email template: ${input.template}`);
    }
    async deliver(input) {
        const rendered = this.render(input);
        const response = await this.client.transactionalEmails.sendTransacEmail({
            headers: {
                idempotencyKey: deterministicUuid(`${input.eventKey}\0${input.template}\0${rendered.token}`),
            },
            htmlContent: rendered.htmlContent,
            sender: this.options.sender,
            subject: rendered.subject,
            textContent: rendered.textContent,
            to: [{ email: input.to }],
        });
        const providerMessageId = response.messageId ?? response.messageIds?.[0];
        if (!providerMessageId) {
            throw new Error('Brevo did not return a message ID');
        }
        return { providerMessageId };
    }
}
//# sourceMappingURL=brevo-email-delivery.js.map