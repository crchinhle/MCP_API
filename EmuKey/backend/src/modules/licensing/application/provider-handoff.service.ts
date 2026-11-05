import { randomUUID } from 'node:crypto';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  GoneException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import type { AuthPrincipal } from '../../identity-access/identity.types.js';
import type { PoolClient } from 'pg';
import { activationCommitment } from '../../../platform/crypto/license-crypto.js';
import { NotificationWriter } from '../../operations/application/notification-writer.js';
import { ProviderDeliveryRepository } from '../infrastructure/provider-delivery.repository.js';
import { ProviderIntegrationRepository } from '../infrastructure/provider-integration.repository.js';
import { LicenseSecretCodec } from '../infrastructure/license-secret-codec.js';
import {
  ProviderTransportError,
  type ProviderLicenseGatewayPort,
} from './ports/provider-license-gateway.port.js';
import { ProviderIntegrationService } from './provider-integration.service.js';
import {
  canReceiveProviderKey,
  deliveryRetryDelay,
  validProviderReceipt,
  type ProviderLicenseMessage,
} from '../domain/provider-delivery-policy.js';

/** Published application boundary used by commerce and blockchain in their transaction. */
export class ProviderHandoffService {
  private readonly logger = new Logger(ProviderHandoffService.name);
  constructor(
    readonly deliveries: ProviderDeliveryRepository,
    private readonly integrations: ProviderIntegrationRepository,
    private readonly codec: LicenseSecretCodec,
    private readonly gateway: ProviderLicenseGatewayPort,
    private readonly config: ProviderIntegrationService,
    private readonly notifications: NotificationWriter,
    readonly enabled = true,
  ) {}

  requireReady(tx: PoolClient, providerId: string) {
    if (!this.enabled)
      throw new ConflictException({ code: 'PROVIDER_HANDOFF_DISABLED' });
    return this.deliveries.requireReady(tx, providerId);
  }

  async isProviderManaged(licenseId: string): Promise<boolean> {
    return (await this.deliveries.mode(licenseId)) === 'PROVIDER_HANDOFF';
  }

  listDeliveries(actor: AuthPrincipal, status?: string, offset = 0) {
    if (
      !['PROVIDER_ADMIN', 'SYSTEM_ADMIN', 'SUPPORT_STAFF'].includes(actor.role)
    )
      throw new ForbiddenException();
    return this.deliveries.list(
      actor.role === 'PROVIDER_ADMIN' ? actor.sub : undefined,
      status,
      offset,
    );
  }

  async retryDelivery(actor: AuthPrincipal, id: string, reason: string) {
    if (!['PROVIDER_ADMIN', 'SYSTEM_ADMIN'].includes(actor.role))
      throw new ForbiddenException();
    const trimmed = reason.trim();
    if (trimmed.length < 3 || trimmed.length > 1000)
      throw new BadRequestException({
        code: 'PROVIDER_DELIVERY_REASON_REQUIRED',
      });
    if (
      !(await this.deliveries.retry(
        id,
        actor.role === 'PROVIDER_ADMIN' ? actor.sub : null,
        trimmed,
        actor.sub,
      ))
    )
      throw new ConflictException({
        code: 'PROVIDER_DELIVERY_RETRY_NOT_ALLOWED',
      });
    return { queued: true };
  }

  async hasDurableCommandKey(command: {
    commandId: string;
    licenseId: string;
    payload: Record<string, unknown>;
  }): Promise<boolean> {
    if ((await this.deliveries.mode(command.licenseId)) !== 'PROVIDER_HANDOFF')
      return false;
    const version = Number(command.payload.keyVersion);
    const row = await this.deliveries.keyMaterial(command.licenseId, version);
    if (!row || row.command_id !== command.commandId)
      throw new Error('PROVIDER_KEY_MATERIAL_MISSING');
    const secret = this.codec.decrypt(
      {
        ciphertext: row.ciphertext,
        iv: row.iv,
        authTag: row.auth_tag,
        keyId: row.encryption_key_id,
      },
      `${command.licenseId}:${version}`,
    );
    if (
      activationCommitment(secret as `0x${string}`) !==
      command.payload.activationCommitment
    )
      throw new Error('PROVIDER_KEY_COMMITMENT_MISMATCH');
    return true;
  }

