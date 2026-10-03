import { PassThrough } from 'node:stream';

import pino from 'pino';

import { REDACTED_LOG_PATHS } from '../../../src/platform/observability/log-redaction.js';

describe('structured log redaction', () => {
  it('never emits authentication, payment or activation secrets', async () => {
    const sentinel = 'sentinel-secret-must-never-be-logged';
    const stream = new PassThrough();
    let output = '';
    stream.on('data', (chunk: Buffer) => {
      output += chunk.toString('utf8');
    });
    const logger = pino(
      { redact: { paths: [...REDACTED_LOG_PATHS], censor: '[REDACTED]' } },
      stream,
    );

    logger.info({
      req: {
        body: {
          activationKey: sentinel,
          activationSecret: sentinel,
          currentPassword: sentinel,
          envelope: sentinel,
          password: sentinel,
          passwordConfirmation: sentinel,
          rawPayload: sentinel,
          rawIpnSecret: sentinel,
          relayerKeyMaterial: sentinel,
          signature: sentinel,
          token: sentinel,
        },
        headers: {
          authorization: sentinel,
          cookie: sentinel,
          'x-license-key': sentinel,
        },
      },
    });
    await new Promise<void>((resolve) => stream.end(resolve));

    expect(output).not.toContain(sentinel);
    expect(output).toContain('[REDACTED]');
  });
});
