import { randomUUID } from 'node:crypto';

import { keccak256, stringToHex, type Hex } from 'viem';
import { Pool, type PoolClient } from 'pg';

import { AuditWriter } from '../../../platform/audit/audit-writer.js';
import { canonicalizeEntitlements } from '../../../platform/crypto/license-crypto.js';
import type { LicenseLifecycleCommand } from '../licensing.types.js';

export interface LicenseCommandConfig {
  chainId: number;
  contractAddress: string;
  network: string;
}

export interface LicenseCommandResult {
  commandId: string;
  deviceId: string | null;
  licenseId: string;
  status: string;
  reused?: boolean;
}

export interface LicenseSecurityRecord {
  activationCommitment: Hex;
  activationKeyVersion: number;
  customerUserId: string;
  expiresAt: Date;
  id: string;
  maxActiveDevices: number;
  providerUserId: string;
  status: string;
}

function hashPayload(payload: Record<string, unknown>): Hex {
  return keccak256(stringToHex(canonicalizeEntitlements(payload)));
}

function mapCommand(row: Record<string, unknown>): LicenseCommandResult {
  return {
    commandId: String(row.id),
    deviceId: typeof row.license_device_id === 'string' ? row.license_device_id : null,
    licenseId: String(row.license_id),
    status: String(row.status),
  };
}

export class LicensingRepository {
  constructor(
    private readonly pool: Pool,
    private readonly audit = new AuditWriter(),
  ) {}

  async commandStatus(actorUserId: string, commandId: string) {
    const result = await this.pool.query<Record<string, unknown>>(
      `SELECT command.id, command.command_type, command.license_id,
              command.license_device_id, command.status, command.transaction_hash,
              command.confirmed_at
       FROM chain_commands command
       JOIN licenses license ON license.id=command.license_id
       WHERE command.id=$1 AND (license.customer_user_id=$2 OR license.provider_user_id=$2)`,
      [commandId, actorUserId],
    );
    const row = result.rows[0];
    return row ? {
      commandId: String(row.id),
      commandType: String(row.command_type),
      confirmedAt: row.confirmed_at instanceof Date ? row.confirmed_at.toISOString() : null,
      deviceId: typeof row.license_device_id === 'string' ? row.license_device_id : null,
      licenseId: String(row.license_id),
      status: String(row.status),
      transactionHash: typeof row.transaction_hash === 'string' ? row.transaction_hash : null,
    } : null;
  }

  async findSecurity(
    licenseId: string,
    actorUserId?: string,
  ): Promise<LicenseSecurityRecord | null> {
    const result = await this.pool.query<Record<string, unknown>>(
      `SELECT id, provider_user_id, customer_user_id, status, expires_at,
              max_active_devices, activation_commitment, activation_key_version
       FROM licenses
       WHERE id=$1 AND ($2::uuid IS NULL OR customer_user_id=$2 OR provider_user_id=$2)`,
      [licenseId, actorUserId ?? null],
    );
    const row = result.rows[0];
    if (!row || !Buffer.isBuffer(row.activation_commitment)) return null;
    return {
      activationCommitment: `0x${row.activation_commitment.toString('hex')}`,
      activationKeyVersion: Number(row.activation_key_version),
      customerUserId: String(row.customer_user_id),
      expiresAt: new Date(String(row.expires_at)),
      id: String(row.id),
      maxActiveDevices: Number(row.max_active_devices),
      providerUserId: String(row.provider_user_id),
      status: String(row.status),
    };
  }

  async findActivationLicense(activationCommitment: Hex): Promise<LicenseSecurityRecord | null> {
    const result = await this.pool.query<Record<string, unknown>>(
      `SELECT id, provider_user_id, customer_user_id, status, expires_at,
              max_active_devices, activation_commitment, activation_key_version
       FROM licenses
       WHERE activation_commitment=$1`,
      [Buffer.from(activationCommitment.slice(2), 'hex')],
    );
    const row = result.rows[0];
    if (!row || !Buffer.isBuffer(row.activation_commitment)) return null;
    return {
      activationCommitment: `0x${row.activation_commitment.toString('hex')}`,
      activationKeyVersion: Number(row.activation_key_version),
      customerUserId: String(row.customer_user_id),
      expiresAt: new Date(String(row.expires_at)),
      id: String(row.id),
      maxActiveDevices: Number(row.max_active_devices),
      providerUserId: String(row.provider_user_id),
      status: String(row.status),
    };
  }