  async persistKey(
    tx: PoolClient,
    input: {
      licenseId: string;
      commandId: string;
      keyVersion: number;
      commitment: string;
      secret: string;
    },
  ) {
    if (
      (await this.deliveries.mode(input.licenseId, tx)) !== 'PROVIDER_HANDOFF'
    )
      return;
    if (
      activationCommitment(input.secret as `0x${string}`) !== input.commitment
    )
      throw new Error('KEY_COMMITMENT_MISMATCH');
    await this.deliveries.storeKey(
      tx,
      input,
      this.codec.encrypt(
        input.secret,
        `${input.licenseId}:${input.keyVersion}`,
      ),
    );
  }

  async publish(tx: PoolClient, licenseId: string, eventType: string) {
    const row = await this.deliveries.snapshotBasis(tx, licenseId);
    if (!row) return;
    const revision = Number(row.provider_revision) + 1;
    if (!Number.isSafeInteger(revision))
      throw new Error('PROVIDER_REVISION_OVERFLOW');
    const publishedType =
      (
        {
          LICENSE_ISSUED: 'ISSUED',
          LICENSE_RENEWED: 'RENEWED',
          KEY_ROTATED: 'KEY_REPLACED',
          LICENSE_SUSPENDED: 'SUSPENDED',
          LICENSE_RESUMED: 'RESUMED',
          LICENSE_REVOKED: 'REVOKED',
        } as Record<string, string>
      )[eventType] ?? 'TRUST_CHANGED';
    const message: Omit<ProviderLicenseMessage, 'licenseKey'> = {
      schemaVersion: 1,
      deliveryId: randomUUID(),
      eventType: publishedType,
      revision,
      providerId: String(row.provider_user_id),
      productId: String(row.product_id),
      licenseId,
      publicLicenseId: String(row.public_license_id),
      keyVersion: Number(row.activation_key_version),
      plan: {
        id: String(row.plan_id),
        version: Number(row.plan_version_snapshot),
        entitlements: row.entitlements_snapshot as Record<string, unknown>,
        maxDevices: Number(row.max_active_devices),
      },
      periodStart: new Date(String(row.period_start)).toISOString(),
      expiresAt: new Date(String(row.expires_at)).toISOString(),
      status:
        row.status === 'PENDING_ONCHAIN' ? 'SUSPENDED' : String(row.status),
      usable:
        row.status === 'ACTIVE' &&
        row.activation_key_trust_status === 'TRUSTED' &&
        new Date(String(row.expires_at)) > new Date(),
    };
    await this.deliveries.recordSnapshot(
      tx,
      licenseId,
      eventType,
      row,
      message,
    );
  }

  async rejectProductUse(licenseId: string) {
    if ((await this.deliveries.mode(licenseId)) === 'PROVIDER_HANDOFF')
      throw new GoneException({ code: 'LICENSE_USE_MANAGED_BY_PROVIDER' });
  }

  async customerInfo(customerId: string, licenseId: string) {
    const row = await this.deliveries.customerBasis(customerId, licenseId);
    if (!row || row.fulfillment_mode !== 'PROVIDER_HANDOFF') return null;
    const ready =
      row.delivery_status === 'DELIVERED' &&
      canReceiveProviderKey({
        status: String(row.status),
        trust: String(row.activation_key_trust_status),
        expiresAt: new Date(String(row.expires_at)),
        revision: Number(row.provider_revision),
        acceptedRevision: Number(row.accepted_revision),
      });
    return {
      fulfillmentMode: 'PROVIDER_HANDOFF' as const,
      providerDeliveryStatus: row.delivery_status ?? 'PENDING',
      providerRevision: Number(row.provider_revision),
      providerAcceptedRevision:
        row.delivery_status === 'DELIVERED'
          ? Number(row.accepted_revision)
          : null,
      providerAcceptedAt: row.accepted_at
        ? new Date(String(row.accepted_at)).toISOString()
        : null,
      keyAvailable: ready,
      keyVersion: Number(row.activation_key_version),
    };
  }

