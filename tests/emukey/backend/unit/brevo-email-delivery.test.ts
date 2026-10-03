import { BrevoEmailDelivery } from '../../../../EmuKey/backend/src/modules/operations/infrastructure/brevo-email-delivery.js';

describe('BrevoEmailDelivery', () => {
  const sender = {
    email: 'no-reply@example.com',
    name: 'Emukey',
  };

  it('sends an email-verification link through the Brevo transactional API', async () => {
    const sendTransacEmail = vi
      .fn()
      .mockResolvedValue({ messageId: '<message@brevo.test>' });
    const delivery = new BrevoEmailDelivery(
      {
        publicWebUrl: 'http://localhost:5173',
        sender,
      },
      { transactionalEmails: { sendTransacEmail } },
    );

    await expect(
      delivery.deliver({
        data: { email: 'customer@example.com', token: 'verify-token' },
        eventKey: 'email-verification:customer@example.com',
        template: 'identity-email-verification-v1',
        to: 'customer@example.com',
      }),
    ).resolves.toEqual({ providerMessageId: '<message@brevo.test>' });

    expect(sendTransacEmail).toHaveBeenCalledOnce();
    const request = sendTransacEmail.mock.calls[0]?.[0] as {
      headers: { idempotencyKey: string };
      htmlContent: string;
      sender: typeof sender;
      subject: string;
      textContent: string;
      to: Array<{ email: string }>;
    };
    expect(request).toMatchObject({
      sender,
      subject: 'Xác minh email Emukey',
      to: [{ email: 'customer@example.com' }],
    });
    expect(request.headers.idempotencyKey).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    );
    expect(request.htmlContent).toContain(
      'http://localhost:5173/auth?mode=verify&amp;token=verify-token&amp;email=customer%40example.com',
    );
    expect(request.textContent).toContain(
      'http://localhost:5173/auth?mode=verify&token=verify-token&email=customer%40example.com',
    );
  });

  it('keeps the idempotency key stable for the same message and changes it for a new token', async () => {
    const sendTransacEmail = vi
      .fn()
      .mockResolvedValue({ messageId: '<message@brevo.test>' });
    const delivery = new BrevoEmailDelivery(
      { publicWebUrl: 'http://localhost:5173', sender },
      { transactionalEmails: { sendTransacEmail } },
    );
    const input = {
      data: { token: 'reset-token-1' },
      eventKey: 'password-reset:customer@example.com',
      template: 'identity-password-reset-v1',
      to: 'customer@example.com',
    };

    await delivery.deliver(input);
    await delivery.deliver(input);
    await delivery.deliver({ ...input, data: { token: 'reset-token-2' } });

    const keys = sendTransacEmail.mock.calls.map(
      ([request]) =>
        (request as { headers: { idempotencyKey: string } }).headers
          .idempotencyKey,
    );
    expect(keys[0]).toBe(keys[1]);
    expect(keys[2]).not.toBe(keys[0]);
  });

  it('includes a usable one-time token and action link for license operations', async () => {
    const sendTransacEmail = vi
      .fn()
      .mockResolvedValue({ messageId: '<license-action@brevo.test>' });
    const delivery = new BrevoEmailDelivery(
      { publicWebUrl: 'http://localhost:5173', sender },
      { transactionalEmails: { sendTransacEmail } },
    );

    await delivery.deliver({
      data: { action: 'ROTATE_KEY', token: 'license-action-token' },
      eventKey: 'licensing-action-verification:customer@example.com:ROTATE_KEY',
      template: 'licensing-action-verification-v1',
      to: 'customer@example.com',
    });

    const request = sendTransacEmail.mock.calls[0]?.[0] as {
      htmlContent: string;
      textContent: string;
    };
    expect(request.htmlContent).toContain('mode=licensing-action&amp;token=license-action-token');
    expect(request.htmlContent).toContain('<strong>license-action-token</strong>');
    expect(request.textContent).toContain('Mã xác nhận: license-action-token');
  });

  it('rejects unknown templates without calling Brevo', async () => {
    const sendTransacEmail = vi.fn();
    const delivery = new BrevoEmailDelivery(
      { publicWebUrl: 'http://localhost:5173', sender },
      { transactionalEmails: { sendTransacEmail } },
    );

    await expect(
      delivery.deliver({
        data: { token: 'token' },
        eventKey: 'unknown',
        template: 'unknown-template',
        to: 'customer@example.com',
      }),
    ).rejects.toThrow('Unsupported Brevo email template: unknown-template');
    expect(sendTransacEmail).not.toHaveBeenCalled();
  });
});
