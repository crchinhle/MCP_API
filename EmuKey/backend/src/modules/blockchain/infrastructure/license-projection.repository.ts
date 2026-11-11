import type { LicenseProjectionReader } from '../application/license-projection-reader.js';
import { Pool } from 'pg';
import type { Hex } from 'viem';

import { activationCommitment } from '../../../platform/crypto/license-crypto.js';
import type {
  PublicLicenseHistoryChangeDto,
  PublicLicenseHistoryEventDto,
} from '../presentation/license.dto.js';

function textValue(value: unknown, fallback: string): string {
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'bigint') return String(value);
  return fallback;
}

function toIsoString(value: unknown): string | null {
  if (!value) return null;
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'string') {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? value : parsed.toISOString();
  }
  return null;
}

function maskCommitmentHex(hexOrPrefixed: string | null | undefined): string | null {
  if (!hexOrPrefixed) return null;
  const clean = hexOrPrefixed.startsWith('0x')
    ? hexOrPrefixed.toLowerCase()
    : `0x${hexOrPrefixed.toLowerCase()}`;
  if (clean.length <= 18) return clean;
  return `${clean.slice(0, 10)}...${clean.slice(-8)}`;
}

function explorerBaseUrl(network: string | null, chainId: number | null): string | null {
  if (chainId === 11155111 || network === 'sepolia') {
    return 'https://sepolia.etherscan.io';
  }
  if (chainId === 1 || network === 'mainnet') {
    return 'https://etherscan.io';
  }
  return null;
}

function statusDisplayLabel(status: string): string {
  switch (status) {
    case 'ACTIVE':
      return 'Đang hoạt động (ACTIVE)';
    case 'SUSPENDED':
      return 'Tạm khóa (SUSPENDED)';
    case 'REVOKED':
      return 'Đã thu hồi (REVOKED)';
    case 'EXPIRED':
      return 'Đã hết hạn (EXPIRED)';
    case 'PENDING_ONCHAIN':
      return 'Đang chờ xác nhận (PENDING_ONCHAIN)';
    default:
      return status;
  }
}

const PRIVATE_COLUMNS = `
  l.id, l.public_license_id, l.origin_order_id,
  CASE WHEN l.status='ACTIVE' AND l.expires_at <= now() THEN 'EXPIRED' ELSE l.status END AS status,
  l.period_start, l.expires_at,
  l.max_active_devices, l.active_device_count, l.device_state_version,
  l.activation_key_version, l.activation_key_trust_status, l.activation_key_last4, l.entitlement_version,
  l.created_at, l.updated_at, p.name AS product_name, pl.name AS plan_name,
  pl.version AS plan_version, encode(l.plan_commitment,'hex') AS plan_commitment,
  provider.display_name AS provider_display_name,
  provider.organization_name AS provider_organization_name,
  ce.transaction_hash, ce.block_number, ce.confirmation_count, ce.finality_status,
  l.fulfillment_mode,l.provider_revision,
  (SELECT d.status FROM provider_license_deliveries d WHERE d.license_id=l.id AND d.revision=l.provider_revision) AS provider_delivery_status,
  (SELECT d.accepted_at FROM provider_license_deliveries d WHERE d.license_id=l.id AND d.revision=l.provider_revision) AS provider_accepted_at`;

export class LicenseProjectionRepository implements LicenseProjectionReader {
  constructor(private readonly pool: Pool) {}

  async listProvider(providerUserId: string) {
    const result = await this.pool.query<Record<string, unknown>>(
      `SELECT ${PRIVATE_COLUMNS}
       FROM licenses l JOIN products p ON p.id=l.product_id
       JOIN plans pl ON pl.id=l.plan_id JOIN users provider ON provider.id=l.provider_user_id
       LEFT JOIN chain_events ce ON ce.id=l.last_applied_chain_event_id
       WHERE l.provider_user_id=$1
       ORDER BY l.created_at DESC`,
      [providerUserId],
    );
    return result.rows.map((row) => this.map(row));
  }

  async listCustomer(customerUserId: string) {
    const result = await this.pool.query<Record<string, unknown>>(
      `SELECT ${PRIVATE_COLUMNS}
       FROM licenses l JOIN products p ON p.id=l.product_id
       JOIN plans pl ON pl.id=l.plan_id JOIN users provider ON provider.id=l.provider_user_id
       LEFT JOIN chain_events ce ON ce.id=l.last_applied_chain_event_id
       WHERE l.customer_user_id=$1
       ORDER BY l.created_at DESC`,
      [customerUserId],
    );
    return result.rows.map((row) => this.map(row));
  }

  async findProvider(providerUserId: string, id: string) {
    const result = await this.pool.query<Record<string, unknown>>(
      `SELECT ${PRIVATE_COLUMNS}
       FROM licenses l JOIN products p ON p.id=l.product_id
       JOIN plans pl ON pl.id=l.plan_id JOIN users provider ON provider.id=l.provider_user_id
       LEFT JOIN chain_events ce ON ce.id=l.last_applied_chain_event_id
       WHERE l.id=$2 AND l.provider_user_id=$1`,
      [providerUserId, id],
    );
    return result.rows[0] ? this.map(result.rows[0]) : null;
  }