  async readCustomerKey(customerId: string, licenseId: string) {
    const info = await this.customerInfo(customerId, licenseId);
    if (!info?.keyAvailable)
      throw new ConflictException({ code: 'PROVIDER_DELIVERY_NOT_READY' });
    const row = await this.deliveries.keyMaterial(licenseId, info.keyVersion);
    if (!row) throw new NotFoundException({ code: 'KEY_UNAVAILABLE' });
    return {
      commandId: String(row.command_id),
      keyVersion: info.keyVersion,
      licenseId,
      commitment: `0x${row.commitment.toString('hex')}`,
      secret: this.codec.decrypt(
        {
          ciphertext: row.ciphertext,
          iv: row.iv,
          authTag: row.auth_tag,
          keyId: row.encryption_key_id,
        },
        `${licenseId}:${info.keyVersion}`,
      ),
    };
  }

  async runOne(): Promise<boolean> {
    const row = await this.deliveries.claim();
    if (!row) return false;
    const started = Date.now();
    try {
      const integration = await this.integrations.find(row.provider_user_id);
      if (
        !integration ||
        integration.config_version !== row.config_version ||
        integration.status !== 'ENABLED'
      )
        throw new ProviderTransportError('PROVIDER_CONFIG_CHANGED');
      const key = await this.deliveries.keyMaterial(
        row.license_id,
        row.key_version,
      );
      if (!key) throw new ProviderTransportError('KEY_MATERIAL_MISSING');
      const secret = this.codec.decrypt(
        {
          ciphertext: key.ciphertext,
          iv: key.iv,
          authTag: key.auth_tag,
          keyId: key.encryption_key_id,
        },
        `${row.license_id}:${row.key_version}`,
      );
      const message = { ...row.snapshot, licenseKey: secret };
      const receipt = await this.gateway.send(
        integration.endpoint_url,
        this.config.credential(integration),
        message,
        row.id,
      );
      if (!validProviderReceipt(receipt, message))
        throw new ProviderTransportError('PROVIDER_RECEIPT_INVALID');
      const completed = await this.deliveries.complete(
        row,
        receipt.receiptId,
        async (tx) => {
          const owner = await this.deliveries.customerForCurrentRevision(
            tx,
            row.license_id,
            Number(row.revision),
          );
          if (!owner) return;
          await this.notifications.enqueueInTransaction(tx, {
            userId: owner,
            channel: 'IN_APP',
            type: 'LICENSE_PROVIDER_ACCEPTED',
            title: 'Nhà cung cấp đã nhận bản quyền',
            content:
              'Thông tin bản quyền đã được đồng bộ. Mở bản quyền để xem trạng thái hiện tại.',
            eventKey: `provider:${row.id}:accepted`,
            data: { licenseId: row.license_id },
          });
        },
      );
      this.logger.log({
        event: completed
          ? 'provider.delivery.accepted'
          : 'provider.delivery.stale_ack',
        deliveryId: row.id,
        licenseId: row.license_id,
        revision: Number(row.revision),
        attempt: row.attempt_count,
        durationMs: Date.now() - started,
      });
    } catch (error) {
      const known = error instanceof ProviderTransportError;
      const delay =
        known && error.retryable ? deliveryRetryDelay(row.attempt_count) : null;
      const code = known ? error.code : 'PROVIDER_DELIVERY_INTERNAL_ERROR';
      await this.deliveries.fail(
        row,
        code,
        delay === null
          ? null
          : Math.max(delay, known ? (error.retryAfterMs ?? 0) : 0),
      );
      this.logger.warn({
        event: 'provider.delivery.failed',
        deliveryId: row.id,
        licenseId: row.license_id,
        revision: Number(row.revision),
        attempt: row.attempt_count,
        code,
        retryScheduled: delay !== null,
        durationMs: Date.now() - started,
      });
    }
    return true;
  }
}
