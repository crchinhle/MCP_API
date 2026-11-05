import { randomUUID } from 'node:crypto';
import type { Pool, PoolClient } from 'pg';
import type { ProviderLicenseMessage } from '../domain/provider-delivery-policy.js';
import type { EncryptedLicenseSecret } from './license-secret-codec.js';

export interface ProviderDeliveryRow {
  id: string;
  license_id: string;
  provider_user_id: string;
  integration_id: string;
  config_version: number;
  revision: string;
  key_version: number;
  snapshot: Omit<ProviderLicenseMessage, 'licenseKey'>;
  attempt_count: number;
  lease_token: string;
}
interface KeyMaterialRow {
  command_id: string;
  commitment: Buffer;
  ciphertext: string;
  iv: string;
  auth_tag: string;
  encryption_key_id: string;
}
interface CustomerHandoffBasis {
  status: string;
  expires_at: Date;
  activation_key_trust_status: string;
  provider_revision: string;
  activation_key_version: number;
  fulfillment_mode: string;
  delivery_status: string | null;
  accepted_at: Date | null;
  accepted_revision: string | null;
}

export class ProviderDeliveryRepository {
  constructor(private readonly pool: Pool) {}

  async requireReady(client: PoolClient, providerId: string) {
    const result = await client.query(
      `SELECT id FROM provider_integrations WHERE provider_user_id=$1
      AND status='ENABLED' AND verified_config_version=config_version FOR SHARE`,
      [providerId],
    );
    if (!result.rows[0]) throw new Error('PROVIDER_INTEGRATION_NOT_READY');
  }

  async storeKey(
    client: PoolClient,
    input: {
      licenseId: string;
      commandId: string;
      keyVersion: number;
      commitment: string;
    },
    secret: EncryptedLicenseSecret,
  ) {
    await client.query(
      `INSERT INTO license_key_materials
      (license_id,key_version,command_id,commitment,ciphertext,iv,auth_tag,encryption_key_id)
      VALUES ($1,$2,$3,decode($4,'hex'),$5,$6,$7,$8)`,
      [
        input.licenseId,
        input.keyVersion,
        input.commandId,
        input.commitment.slice(2),
        secret.ciphertext,
        secret.iv,
        secret.authTag,
        secret.keyId,
      ],
    );
  }

  async snapshotBasis(client: PoolClient, licenseId: string) {
    return (
      (
        await client.query<Record<string, unknown>>(
          `SELECT l.*,o.plan_version_snapshot,o.entitlements_snapshot,
      i.id AS integration_id,i.config_version FROM licenses l JOIN orders o ON o.id=l.origin_order_id
      JOIN provider_integrations i ON i.provider_user_id=l.provider_user_id
      WHERE l.id=$1 AND l.fulfillment_mode='PROVIDER_HANDOFF' FOR UPDATE OF l`,
          [licenseId],
        )
      ).rows[0] ?? null
    );
  }