  async findDevice(
    licenseId: string,
    deviceRef: string,
  ): Promise<{ id: string; status: string; devicePublicKey: string; bindingGeneration: number } | null> {
    const result = await this.pool.query<Record<string, unknown>>(
       `SELECT id, status, device_signer_address, binding_generation, activated_at, revoked_at
        FROM license_devices WHERE license_id=$1 AND device_ref=$2`,
      [licenseId, deviceRef],
    );
    const row = result.rows[0];
    return row
      ? { id: String(row.id), status: String(row.status), devicePublicKey: String(row.device_signer_address), bindingGeneration: Number(row.binding_generation) }
      : null;
  }

  async findDeviceById(licenseId: string, deviceId: string) {
    const result = await this.pool.query<Record<string, unknown>>(
       `SELECT id, device_ref, status, device_signer_address, binding_generation,
               activated_at, revoked_at
        FROM license_devices
        WHERE license_id=$1 AND id=$2`,
      [licenseId, deviceId],
    );
    const row = result.rows[0];
    return row
       ? { id: String(row.id), deviceRef: String(row.device_ref), status: String(row.status), devicePublicKey: String(row.device_signer_address), bindingGeneration: Number(row.binding_generation), activatedAt: row.activated_at, revokedAt: row.revoked_at }
       : null;
  }

  async createDeviceCommand(
    actorUserId: string | null,
    licenseId: string,
    deviceRef: string,
    devicePublicKey: string,
    deviceId: string,
    expectedBindingGeneration: number,
    config: LicenseCommandConfig,
  ): Promise<LicenseCommandResult> {
    return this.transaction(async (client) => {
      const license = await this.lockLicense(client, licenseId);
      if (actorUserId) this.requireCustomer(license, actorUserId);
      this.requireUsableLicense(license);

      const currentDevice = await client.query<Record<string, unknown>>(
        `SELECT id, status, binding_generation FROM license_devices WHERE license_id=$1 AND device_ref=$2 FOR UPDATE`,
        [licenseId, deviceRef],
      );
      const currentStatus = currentDevice.rows[0]?.status;
      if (currentStatus === 'ACTIVE') {
        const existingDeviceId = String(currentDevice.rows[0]?.id);
        return {
          commandId: existingDeviceId,
          deviceId: existingDeviceId,
          licenseId,
          status: 'ACTIVE',
          reused: true,
        };
      }
      const nextBindingGeneration = currentDevice.rows[0]
        ? Number(currentDevice.rows[0].binding_generation) + 1
        : 1;
      if (nextBindingGeneration !== expectedBindingGeneration) throw new Error('STALE_DEVICE_GENERATION');

      const activeCount = await client.query<{ count: string }>(
        `SELECT count(*)::text AS count FROM license_devices
         WHERE license_id=$1 AND status='ACTIVE'`,
        [licenseId],
      );
      if (Number(activeCount.rows[0]?.count ?? 0) >= license.maxActiveDevices) throw new Error('DEVICE_QUOTA_EXCEEDED');

      const existingDeviceId = currentDevice.rows[0]?.id;
      const storedDeviceId = typeof existingDeviceId === 'string' ? existingDeviceId : deviceId;
      if (!currentDevice.rows[0]) {
        await client.query(
          `INSERT INTO license_devices (id, license_id, device_ref, device_signer_address, status, binding_generation, activated_at)
           VALUES ($1, $2, $3, $4, 'ACTIVE', $5, now())`,
          [storedDeviceId, licenseId, deviceRef, devicePublicKey.toLowerCase(), expectedBindingGeneration],
        );
      } else {
        await client.query(
          `UPDATE license_devices SET status='ACTIVE', device_signer_address=$3,
             binding_generation=$4, activated_at=now(), revoked_at=NULL, updated_at=now()
           WHERE id=$1 AND license_id=$2`,
          [storedDeviceId, licenseId, devicePublicKey.toLowerCase(), expectedBindingGeneration],
        );
      }
      const stateVersion = await this.bumpDeviceState(client, licenseId);
      const commandId = randomUUID();
      const payload = {
        activeDeviceCount: Number(activeCount.rows[0]?.count ?? 0) + 1,
        commandId,
        deviceStateVersion: stateVersion,
        licenseId,
        protocolVersion: 2,
      };
      const command = await this.insertCommand(client, commandId, 'SYNC_DEVICE_COUNT', license, null, payload, config);
      await this.audit.write(client, {
        action: 'DEVICE_ACTIVATION_REQUESTED',
        ...(actorUserId ? { actorRole: 'CUSTOMER', actorUserId } : {}),
        metadata: { deviceRef, keyVersion: license.activationKeyVersion, authorization: 'ACTIVATION_KEY_AND_DEVICE_PROOF' },
        targetId: licenseId,
        targetType: 'LICENSE',
      });
      return command;
    });
  }