  async findCustomer(customerUserId: string, id: string) {
    const result = await this.pool.query<Record<string, unknown>>(
      `SELECT ${PRIVATE_COLUMNS}
       FROM licenses l JOIN products p ON p.id=l.product_id
       JOIN plans pl ON pl.id=l.plan_id JOIN users provider ON provider.id=l.provider_user_id
       LEFT JOIN chain_events ce ON ce.id=l.last_applied_chain_event_id
       WHERE l.id=$2 AND l.customer_user_id=$1`,
      [customerUserId, id],
    );
    return result.rows[0] ? this.map(result.rows[0]) : null;
  }

  async listCustomerDevices(customerUserId: string, licenseId: string) {
    const result = await this.pool.query<Record<string, unknown>>(
       `SELECT d.id, d.device_ref, d.status, d.activated_at, d.revoked_at,
               d.binding_generation, d.display_name, d.platform
        FROM license_devices d
        JOIN licenses l ON l.id=d.license_id
        WHERE d.license_id=$1 AND l.customer_user_id=$2
        ORDER BY d.created_at, d.id`,
      [licenseId, customerUserId],
    );
    return result.rows.map((row) => ({
      activatedAt: row.activated_at,
      bindingGeneration: Number(row.binding_generation),
      deviceRef: String(row.device_ref),
      displayName: typeof row.display_name==='string'?row.display_name:null,
      platform: typeof row.platform === 'string' ? row.platform : 'UNKNOWN',
       id: String(row.id),
      revokedAt: row.revoked_at,
      status: String(row.status),
    }));
  }

