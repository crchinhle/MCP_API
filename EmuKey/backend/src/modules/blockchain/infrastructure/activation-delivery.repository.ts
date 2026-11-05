import { ConflictException } from '@nestjs/common';
import type { Pool } from 'pg';
import type { LicenseProjectionRepository } from './license-projection.repository.js';

export class ActivationDeliveryRepository {
  constructor(
    private readonly pool: Pool,
    private readonly projections: Pick<
      LicenseProjectionRepository,
      'activationCommand'
    >,
  ) {}

  async claim(input: {
    licenseId: string;
    customerId: string;
    commandId: string;
    keyVersion: number;
    deliveryId: string;
    ttlSeconds: number;
  }) {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      // Serialize receipt admission with lifecycle/rotation writes to the same license.
      await client.query(
        'SELECT id FROM licenses WHERE id=$1 AND customer_user_id=$2 FOR SHARE',
        [input.licenseId, input.customerId],
      );
      const handoff = await client.query(`SELECT fulfillment_mode FROM licenses l WHERE id=$1 AND customer_user_id=$2
        AND (fulfillment_mode<>'PROVIDER_HANDOFF' OR EXISTS (SELECT 1 FROM provider_license_deliveries d
          WHERE d.license_id=l.id AND d.revision=l.provider_revision AND d.key_version=l.activation_key_version AND d.status='DELIVERED'))`,[input.licenseId,input.customerId]);
      if (!handoff.rows[0]) throw new ConflictException({code:'PROVIDER_DELIVERY_NOT_READY'});
      const command = await this.projections.activationCommand(
        input.customerId,
        input.licenseId,
        client,
      );
      if (
        !command ||
        command.command_id !== input.commandId ||
        Number(command.key_version) !== input.keyVersion
      ) {
        throw new ConflictException({
          code: 'KEY_DELIVERY_STALE',
          message:
            'License or key state changed. Refresh the license before retrying.',
        });
      }
      await client.query(
        `INSERT INTO license_key_deliveries
      (license_id,customer_user_id,command_id,key_version,delivery_id,retry_until)
      VALUES ($1,$2,$3,$4,$5,statement_timestamp()+$6::int*interval '1 second')
      ON CONFLICT (license_id,key_version) DO NOTHING`,
        [
          input.licenseId,
          input.customerId,
          input.commandId,
          input.keyVersion,
          input.deliveryId,
          Math.min(300, input.ttlSeconds),
        ],
      );
      const result = await client.query<{ retry_until: Date; acknowledged_at: Date | null; expired: boolean }>(
        `SELECT retry_until,acknowledged_at,retry_until<=statement_timestamp() AS expired FROM license_key_deliveries
      WHERE license_id=$1 AND customer_user_id=$2 AND command_id=$3 AND key_version=$4 AND delivery_id=$5
      `,
        [
          input.licenseId,
          input.customerId,
          input.commandId,
          input.keyVersion,
          input.deliveryId,
        ],
      );
      const receipt = result.rows[0];
      if (!receipt || receipt.acknowledged_at)
        throw new ConflictException({
          code: 'KEY_ALREADY_DELIVERED',
          message:
            'This key delivery is closed or belongs to another request. Use key recovery if needed.',
        });
      if (receipt.expired) throw new ConflictException({
        code: 'KEY_DELIVERY_EXPIRED',
        message: 'The key retry window has expired. Use key recovery if you did not save the key.',
      });
      await client.query('COMMIT');
      return { retryUntil: receipt.retry_until };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async available(
    licenseId: string,
    keyVersion: number,
    customerId: string,
  ): Promise<boolean> {
    const result = await this.pool.query(
      `SELECT 1 FROM license_key_deliveries WHERE license_id=$1
      AND key_version=$2 AND customer_user_id=$3 AND (acknowledged_at IS NOT NULL OR retry_until<=statement_timestamp())`,
      [licenseId, keyVersion, customerId],
    );
    return result.rows.length === 0;
  }

  async acknowledge(
    customerId: string,
    licenseId: string,
    keyVersion: number,
    deliveryId: string,
  ) {
    const result = await this.pool.query<{ command_id: string }>(
      `UPDATE license_key_deliveries
      SET acknowledged_at=coalesce(acknowledged_at,statement_timestamp())
      WHERE license_id=$1 AND customer_user_id=$2 AND key_version=$3 AND delivery_id=$4 RETURNING command_id`,
      [licenseId, customerId, keyVersion, deliveryId],
    );
    if (!result.rows[0])
      throw new ConflictException({ code: 'KEY_DELIVERY_NOT_FOUND' });
    return result.rows[0].command_id;
  }
}