  async createDeviceRevokeCommand(
    actorUserId: string,
    licenseId: string,
    deviceRef: string,
    deviceId: string,
    expectedBindingGeneration: number,
    config: LicenseCommandConfig,
  ): Promise<LicenseCommandResult> {
    return this.transaction(async (client) => {
      const license = await this.lockLicense(client, licenseId);
      this.requireCustomer(license, actorUserId);
      const device = await client.query<Record<string, unknown>>(
        `SELECT id, status, binding_generation FROM license_devices WHERE license_id=$1 AND device_ref=$2 FOR UPDATE`,
        [licenseId, deviceRef],
      );
      const row = device.rows[0];
      if (!row) throw new Error('DEVICE_NOT_FOUND');
      if (String(row.status) === 'REVOKED') {
        return { commandId: String(row.id), deviceId: String(row.id), licenseId, status: 'REVOKED', reused: true };
      }
      if (String(row.status) !== 'ACTIVE') throw new Error('DEVICE_NOT_ACTIVE');
      if (Number(row.binding_generation) !== expectedBindingGeneration) throw new Error('STALE_DEVICE_GENERATION');
      await client.query(
        `UPDATE license_devices SET status='REVOKED', revoked_at=now(), updated_at=now() WHERE id=$1 AND license_id=$2`,
        [String(row.id), licenseId],
      );
      const activeCount = await client.query<{ count: string }>(
        `SELECT count(*)::text AS count FROM license_devices WHERE license_id=$1 AND status='ACTIVE'`,
        [licenseId],
      );
      const stateVersion = await this.bumpDeviceState(client, licenseId);
      const commandId = randomUUID();
      const payload = {
        activeDeviceCount: Number(activeCount.rows[0]?.count ?? 0),
        commandId,
        deviceStateVersion: stateVersion,
        licenseId,
        protocolVersion: 2,
      };
      const command = await this.insertCommand(client, commandId, 'SYNC_DEVICE_COUNT', license, null, payload, config);
      await this.audit.write(client, {
        action: 'DEVICE_REVOCATION_REQUESTED',
        actorRole: 'CUSTOMER',
        actorUserId,
        metadata: { deviceRef },
        targetId: licenseId,
        targetType: 'LICENSE',
      });
      return command;
    });
  }