  async findPublic(publicIdOrKey: string) {
    const trimmed = publicIdOrKey.trim();
    const isHexSecret = /^0x[0-9a-fA-F]{64}$/.test(trimmed);
    const commitmentHex = isHexSecret
      ? activationCommitment(trimmed.toLowerCase() as Hex).slice(2).toLowerCase()
      : null;

    const result = await this.pool.query<Record<string, unknown>>(
      `SELECT l.id, l.public_license_id, l.fulfillment_mode,
         (SELECT d.status FROM provider_license_deliveries d
          WHERE d.license_id=l.id AND d.revision=l.provider_revision) AS provider_delivery_status,
         CASE WHEN l.status='ACTIVE' AND l.expires_at <= now() THEN 'EXPIRED' ELSE l.status END AS status,
         l.period_start, l.expires_at,
         l.max_active_devices, l.active_device_count, l.device_state_version,
         l.activation_key_version,
         encode(l.plan_commitment,'hex') AS plan_commitment,
         p.name AS product_name, pl.name AS plan_name, pl.version AS plan_version,
         provider.display_name AS provider_display_name,
         provider.organization_name AS provider_organization_name,
         ce.transaction_hash, ce.block_number, ce.confirmation_count,
         ce.finality_status,
         EXISTS(SELECT 1 FROM chain_commands cc WHERE cc.license_id=l.id
           AND cc.status='SUBMITTED_UNKNOWN') AS projection_stale,
         CASE
           WHEN l.public_license_id = $1 THEN 'PUBLIC_ID'
           WHEN $2::text IS NOT NULL AND encode(l.activation_commitment, 'hex') = $2 THEN 'CURRENT_KEY'
           WHEN $2::text IS NOT NULL AND l.pending_activation_commitment IS NOT NULL AND encode(l.pending_activation_commitment, 'hex') = $2 THEN 'PENDING_ROTATED_KEY'
           WHEN $2::text IS NOT NULL THEN 'HISTORICAL_ROTATED_KEY'
           ELSE 'PUBLIC_ID'
         END AS matched_by,
         CASE
           WHEN l.public_license_id = $1 THEN l.activation_key_version
           WHEN $2::text IS NOT NULL AND encode(l.activation_commitment, 'hex') = $2 THEN l.activation_key_version
           WHEN $2::text IS NOT NULL AND l.pending_activation_commitment IS NOT NULL AND encode(l.pending_activation_commitment, 'hex') = $2 THEN l.pending_activation_key_version
           WHEN $2::text IS NOT NULL THEN COALESCE(
             (SELECT ce_match.activation_key_version FROM chain_events ce_match WHERE ce_match.license_id = l.id AND encode(ce_match.activation_commitment, 'hex') = $2 ORDER BY ce_match.block_number DESC LIMIT 1),
             (SELECT ce_prev.previous_activation_key_version FROM chain_events ce_prev WHERE ce_prev.license_id = l.id AND encode(ce_prev.previous_activation_commitment, 'hex') = $2 ORDER BY ce_prev.block_number DESC LIMIT 1),
             1
           )
           ELSE l.activation_key_version
         END AS matched_key_version
       FROM licenses l JOIN products p ON p.id=l.product_id
       JOIN plans pl ON pl.id=l.plan_id JOIN users provider ON provider.id=l.provider_user_id
       LEFT JOIN LATERAL (
         SELECT transaction_hash, block_number, confirmation_count, finality_status
         FROM chain_events WHERE license_id=l.id
         ORDER BY block_number DESC, log_index DESC, observed_at DESC LIMIT 1
       ) ce ON TRUE
       WHERE l.public_license_id = $1
          OR ($2::text IS NOT NULL AND (
              encode(l.activation_commitment, 'hex') = $2
              OR (l.pending_activation_commitment IS NOT NULL AND encode(l.pending_activation_commitment, 'hex') = $2)
              OR EXISTS (
                SELECT 1 FROM chain_events ce_k
                WHERE ce_k.license_id = l.id
                  AND (encode(ce_k.activation_commitment, 'hex') = $2
                       OR encode(ce_k.previous_activation_commitment, 'hex') = $2)
              )
          ))
       LIMIT 1`,
      [trimmed, commitmentHex],
    );
    const row = result.rows[0];
    if (!row) return null;

    const historyQueryResult = row.id
      ? await this.pool.query<Record<string, unknown>>(
          `SELECT
             ce.id AS event_id,
             cc.id AS command_id,
             cc.license_command_sequence AS command_sequence,
             cc.command_type,
             cc.status AS command_status,
             COALESCE(ce.event_type, cc.expected_event_type) AS event_type,
             COALESCE(ce.finality_status, 'PENDING') AS finality_status,
             COALESCE(ce.transaction_hash, cc.transaction_hash) AS transaction_hash,
             COALESCE(ce.block_number, cc.receipt_block_number) AS block_number,
             COALESCE(ce.block_hash, cc.receipt_block_hash) AS block_hash,
             ce.log_index,
             COALESCE(ce.confirmation_count, 0) AS confirmation_count,
             COALESCE(ce.network, cc.network) AS network,
             COALESCE(ce.chain_id, cc.chain_id) AS chain_id,
             COALESCE(ce.contract_address, cc.contract_address) AS contract_address,
             encode(ce.activation_commitment, 'hex') AS activation_commitment_hex,
             ce.activation_key_version,
             encode(ce.previous_activation_commitment, 'hex') AS previous_activation_commitment_hex,
             ce.previous_activation_key_version,
             ce.payload AS event_payload,
             cc.payload AS command_payload,
             ce.observed_at,
             ce.finalized_at,
             cc.submitted_at,
             cc.confirmed_at,
             cc.created_at
           FROM chain_commands cc
           LEFT JOIN chain_events ce
             ON ce.chain_command_id = cc.id
            AND (ce.id = cc.confirmation_chain_event_id OR cc.confirmation_chain_event_id IS NULL)
           WHERE cc.license_id = $1
             AND (
               ce.id IS NOT NULL
               OR cc.status IN ('PENDING', 'SUBMITTED', 'SUBMITTED_UNKNOWN')
             )
           ORDER BY
             CASE WHEN COALESCE(ce.block_number, cc.receipt_block_number) IS NULL THEN 1 ELSE 0 END ASC,
             COALESCE(ce.block_number, cc.receipt_block_number) ASC,
             COALESCE((ce.payload->>'transactionIndex')::int, 2147483647) ASC,
             COALESCE(ce.log_index, 2147483647) ASC,
             cc.license_command_sequence ASC`,
          [row.id],
        )
      : { rows: [] as Record<string, unknown>[] };

    const historyRows = historyQueryResult?.rows ?? [];
    const state =
      row.finality_status === 'REORGED'
        ? 'REORGED'
        : row.projection_stale
          ? 'PROJECTION_STALE'
          : row.status === 'PENDING_ONCHAIN'
            ? 'PENDING_ONCHAIN'
            : row.finality_status === 'CONFIRMED'
              ? 'CHAIN_CONFIRMED'
              : 'PROJECTION_STALE';

    const planCommitmentRaw = textValue(row.plan_commitment ?? row.plan_commitment_hex, '');
    const providerOrg =
      typeof row.provider_organization_name === 'string'
        ? row.provider_organization_name
        : typeof row.provider_org === 'string'
          ? row.provider_org
          : null;

    const {
      history,
      historyComplete,
      historyNote,
      historySource,
      network,
      chainId,
      contractAddress,
      explorerUrl,
    } = this.buildLifecycleHistory(row, historyRows);

    return {
      ...(row.fulfillment_mode === 'PROVIDER_HANDOFF'
        ? {
            fulfillmentMode: 'PROVIDER_HANDOFF' as const,
            providerDeliveryStatus: textValue(row.provider_delivery_status, 'PENDING'),
          }
        : {}),
      blockNumber: row.block_number === null || row.block_number === undefined ? null : Number(row.block_number),
      confirmationCount: Number(row.confirmation_count ?? 0),
      periodStart: toIsoString(row.period_start) ?? undefined,
      expiresAt: toIsoString(row.expires_at) ?? String(row.expires_at),
      maxActiveDevices:
        row.max_active_devices !== undefined && row.max_active_devices !== null
          ? Number(row.max_active_devices)
          : undefined,
      activeDeviceCount:
        row.active_device_count !== undefined && row.active_device_count !== null
          ? Number(row.active_device_count)
          : undefined,
      keyVersion:
        row.activation_key_version !== undefined && row.activation_key_version !== null
          ? Number(row.activation_key_version)
          : undefined,
      matchedBy: typeof row.matched_by === 'string' ? row.matched_by : 'PUBLIC_ID',
      matchedKeyVersion:
        row.matched_key_version !== undefined && row.matched_key_version !== null
          ? Number(row.matched_key_version)
          : null,
      finality: textValue(row.finality_status, 'PENDING'),
      licenseId: String(row.public_license_id),
      plan: {
        commitment: planCommitmentRaw.startsWith('0x') ? planCommitmentRaw : `0x${planCommitmentRaw}`,
        name: String(row.plan_name),
        version: Number(row.plan_version),
      },
      productName: String(row.product_name),
      provider: {
        displayName: String(row.provider_display_name),
        organizationName: providerOrg,
      },
      network,
      chainId,
      contractAddress,
      explorerUrl,
      historySource,
      historyComplete,
      historyNote,
      history,
      state,
      status: String(row.status),
      transactionHash:
        typeof row.transaction_hash === 'string' ? row.transaction_hash : null,
    };
  }

