import { createSign } from 'node:crypto';

import type { DeliveryReceipt } from '../application/ports/email-delivery.port.js';
import type { PushDeliveryInput, PushDeliveryPort } from '../application/ports/push-delivery.port.js';

interface FcmOptions {
  projectId: string;
  clientEmail: string;
  privateKey: string;
  timeoutMs: number;
}

interface TokenState {
  accessToken: string;
  expiresAt: number;
}

export class FcmPushDelivery implements PushDeliveryPort {
  private tokenState: TokenState | undefined;

  constructor(private readonly options: FcmOptions) {}

  async verifyProvider(): Promise<void> {
    await this.accessToken();
  }

  async deliver(input: PushDeliveryInput): Promise<DeliveryReceipt> {
    const accessToken = await this.accessToken();
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.options.timeoutMs);
    try {
      const response = await fetch(`https://fcm.googleapis.com/v1/projects/${encodeURIComponent(this.options.projectId)}/messages:send`, {
        method: 'POST',
        headers: { authorization: `Bearer ${accessToken}`, 'content-type': 'application/json' },
        body: JSON.stringify({ message: { token: input.token, notification: { title: input.title, body: input.body }, data: stringifyData(input.data) } }),
        signal: controller.signal,
      });
      if (!response.ok) {
        const error = await response.text();
        const failure = new Error(`FCM_${response.status}`);
        if (response.status === 404 || response.status === 400 && /UNREGISTERED|INVALID_ARGUMENT/u.test(error)) failure.name = 'INVALID_PUSH_TOKEN';
        throw failure;
      }
      const result = await response.json() as { name?: string };
      if (!result.name) throw new Error('FCM_MISSING_MESSAGE_NAME');
      return { providerMessageId: result.name };
    } finally {
      clearTimeout(timeout);
    }
  }

  private async accessToken(): Promise<string> {
    if (this.tokenState && this.tokenState.expiresAt > Date.now() + 60_000) return this.tokenState.accessToken;
    const now = Math.floor(Date.now() / 1000);
    const header = base64Url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
    const claim = base64Url(JSON.stringify({ iss: this.options.clientEmail, scope: 'https://www.googleapis.com/auth/firebase.messaging', aud: 'https://oauth2.googleapis.com/token', iat: now, exp: now + 3600 }));
    const signer = createSign('RSA-SHA256');
    signer.update(`${header}.${claim}`);
    const assertion = `${header}.${claim}.${base64Url(signer.sign(this.options.privateKey))}`;
    const body = new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion });
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.options.timeoutMs);
    try {
      const response = await fetch('https://oauth2.googleapis.com/token', { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body, signal: controller.signal });
      if (!response.ok) throw new Error(`FCM_OAUTH_${response.status}`);
      const result = await response.json() as { access_token?: string; expires_in?: number };
      if (!result.access_token) throw new Error('FCM_OAUTH_MISSING_TOKEN');
      this.tokenState = { accessToken: result.access_token, expiresAt: Date.now() + (result.expires_in ?? 3600) * 1000 };
      return result.access_token;
    } finally {
      clearTimeout(timeout);
    }
  }
}

function base64Url(value: string | Buffer): string {
  return Buffer.from(value).toString('base64url');
}

function stringifyData(data: Record<string, unknown>): Record<string, string> {
  return Object.fromEntries(Object.entries(data).map(([key, value]) => [key, typeof value === 'string' ? value : JSON.stringify(value)]));
}