  async createRotationCommand(
    actorUserId: string,
    licenseId: string,
    commitment: Hex,
    nextVersion: number,
    config: LicenseCommandConfig,
  ): Promise<LicenseCommandResult> {
    return this.transaction(async (client) => {
      const license = await this.lockLicense(client, licenseId);
      this.requireCustomer(license, actorUserId);
      this.requireUsableLicense(license);
      if (!/^0x[0-9a-fA-F]{64}$/.test(commitment)) throw new Error('INVALID_ACTIVATION_COMMITMENT');
      if (nextVersion !== license.activationKeyVersion + 1) throw new Error('INVALID_KEY_VERSION');
      const existing = await client.query<Record<string, unknown>>(
        `SELECT id, status, license_device_id, license_id FROM chain_commands
         WHERE license_id=$1 AND command_type='ROTATE_KEY'
           AND status IN ('PENDING','SUBMITTED','SUBMITTED_UNKNOWN','RETRYABLE_FAILED')
         ORDER BY created_at DESC LIMIT 1`,
        [licenseId],
      );
      if (existing.rows[0]) return { ...mapCommand(existing.rows[0]), reused: true };
      const commandId = randomUUID();
      const payload = {
        activationCommitment: commitment,
        commandId,
        keyVersion: nextVersion,
        licenseId,
        previousActivationCommitment: license.activationCommitment,
        previousKeyVersion: license.activationKeyVersion,
        protocolVersion: 1,
      };
      const command = await this.insertCommand(client, commandId, 'ROTATE_KEY', license, null, payload, config);
      await client.query(
        `UPDATE licenses SET pending_activation_commitment=decode($2,'hex'),
           pending_activation_key_version=$3, pending_activation_command_id=$4,
           updated_at=now() WHERE id=$1`,
        [licenseId, commitment.slice(2), nextVersion, commandId],
      );
      await this.audit.write(client, {
        action: 'ACTIVATION_KEY_ROTATION_REQUESTED',
        actorRole: 'CUSTOMER',
        actorUserId,
        metadata: { keyVersion: nextVersion },
        targetId: licenseId,
        targetType: 'LICENSE',
      });
      return command;
    });
  }

  async createLifecycleCommand(
    actorUserId: string,
    licenseId: string,
    commandType: LicenseLifecycleCommand,
    config: LicenseCommandConfig,
    reason?: string,
  ): Promise<LicenseCommandResult> {
    return this.transaction(async (client) => {
      const license = await this.lockLicense(client, licenseId);
      if (license.providerUserId !== actorUserId) throw new Error('LICENSE_NOT_PROVIDER_OWNED');
      if (commandType === 'SUSPEND_LICENSE' && (license.status !== 'ACTIVE' || license.expiresAt.getTime() <= Date.now())) throw new Error('LICENSE_STATE_INVALID');
      if (commandType === 'RESUME_LICENSE' && license.status !== 'SUSPENDED') throw new Error('LICENSE_STATE_INVALID');
      if (commandType === 'REVOKE_LICENSE' && !['ACTIVE', 'SUSPENDED'].includes(license.status)) throw new Error('LICENSE_STATE_INVALID');
      const existing = await client.query<Record<string, unknown>>(
        `SELECT id, status, license_device_id, license_id FROM chain_commands
         WHERE license_id=$1 AND command_type=$2
           AND status IN ('PENDING','SUBMITTED','SUBMITTED_UNKNOWN','RETRYABLE_FAILED')
         ORDER BY created_at DESC LIMIT 1`,
        [licenseId, commandType],
      );
      if (existing.rows[0]) return mapCommand(existing.rows[0]);
      const commandId = randomUUID();
      const payload = { commandId, licenseId, protocolVersion: 1, ...(reason ? { reason } : {}) };
      const command = await this.insertCommand(client, commandId, commandType, license, null, payload, config);
      await this.audit.write(client, {
        action: 'LICENSE_LIFECYCLE_REQUESTED',
        actorRole: 'PROVIDER_ADMIN',
        actorUserId,
        metadata: { commandType, reason: reason ?? null },
        targetId: licenseId,
        targetType: 'LICENSE',
      });
      return command;
    });
  }