  async recordSnapshot(
    client: PoolClient,
    licenseId: string,
    eventType: string,
    basis: Record<string, unknown>,
    message: Omit<ProviderLicenseMessage, 'licenseKey'>,
  ) {
    await client.query(`UPDATE licenses SET provider_revision=$2 WHERE id=$1`, [
      licenseId,
      message.revision,
    ]);
    await client.query(
      `UPDATE provider_license_deliveries SET status='SUPERSEDED',
        lease_token=NULL,lease_expires_at=NULL,updated_at=now()
      WHERE license_id=$1 AND status IN ('PENDING','SENDING','RETRY_WAIT','FAILED')`,
      [licenseId],
    );
    await client.query(
      `INSERT INTO provider_license_deliveries
      (id,license_id,provider_user_id,integration_id,config_version,revision,key_version,event_type,snapshot)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [
        message.deliveryId,
        licenseId,
        basis.provider_user_id,
        basis.integration_id,
        basis.config_version,
        message.revision,
        message.keyVersion,
        eventType,
        JSON.stringify(message),
      ],
    );
  }

  async keyMaterial(
    licenseId: string,
    keyVersion: number,
    client: Pool | PoolClient = this.pool,
  ) {
    return (
      (
        await client.query<KeyMaterialRow>(
          `SELECT * FROM license_key_materials WHERE license_id=$1 AND key_version=$2`,
          [licenseId, keyVersion],
        )
      ).rows[0] ?? null
    );
  }

  async mode(
    licenseId: string,
    client: Pool | PoolClient = this.pool,
  ): Promise<string | null> {
    return (
      (
        await client.query<{ fulfillment_mode: string }>(
          'SELECT fulfillment_mode FROM licenses WHERE id=$1',
          [licenseId],
        )
      ).rows[0]?.fulfillment_mode ?? null
    );
  }

  async customerBasis(customerId: string, licenseId: string) {
    return (
      (
        await this.pool.query<CustomerHandoffBasis>(
          `SELECT l.status,l.expires_at,l.activation_key_trust_status,l.provider_revision,
      l.activation_key_version,l.activation_commitment,l.fulfillment_mode,
      d.status AS delivery_status,d.accepted_at,d.revision AS accepted_revision
      FROM licenses l LEFT JOIN provider_license_deliveries d ON d.license_id=l.id AND d.revision=l.provider_revision
      WHERE l.id=$1 AND l.customer_user_id=$2`,
          [licenseId, customerId],
        )
      ).rows[0] ?? null
    );
  }

  async complete(
    row: ProviderDeliveryRow,
    receiptId: string,
    notify?: (client: PoolClient) => Promise<void>,
  ): Promise<boolean> {
    return this.transaction(async (client) => {
      const result = await client.query(
        `UPDATE provider_license_deliveries SET status='DELIVERED',receipt_id=$3,accepted_at=now(),
        lease_token=NULL,lease_expires_at=NULL,last_error_code=NULL,updated_at=now()
        WHERE id=$1 AND lease_token=$2 AND status='SENDING' AND lease_expires_at>now() RETURNING id`,
        [row.id, row.lease_token, receiptId],
      );
      if (!result.rowCount) return false;
      await client.query(
        'UPDATE license_key_materials SET retired_at=coalesce(retired_at,now()) WHERE license_id=$1 AND key_version<$2',
        [row.license_id, row.key_version],
      );
      if (notify) await notify(client);
      return true;
    });
  }

  async customerForCurrentRevision(
    client: PoolClient,
    licenseId: string,
    revision: number,
  ): Promise<string | null> {
    return (
      (
        await client.query<{ customer_user_id: string }>(
          'SELECT customer_user_id FROM licenses WHERE id=$1 AND provider_revision=$2',
          [licenseId, revision],
        )
      ).rows[0]?.customer_user_id ?? null
    );
  }

  async fail(row: ProviderDeliveryRow, code: string, delay: number | null) {
    await this.pool.query(
      `UPDATE provider_license_deliveries SET status=$3,last_error_code=$4,
      next_attempt_at=now()+($5::float8 * interval '1 millisecond'),lease_token=NULL,lease_expires_at=NULL,updated_at=now()
      WHERE id=$1 AND lease_token=$2 AND status='SENDING'`,
      [
        row.id,
        row.lease_token,
        delay === null ? 'FAILED' : 'RETRY_WAIT',
        code,
        delay ?? 0,
      ],
    );
  }

  async retry(
    id: string,
    providerId: string | null,
    reason: string,
    actorId?: string,
  ): Promise<boolean> {
    return (
      (
        await this.pool.query(
          `UPDATE provider_license_deliveries d SET status='PENDING',attempt_count=0,next_attempt_at=now(),
      last_error_code='MANUAL_RETRY',last_retry_reason=$3,retried_by=$4,config_version=i.config_version,updated_at=now()
      FROM provider_integrations i,licenses l WHERE d.id=$1 AND ($2::uuid IS NULL OR d.provider_user_id=$2)
      AND d.integration_id=i.id AND l.id=d.license_id AND l.provider_revision=d.revision
      AND i.status='ENABLED' AND i.verified_config_version=i.config_version AND d.status IN ('FAILED','RETRY_WAIT')
      AND length($3)>=3 RETURNING d.id`,
          [id, providerId, reason, actorId ?? providerId],
        )
      ).rowCount === 1
    );
  }

  async transaction<T>(work: (client: PoolClient) => Promise<T>): Promise<T> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const result = await work(client);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async claim(): Promise<ProviderDeliveryRow | null> {
    await this.pool
      .query(`UPDATE provider_license_deliveries SET status='FAILED',last_error_code='PROVIDER_LEASE_EXHAUSTED',
      lease_token=NULL,lease_expires_at=NULL,updated_at=now() WHERE status='SENDING' AND lease_expires_at<=now() AND attempt_count>=8`);
    const result = await this.pool.query<ProviderDeliveryRow>(
      `WITH candidate AS (
      SELECT d.id FROM provider_license_deliveries d
      JOIN provider_integrations i ON i.id=d.integration_id AND i.config_version=d.config_version AND i.status='ENABLED'
      WHERE d.attempt_count<8 AND ((d.status IN ('PENDING','RETRY_WAIT') AND d.next_attempt_at<=now()) OR
        (d.status='SENDING' AND d.lease_expires_at<=now()))
      ORDER BY d.created_at FOR UPDATE OF d SKIP LOCKED LIMIT 1)
      UPDATE provider_license_deliveries d SET status='SENDING',lease_token=$1,
        lease_expires_at=now()+interval '45 seconds',attempt_count=attempt_count+1,updated_at=now()
      FROM candidate WHERE d.id=candidate.id RETURNING d.*`,
      [randomUUID()],
    );
    return result.rows[0] ?? null;
  }

  async list(providerId?: string, status?: string, offset = 0) {
    const result = await this.pool.query<Record<string, unknown>>(
      `SELECT id,license_id AS "licenseId",revision::float8,
      status,attempt_count AS "attemptCount",last_error_code AS "lastErrorCode",
      accepted_at AS "acceptedAt",created_at AS "createdAt" FROM provider_license_deliveries
      WHERE ($1::uuid IS NULL OR provider_user_id=$1) AND ($2::text IS NULL OR status=$2)
      ORDER BY created_at DESC LIMIT 50 OFFSET $3`,
      [providerId ?? null, status ?? null, offset],
    );
    return result.rows;
  }
}