  private buildLifecycleHistory(
    licenseRow: Record<string, unknown>,
    rawRows: Record<string, unknown>[],
  ): {
    history: PublicLicenseHistoryEventDto[];
    historyComplete: boolean;
    historyNote: string | null;
    historySource: 'ONCHAIN_VERIFIED' | 'INDEXED_ONCHAIN_LOGS' | 'UNVERIFIED_PENDING';
    network: string | null;
    chainId: number | null;
    contractAddress: string | null;
    explorerUrl: string | null;
  } {
    const sortedRows = [...rawRows].sort((a, b) => {
      const blockA =
        a.block_number === null || a.block_number === undefined
          ? Number.MAX_SAFE_INTEGER
          : Number(a.block_number);
      const blockB =
        b.block_number === null || b.block_number === undefined
          ? Number.MAX_SAFE_INTEGER
          : Number(b.block_number);
      if (blockA !== blockB) return blockA - blockB;

      const payloadA = (a.event_payload ?? {}) as Record<string, unknown>;
      const payloadB = (b.event_payload ?? {}) as Record<string, unknown>;
      const txIdxA =
        typeof payloadA.transactionIndex === 'number'
          ? payloadA.transactionIndex
          : Number.MAX_SAFE_INTEGER;
      const txIdxB =
        typeof payloadB.transactionIndex === 'number'
          ? payloadB.transactionIndex
          : Number.MAX_SAFE_INTEGER;
      if (txIdxA !== txIdxB) return txIdxA - txIdxB;

      const logA =
        a.log_index === null || a.log_index === undefined
          ? Number.MAX_SAFE_INTEGER
          : Number(a.log_index);
      const logB =
        b.log_index === null || b.log_index === undefined
          ? Number.MAX_SAFE_INTEGER
          : Number(b.log_index);
      if (logA !== logB) return logA - logB;

      const seqA = Number(a.command_sequence ?? 0);
      const seqB = Number(b.command_sequence ?? 0);
      return seqA - seqB;
    });

    const productName = textValue(licenseRow.product_name, '');
    const planName = textValue(licenseRow.plan_name, '');
    const planVersion = Number(licenseRow.plan_version ?? 1);
    const maxActiveDevices = Number(licenseRow.max_active_devices ?? 1);
    const periodStartIso = toIsoString(licenseRow.period_start);
    const licenseExpiresIso = toIsoString(licenseRow.expires_at);

    let runningStatus = 'PENDING_ONCHAIN';
    let runningExpiresAt = periodStartIso ?? licenseExpiresIso;
    let runningKeyVersion = 1;
    let runningCommitment: string | null = null;
    let runningDeviceCount = 0;
    let runningDeviceStateVersion = 0;

    let latestNetwork: string | null = null;
    let latestChainId: number | null = null;
    let latestContractAddress: string | null = null;

    const history: PublicLicenseHistoryEventDto[] = [];

    for (const item of sortedRows) {
      const eventType = textValue(item.event_type, 'LICENSE_ISSUED');
      const finalityRaw = textValue(item.finality_status, 'PENDING');
      const status: 'CONFIRMED' | 'PENDING' | 'REORGED' =
        finalityRaw === 'CONFIRMED'
          ? 'CONFIRMED'
          : finalityRaw === 'REORGED'
            ? 'REORGED'
            : 'PENDING';

      const eventPayload = (item.event_payload ?? {}) as Record<string, unknown>;
      const commandPayload = (item.command_payload ?? {}) as Record<string, unknown>;

      const network = typeof item.network === 'string' ? item.network : null;
      const chainId =
        item.chain_id !== null && item.chain_id !== undefined
          ? Number(item.chain_id)
          : null;
      const contractAddress =
        typeof item.contract_address === 'string' ? item.contract_address : null;
      if (network) latestNetwork = network;
      if (chainId !== null) latestChainId = chainId;
      if (contractAddress) latestContractAddress = contractAddress;

      const baseExplorer = explorerBaseUrl(network, chainId);
      const txHash =
        typeof item.transaction_hash === 'string' ? item.transaction_hash : null;
      const explorerTxUrl =
        baseExplorer && txHash ? `${baseExplorer}/tx/${txHash}` : null;

      const blockTimestamp =
        typeof eventPayload.blockTimestamp === 'string'
          ? eventPayload.blockTimestamp
          : null;
      const observedAt = toIsoString(item.observed_at);
      const finalizedAt = toIsoString(item.finalized_at);
      const submittedAt = toIsoString(item.submitted_at);
      const confirmedAt = toIsoString(item.confirmed_at);
      const createdAt = toIsoString(item.created_at);

      const occurredAt =
        blockTimestamp ??
        (eventType === 'LICENSE_ISSUED' && periodStartIso
          ? periodStartIso
          : observedAt ?? confirmedAt ?? submittedAt ?? createdAt ?? new Date().toISOString());

      const changes: PublicLicenseHistoryChangeDto[] = [];
      let title = 'Sự kiện bản quyền trên Blockchain';
      let description = 'Sự kiện trạng thái bản quyền được ghi nhận trên Blockchain.';

      if (eventType === 'LICENSE_ISSUED') {
        const issuedExpiresAt =
          toIsoString(eventPayload.expiresAt ?? commandPayload.expiresAt) ??
          licenseExpiresIso;
        const issuedKeyVersion = Number(
          item.activation_key_version ??
            eventPayload.keyVersion ??
            commandPayload.keyVersion ??
            1,
        );
        const issuedCommitmentRaw =
          typeof item.activation_commitment_hex === 'string'
            ? `0x${item.activation_commitment_hex}`
            : typeof eventPayload.activationCommitment === 'string'
              ? eventPayload.activationCommitment
              : typeof commandPayload.activationCommitment === 'string'
                ? commandPayload.activationCommitment
                : null;

        title = 'Kích hoạt bản quyền';
        description = `License được phát hành và kích hoạt lần đầu trên Blockchain cho sản phẩm ${productName} (${planName}, tối đa ${maxActiveDevices} thiết bị).`;

        changes.push({
          field: 'status',
          label: 'Trạng thái bản quyền',
          previousValue: statusDisplayLabel('PENDING_ONCHAIN'),
          currentValue: statusDisplayLabel('ACTIVE'),
        });
        changes.push({
          field: 'productPlan',
          label: 'Sản phẩm & Gói bản quyền',
          previousValue: null,
          currentValue: `${productName} — ${planName} (v${planVersion})`,
        });
        changes.push({
          field: 'maxActiveDevices',
          label: 'Hạn mức thiết bị tối đa',
          previousValue: null,
          currentValue: `${maxActiveDevices} thiết bị`,
        });
        changes.push({
          field: 'keyVersion',
          label: 'Phiên bản License Key',
          previousValue: null,
          currentValue: `Phiên bản Key v${issuedKeyVersion}`,
        });
        if (issuedCommitmentRaw) {
          changes.push({
            field: 'activationCommitment',
            label: 'Cam kết khóa (Activation Commitment)',
            previousValue: null,
            currentValue: maskCommitmentHex(issuedCommitmentRaw),
          });
        }
        if (issuedExpiresAt) {
          changes.push({
            field: 'expiresAt',
            label: 'Thời hạn hiệu lực ban đầu',
            previousValue: periodStartIso,
            currentValue: issuedExpiresAt,
          });
        }

        runningStatus = 'ACTIVE';
        if (issuedExpiresAt) runningExpiresAt = issuedExpiresAt;
        runningKeyVersion = issuedKeyVersion;
        if (issuedCommitmentRaw) runningCommitment = issuedCommitmentRaw;
      } else if (
        eventType === 'ACTIVE_DEVICE_COUNT_SYNCED' ||
        eventType === 'DEVICE_ACTIVATED' ||
        eventType === 'DEVICE_REVOKED'
      ) {
        const nextDeviceCount =
          typeof eventPayload.activeDeviceCount === 'number'
            ? eventPayload.activeDeviceCount
            : typeof commandPayload.activeDeviceCount === 'number'
              ? commandPayload.activeDeviceCount
              : eventType === 'DEVICE_ACTIVATED'
                ? runningDeviceCount + 1
                : Math.max(0, runningDeviceCount - 1);
        const nextDeviceStateVersion =
          typeof eventPayload.deviceStateVersion === 'number'
            ? eventPayload.deviceStateVersion
            : typeof commandPayload.deviceStateVersion === 'number'
              ? commandPayload.deviceStateVersion
              : runningDeviceStateVersion + 1;

        if (nextDeviceCount > runningDeviceCount || eventType === 'DEVICE_ACTIVATED') {
          title = 'Cập nhật thiết bị kích hoạt';
          description = `Đồng bộ tăng số lượng thiết bị đang hoạt động trên Blockchain: ${runningDeviceCount}/${maxActiveDevices} → ${nextDeviceCount}/${maxActiveDevices} thiết bị.`;
        } else if (nextDeviceCount < runningDeviceCount || eventType === 'DEVICE_REVOKED') {
          title = 'Thu hồi thiết bị & đồng bộ hạn mức';
          description = `Đồng bộ giảm số lượng thiết bị đang hoạt động trên Blockchain: ${runningDeviceCount}/${maxActiveDevices} → ${nextDeviceCount}/${maxActiveDevices} thiết bị.`;
        } else {
          title = 'Đồng bộ trạng thái thiết bị';
          description = `Đồng bộ phiên bản trạng thái thiết bị trên Blockchain (${nextDeviceCount}/${maxActiveDevices} thiết bị đang hoạt động).`;
        }

        changes.push({
          field: 'activeDeviceCount',
          label: 'Số lượng thiết bị hoạt động',
          previousValue: `${runningDeviceCount}/${maxActiveDevices} thiết bị`,
          currentValue: `${nextDeviceCount}/${maxActiveDevices} thiết bị`,
        });
        changes.push({
          field: 'deviceStateVersion',
          label: 'Phiên bản trạng thái thiết bị',
          previousValue: `v${runningDeviceStateVersion}`,
          currentValue: `v${nextDeviceStateVersion}`,
        });

        runningDeviceCount = nextDeviceCount;
        runningDeviceStateVersion = nextDeviceStateVersion;
      } else if (eventType === 'KEY_ROTATED') {
        const prevKeyVer = Number(
          item.previous_activation_key_version ??
            commandPayload.previousKeyVersion ??
            runningKeyVersion,
        );
        const nextKeyVer = Number(
          item.activation_key_version ??
            eventPayload.keyVersion ??
            commandPayload.keyVersion ??
            prevKeyVer + 1,
        );
        const prevCommitRaw =
          typeof item.previous_activation_commitment_hex === 'string'
            ? `0x${item.previous_activation_commitment_hex}`
            : typeof commandPayload.previousActivationCommitment === 'string'
              ? commandPayload.previousActivationCommitment
              : runningCommitment;
        const nextCommitRaw =
          typeof item.activation_commitment_hex === 'string'
            ? `0x${item.activation_commitment_hex}`
            : typeof eventPayload.activationCommitment === 'string'
              ? eventPayload.activationCommitment
              : typeof commandPayload.activationCommitment === 'string'
                ? commandPayload.activationCommitment
                : null;

        title = 'Cấp lại License Key';
        description = `Khóa kích hoạt cũ (Phiên bản Key v${prevKeyVer}) đã bị thu hồi hiệu lực và thay thế bằng khóa mới (Phiên bản Key v${nextKeyVer}) trên Blockchain.`;

        changes.push({
          field: 'keyVersion',
          label: 'Phiên bản License Key',
          previousValue: `Phiên bản Key v${prevKeyVer}`,
          currentValue: `Phiên bản Key v${nextKeyVer}`,
        });
        if (prevCommitRaw || nextCommitRaw) {
          changes.push({
            field: 'activationCommitment',
            label: 'Cam kết khóa (Activation Commitment)',
            previousValue: maskCommitmentHex(prevCommitRaw),
            currentValue: maskCommitmentHex(nextCommitRaw),
          });
        }
        changes.push({
          field: 'previousKeyStatus',
          label: 'Trạng thái Key trước đó',
          previousValue: `Key v${prevKeyVer} (Có hiệu lực)`,
          currentValue: `Key v${prevKeyVer} (Đã vô hiệu hóa khi cấp lại)`,
        });

        runningKeyVersion = nextKeyVer;
        if (nextCommitRaw) runningCommitment = nextCommitRaw;
      } else if (eventType === 'LICENSE_RENEWED') {
        const nextExpiresAt =
          toIsoString(eventPayload.expiresAt ?? commandPayload.expiresAt) ??
          licenseExpiresIso;

        title = 'Gia hạn bản quyền';
        description = `Thời hạn sử dụng của License được gia hạn trên Blockchain.`;

        changes.push({
          field: 'expiresAt',
          label: 'Ngày hết hạn',
          previousValue: runningExpiresAt,
          currentValue: nextExpiresAt,
        });
        if (runningStatus !== 'ACTIVE') {
          changes.push({
            field: 'status',
            label: 'Trạng thái bản quyền',
            previousValue: statusDisplayLabel(runningStatus),
            currentValue: statusDisplayLabel('ACTIVE'),
          });
        }

        if (nextExpiresAt) runningExpiresAt = nextExpiresAt;
        runningStatus = 'ACTIVE';
      } else if (eventType === 'LICENSE_SUSPENDED') {
        const reason =
          typeof commandPayload.reason === 'string' && commandPayload.reason.trim().length > 0
            ? commandPayload.reason.trim()
            : null;
        title = 'Tạm khóa bản quyền';
        description = reason
          ? `Bản quyền bị tạm khóa trên Blockchain. Lý do: ${reason}.`
          : 'Bản quyền bị tạm khóa trên Blockchain.';

        changes.push({
          field: 'status',
          label: 'Trạng thái bản quyền',
          previousValue: statusDisplayLabel(runningStatus),
          currentValue: statusDisplayLabel('SUSPENDED'),
        });
        if (reason) {
          changes.push({
            field: 'reason',
            label: 'Lý do tạm khóa',
            previousValue: null,
            currentValue: reason,
          });
        }
        runningStatus = 'SUSPENDED';
      } else if (eventType === 'LICENSE_RESUMED') {
        const reason =
          typeof commandPayload.reason === 'string' && commandPayload.reason.trim().length > 0
            ? commandPayload.reason.trim()
            : null;
        title = 'Khôi phục bản quyền';
        description = reason
          ? `Bản quyền được mở khóa và khôi phục hoạt động trên Blockchain. Ghi chú: ${reason}.`
          : 'Bản quyền được mở khóa và khôi phục trạng thái hoạt động trên Blockchain.';

        changes.push({
          field: 'status',
          label: 'Trạng thái bản quyền',
          previousValue: statusDisplayLabel(runningStatus),
          currentValue: statusDisplayLabel('ACTIVE'),
        });
        runningStatus = 'ACTIVE';
      } else if (eventType === 'LICENSE_REVOKED') {
        const reason =
          typeof commandPayload.reason === 'string' && commandPayload.reason.trim().length > 0
            ? commandPayload.reason.trim()
            : null;
        title = 'Thu hồi bản quyền';
        description = reason
          ? `Bản quyền đã bị thu hồi vĩnh viễn trên Blockchain. Lý do: ${reason}.`
          : 'Bản quyền đã bị thu hồi vĩnh viễn trên Blockchain.';

        changes.push({
          field: 'status',
          label: 'Trạng thái bản quyền',
          previousValue: statusDisplayLabel(runningStatus),
          currentValue: statusDisplayLabel('REVOKED'),
        });
        if (reason) {
          changes.push({
            field: 'reason',
            label: 'Lý do thu hồi',
            previousValue: null,
            currentValue: reason,
          });
        }
        runningStatus = 'REVOKED';
      }

      history.push({
        id: textValue(item.event_id ?? item.command_id, `evt-${history.length + 1}`),
        eventType,
        title,
        description,
        status,
        occurredAt,
        blockTimestamp,
        observedAt,
        finalizedAt,
        transactionHash: txHash,
        blockNumber:
          item.block_number === null || item.block_number === undefined
            ? null
            : Number(item.block_number),
        blockHash: typeof item.block_hash === 'string' ? item.block_hash : null,
        logIndex:
          item.log_index === null || item.log_index === undefined
            ? null
            : Number(item.log_index),
        transactionIndex:
          typeof eventPayload.transactionIndex === 'number'
            ? eventPayload.transactionIndex
            : null,
        confirmationCount: Number(item.confirmation_count ?? 0),
        commandId: typeof item.command_id === 'string' ? item.command_id : null,
        commandSequence:
          item.command_sequence === null || item.command_sequence === undefined
            ? null
            : Number(item.command_sequence),
        network,
        chainId,
        contractAddress,
        explorerTxUrl,
        changes,
      });
    }

    const hasIssuedEvent = history.some((evt) => evt.eventType === 'LICENSE_ISSUED');
    const hasConfirmedEvents = history.some((evt) => evt.status === 'CONFIRMED');
    const hasPendingOrReorged = history.some((evt) => evt.status !== 'CONFIRMED');
    const historyComplete = history.length > 0 && hasIssuedEvent;

    let historyNote: string | null = null;
    if (history.length === 0) {
      historyNote =
        'Chưa có giao dịch hoặc sự kiện Blockchain nào được ghi nhận cho mã bản quyền này.';
    } else if (!hasIssuedEvent) {
      historyNote =
        'Chỉ truy xuất được một phần lịch sử từ các khối đã đồng bộ; thiếu sự kiện phát hành gốc (LICENSE_ISSUED).';
    } else if (hasPendingOrReorged) {
      historyNote =
        'Lịch sử bao gồm giao dịch đang chờ đủ số khối xác nhận (Pending) hoặc cần đồng bộ lại trên Blockchain.';
    }

    const explorerBase = explorerBaseUrl(latestNetwork, latestChainId);
    const explorerUrl =
      explorerBase && latestContractAddress
        ? `${explorerBase}/address/${latestContractAddress}`
        : explorerBase;

    const historySource: 'ONCHAIN_VERIFIED' | 'INDEXED_ONCHAIN_LOGS' | 'UNVERIFIED_PENDING' =
      hasConfirmedEvents ? 'INDEXED_ONCHAIN_LOGS' : 'UNVERIFIED_PENDING';

    return {
      history,
      historyComplete,
      historyNote,
      historySource,
      network: latestNetwork,
      chainId: latestChainId,
      contractAddress: latestContractAddress,
      explorerUrl,
    };
  }