  private async lockLicense(client: PoolClient, licenseId: string): Promise<LicenseSecurityRecord> {
    const result = await client.query<Record<string, unknown>>(
      `SELECT id, provider_user_id, customer_user_id, status, expires_at,
              max_active_devices, activation_commitment, activation_key_version
       FROM licenses WHERE id=$1 FOR UPDATE`,
      [licenseId],
    );
    const row = result.rows[0];
    if (!row || !Buffer.isBuffer(row.activation_commitment)) throw new Error('LICENSE_NOT_FOUND');
    return {
      activationCommitment: `0x${row.activation_commitment.toString('hex')}`,
      activationKeyVersion: Number(row.activation_key_version),
      customerUserId: String(row.customer_user_id),
      expiresAt: new Date(String(row.expires_at)),
      id: String(row.id),
      maxActiveDevices: Number(row.max_active_devices),
      providerUserId: String(row.provider_user_id),
      status: String(row.status),
    };
  }

  private requireCustomer(license: LicenseSecurityRecord, actorUserId: string) {
    if (license.customerUserId !== actorUserId) throw new Error('LICENSE_NOT_CUSTOMER_OWNED');
  }

  private requireUsableLicense(license: LicenseSecurityRecord) {
    if (license.status !== 'ACTIVE' || license.expiresAt.getTime() <= Date.now()) throw new Error('LICENSE_NOT_ACTIVE');
  }

  private async bumpDeviceState(client: PoolClient, licenseId: string): Promise<number> {
    const result = await client.query<{ device_state_version: string }>(
      `UPDATE licenses
       SET active_device_count=(SELECT count(*) FROM license_devices WHERE license_id=$1 AND status='ACTIVE'),
           device_state_version=device_state_version + 1,
           latest_requested_device_sync_version=device_state_version + 1,
           device_sync_status='PENDING', updated_at=now()
       WHERE id=$1
       RETURNING device_state_version`,
      [licenseId],
    );
    return Number(result.rows[0]?.device_state_version);
  }

  private async insertCommand(
    client: PoolClient,
    commandId: string,
    commandType: string,
    license: LicenseSecurityRecord,
    deviceId: string | null,
    payload: Record<string, unknown>,
    config: LicenseCommandConfig,
  ): Promise<LicenseCommandResult> {
    const predecessor = await client.query<{
      basis_chain_event_id: string | null;
      id: string;
      license_command_sequence: string;
    }>(
      `SELECT latest.id, latest.license_command_sequence,
              (
                SELECT confirmed.confirmation_chain_event_id
                FROM chain_commands confirmed
                WHERE confirmed.license_id=latest.license_id
                  AND confirmed.status='CONFIRMED'
                  AND confirmed.license_command_sequence <= latest.license_command_sequence
                ORDER BY confirmed.license_command_sequence DESC
                LIMIT 1
              ) AS basis_chain_event_id
       FROM chain_commands latest
       WHERE latest.license_id=$1
       ORDER BY latest.license_command_sequence DESC
       LIMIT 1
       FOR UPDATE`,
      [license.id],
    );
    const previous = predecessor.rows[0];
    if (!previous || !previous.basis_chain_event_id) {
      throw new Error('LICENSE_CANONICAL_BASIS_NOT_FOUND');
    }
    const commandSequence = Number(previous.license_command_sequence) + 1;
    const result = await client.query<Record<string, unknown>>(
      `INSERT INTO chain_commands
        (id, idempotency_key, command_type, provider_user_id, license_id,
         license_device_id, license_command_sequence, predecessor_command_id,
         basis_chain_event_id, network, chain_id, contract_address, payload, payload_hash)
       VALUES ($1,$1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,decode($13,'hex'))
       RETURNING id, license_id, license_device_id, status`,
      [
        commandId,
        commandType,
        license.providerUserId,
        license.id,
        deviceId,
        commandSequence,
        previous.id,
        previous.basis_chain_event_id,
        config.network.toLowerCase(),
        config.chainId,
        config.contractAddress.toLowerCase(),
        JSON.stringify(payload),
        hashPayload(payload).slice(2),
      ],
    );
    return mapCommand(result.rows[0]!);
  }

  private async transaction<T>(work: (client: PoolClient) => Promise<T>): Promise<T> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const value = await work(client);
      await client.query('COMMIT');
      return value;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }
}
