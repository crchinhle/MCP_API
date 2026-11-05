import type { Pool } from 'pg';
import type { EncryptedLicenseSecret } from './license-secret-codec.js';

export interface ProviderIntegrationRow {
  id: string;
  provider_user_id: string;
  endpoint_url: string;
  config_version: number;
  status: string;
  credential_ciphertext: string;
  credential_iv: string;
  credential_tag: string;
  encryption_key_id: string;
  verified_at: Date | null;
  verified_config_version: number | null;
  authorized_at: Date;
}

export class ProviderIntegrationRepository {
  constructor(private readonly pool: Pool) {}
  async find(providerId: string): Promise<ProviderIntegrationRow | null> {
    return (
      (
        await this.pool.query<ProviderIntegrationRow>(
          'SELECT * FROM provider_integrations WHERE provider_user_id=$1',
          [providerId],
        )
      ).rows[0] ?? null
    );
  }
  async save(
    providerId: string,
    url: string,
    secret: EncryptedLicenseSecret | null,
    expectedVersion: number,
  ) {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const values = [
        providerId,
        url,
        secret?.ciphertext ?? null,
        secret?.iv ?? null,
        secret?.authTag ?? null,
        secret?.keyId ?? null,
      ];
      const result =
        expectedVersion === 0
          ? await client.query<ProviderIntegrationRow>(
              `INSERT INTO provider_integrations
          (provider_user_id,endpoint_url,credential_ciphertext,credential_iv,credential_tag,encryption_key_id,authorized_at,authorization_version)
          VALUES ($1,$2,$3,$4,$5,$6,now(),'provider-handoff-v1') ON CONFLICT (provider_user_id) DO NOTHING RETURNING *`,
              values,
            )
          : await client.query<ProviderIntegrationRow>(
              `UPDATE provider_integrations SET endpoint_url=$2,
          credential_ciphertext=coalesce($3,credential_ciphertext),credential_iv=coalesce($4,credential_iv),
          credential_tag=coalesce($5,credential_tag),encryption_key_id=coalesce($6,encryption_key_id),
          config_version=config_version+1,status='DISABLED',verified_at=NULL,verified_config_version=NULL,updated_at=now()
          WHERE provider_user_id=$1 AND config_version=$7 RETURNING *`,
              [...values, expectedVersion],
            );
      const row = result.rows[0];
      if (row)
        await client.query(
          `UPDATE provider_license_deliveries SET status='FAILED',last_error_code='PROVIDER_CONFIG_CHANGED',
        lease_token=NULL,lease_expires_at=NULL,updated_at=now() WHERE provider_user_id=$1 AND config_version<>$2
        AND status IN ('PENDING','RETRY_WAIT','SENDING')`,
          [providerId, row.config_version],
        );
      await client.query('COMMIT');
      return row ?? null;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }
  async verify(providerId: string, version: number): Promise<boolean> {
    return (
      (
        await this.pool.query(
          `UPDATE provider_integrations SET verified_at=now(),verified_config_version=config_version,updated_at=now()
      WHERE provider_user_id=$1 AND config_version=$2`,
          [providerId, version],
        )
      ).rowCount === 1
    );
  }
  async setEnabled(
    providerId: string,
    version: number,
    enabled: boolean,
  ): Promise<boolean> {
    return (
      (
        await this.pool.query(
          `UPDATE provider_integrations SET status=$3,updated_at=now()
      WHERE provider_user_id=$1 AND config_version=$2 AND (NOT $4::boolean OR verified_config_version=config_version)`,
          [providerId, version, enabled ? 'ENABLED' : 'DISABLED', enabled],
        )
      ).rowCount === 1
    );
  }
}