  async activationCommand(customerUserId: string, id: string, connection: Pick<Pool, 'query'> = this.pool) {
    const result = await connection.query<{
      command_id: string;
      commitment: string;
      key_version: number;
      license_id: string;
    }>(
       `SELECT cc.id AS command_id, l.id AS license_id,
          ('0x' || encode(l.activation_commitment, 'hex')) AS commitment,
          l.activation_key_version AS key_version
         FROM licenses l JOIN chain_commands cc ON cc.license_id=l.id
           AND cc.command_type IN ('ISSUE_LICENSE','ROTATE_KEY') AND cc.status='CONFIRMED'
         JOIN chain_events ce ON ce.chain_command_id=cc.id
           AND ce.finality_status='CONFIRMED'
           AND ce.event_type = CASE cc.command_type
             WHEN 'ISSUE_LICENSE' THEN 'LICENSE_ISSUED'
             WHEN 'ROTATE_KEY' THEN 'KEY_ROTATED'
           END
          WHERE l.id=$1 AND l.status='ACTIVE' AND l.expires_at > now()
            AND l.activation_key_trust_status='TRUSTED'
            AND l.customer_user_id=$2
         ORDER BY cc.confirmed_at DESC LIMIT 1`,
      [id, customerUserId],
    );
    return result.rows[0] ?? null;
  }

