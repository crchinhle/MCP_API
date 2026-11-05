import { randomUUID } from 'node:crypto';
import { BadRequestException, ConflictException } from '@nestjs/common';
import {
  ProviderIntegrationRepository,
  type ProviderIntegrationRow,
} from '../infrastructure/provider-integration.repository.js';
import { LicenseSecretCodec } from '../infrastructure/license-secret-codec.js';
import type { ProviderLicenseGatewayPort } from './ports/provider-license-gateway.port.js';

export class ProviderIntegrationService {
  constructor(
    private readonly repository: ProviderIntegrationRepository,
    private readonly codec: LicenseSecretCodec,
    private readonly gateway: ProviderLicenseGatewayPort,
  ) {}

  async get(providerId: string) {
    const row = await this.repository.find(providerId);
    return row
      ? {
          endpointUrl: row.endpoint_url,
          configVersion: row.config_version,
          status: row.status,
          verifiedAt: row.verified_at?.toISOString() ?? null,
          authorizedAt: row.authorized_at.toISOString(),
          hasCredential: true,
        }
      : {
          endpointUrl: '',
          configVersion: 0,
          status: 'DISABLED',
          verifiedAt: null,
          authorizedAt: null,
          hasCredential: false,
        };
  }
  async save(
    providerId: string,
    input: {
      endpointUrl: string;
      token?: string;
      configVersion: number;
      authorized: boolean;
    },
  ) {
    if (input.authorized !== true)
      throw new BadRequestException({
        code: 'PROVIDER_AUTHORIZATION_REQUIRED',
      });
    try {
      this.gateway.validateEndpoint(input.endpointUrl);
    } catch {
      throw new BadRequestException({ code: 'PROVIDER_URL_INVALID' });
    }
    if (input.configVersion === 0 && !input.token)
      throw new BadRequestException({ code: 'PROVIDER_CREDENTIAL_REQUIRED' });
    const secret = input.token
      ? this.codec.encrypt(input.token, `provider:${providerId}`)
      : null;
    if (
      !(await this.repository.save(
        providerId,
        input.endpointUrl,
        secret,
        input.configVersion,
      ))
    )
      throw new ConflictException({ code: 'PROVIDER_CONFIG_CHANGED' });
    return this.get(providerId);
  }
  credential(row: ProviderIntegrationRow): string {
    return this.codec.decrypt(
      {
        ciphertext: row.credential_ciphertext,
        iv: row.credential_iv,
        authTag: row.credential_tag,
        keyId: row.encryption_key_id,
      },
      `provider:${row.provider_user_id}`,
    );
  }
  async test(providerId: string) {
    const row = await this.repository.find(providerId);
    if (!row)
      throw new ConflictException({ code: 'PROVIDER_INTEGRATION_REQUIRED' });
    const nonce = randomUUID();
    let reply: unknown;
    try {
      reply = await this.gateway.send(
        row.endpoint_url,
        this.credential(row),
        { schemaVersion: 1, type: 'CONNECTION_TEST', providerId, nonce },
        nonce,
      );
    } catch {
      throw new BadRequestException({
        code: 'PROVIDER_CONNECTION_TEST_FAILED',
      });
    }
    const result = reply as Record<string, unknown> | null;
    if (
      !result ||
      result.schemaVersion !== 1 ||
      result.type !== 'CONNECTION_TEST_ACK' ||
      result.providerId !== providerId ||
      result.nonce !== nonce
    )
      throw new BadRequestException({ code: 'PROVIDER_PROBE_INVALID' });
    if (!(await this.repository.verify(providerId, row.config_version)))
      throw new ConflictException({ code: 'PROVIDER_CONFIG_CHANGED' });
    return this.get(providerId);
  }
  async state(providerId: string, version: number, enabled: boolean) {
    if (!(await this.repository.setEnabled(providerId, version, enabled)))
      throw new ConflictException({ code: 'PROVIDER_CONFIG_NOT_VERIFIED' });
    return this.get(providerId);
  }
}