  async entitlementContext(licenseId: string, deviceId: string) {
    const result = await this.pool.query<Record<string, unknown>>(
       `SELECT l.status, l.expires_at, l.entitlement_version, l.activation_key_version,
                d.status AS device_status,
                d.binding_generation,
                license_event.finality_status AS license_finality,
                p.entitlements
         FROM licenses l
         JOIN license_devices d ON d.license_id=l.id AND d.id=$2
         JOIN plans p ON p.id=l.plan_id
         LEFT JOIN chain_events license_event ON license_event.id=l.last_applied_chain_event_id
         WHERE l.id=$1
           AND license_event.finality_status='CONFIRMED'`,
       [licenseId, deviceId],
    );
    const row = result.rows[0];
    return row
      ? {
           bindingGeneration: Number(row.binding_generation),
           deviceStatus: String(row.device_status),
           entitlementVersion: Number(row.entitlement_version),
          entitlements: (row.entitlements ?? {}) as Record<string, unknown>,
           expiresAt: new Date(String(row.expires_at)),
            licenseFinality: String(row.license_finality),
           keyVersion: Number(row.activation_key_version),
          status: String(row.status),
        }
      : null;
  }

  private map(row: Record<string, unknown>) {
    return {
      fulfillmentMode: typeof row.fulfillment_mode==='string' ? row.fulfillment_mode : 'LEGACY_DEVICE',
      providerRevision: Number(row.provider_revision ?? 0),
      providerDeliveryStatus: typeof row.provider_delivery_status==='string' ? row.provider_delivery_status : null,
      providerAcceptedAt: row.provider_accepted_at instanceof Date ? row.provider_accepted_at.toISOString() : null,
      blockNumber: row.block_number === null ? null : Number(row.block_number),
      confirmationCount: Number(row.confirmation_count ?? 0),
      createdAt: row.created_at,
      entitlementVersion: Number(row.entitlement_version),
      expiresAt: row.expires_at,
      finality: row.finality_status ?? 'PENDING',
      id: row.id,
      keyVersion: Number(row.activation_key_version),
      activationKeyLast4:
        typeof row.activation_key_last4 === 'string' && /^[0-9a-f]{4}$/.test(row.activation_key_last4)
          ? row.activation_key_last4
          : null,
      activationKeyTrustStatus:
        typeof row.activation_key_trust_status === 'string'
          ? row.activation_key_trust_status
          : 'PENDING_FINALITY',
       activeDeviceCount: Number(row.active_device_count ?? 0),
       deviceStateVersion: Number(row.device_state_version ?? 0),
       maxActiveDevices: Number(row.max_active_devices),
      originOrderId: String(row.origin_order_id),
      periodStart: row.period_start,
      plan: {
        commitment: `0x${String(row.plan_commitment)}`,
        name: String(row.plan_name),
        version: Number(row.plan_version),
      },
      productName: String(row.product_name),
      provider: {
        displayName: String(row.provider_display_name),
        organizationName:
          typeof row.provider_organization_name === 'string'
            ? row.provider_organization_name
            : null,
      },
      publicLicenseId: String(row.public_license_id),
      status: row.status,
      transactionHash: row.transaction_hash,
      updatedAt: row.updated_at,
    };
  }
}
