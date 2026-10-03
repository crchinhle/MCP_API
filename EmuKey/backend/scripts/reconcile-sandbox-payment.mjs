import 'reflect-metadata';
import { readFile } from 'node:fs/promises';
import { parseArgs } from 'node:util';
import { URL } from 'node:url';
import { Pool } from 'pg';
import { Redis } from 'ioredis';
import { validateEnvironment } from '../dist/platform/config/environment.js';
import { CommerceService } from '../dist/modules/commerce-payment/application/commerce.service.js';
import { CommerceRepository } from '../dist/modules/commerce-payment/infrastructure/commerce.repository.js';
import { SePayPaymentGateway } from '../dist/modules/commerce-payment/infrastructure/sepay-payment.gateway.js';
import { RedisActivationEnvelope } from '../dist/modules/blockchain/infrastructure/redis-activation-envelope.js';
import { ChainCommandRepository } from '../dist/modules/blockchain/infrastructure/chain-command.repository.js';
import { ActivationEnvelopeRecoveryService } from '../dist/modules/blockchain/application/activation-envelope-recovery.service.js';

// Local operator CLI, not an HTTP backdoor. Dry-run unless --apply is explicit.
const { values } = parseArgs({ options: {
  transaction: { type: 'string' }, admin: { type: 'string' }, reason: { type: 'string' },
  'confirm-sandbox': { type: 'boolean' }, apply: { type: 'boolean' }, migrate: { type: 'boolean' },
} });
const config = validateEnvironment(process.env);
if (config.NODE_ENV === 'production' || config.PAYMENT_ADAPTER !== 'sepay' ||
    config.SEPAY_ENV !== 'sandbox' || !config.SEPAY_SANDBOX_RECEIPT_TIMING) {
  throw new Error('This command requires explicitly enabled, non-production SePay sandbox receipt timing.');
}
if (!values['confirm-sandbox']) throw new Error('Confirm the historical transaction belongs to sandbox with --confirm-sandbox.');
const pool = new Pool({ connectionString: config.DATABASE_URL });
let redis;
try {
  const schema = await pool.query("SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='payment_transactions' AND column_name='timing_basis') AS installed");
  if (values.migrate) {
    if (!schema.rows[0].installed && values.apply) {
      await pool.query(await readFile(new URL('../database/migrations/20260928-sandbox-payment-timing.sql', import.meta.url), 'utf8'));
    }
    console.log(JSON.stringify({ operation: 'sandbox-payment-timing-migration', applied: !!values.apply, alreadyInstalled: schema.rows[0].installed }));
  } else {
    if (!schema.rows[0].installed) throw new Error('Apply the payment timing migration first.');
    if (!values.transaction || !values.admin || !values.reason?.trim()) throw new Error('--transaction, --admin and --reason are required.');
    const actor = (await pool.query("SELECT id, role, session_version FROM users WHERE id=$1 AND role='SYSTEM_ADMIN' AND status='ACTIVE'", [values.admin])).rows[0];
    if (!actor) throw new Error('An active SYSTEM_ADMIN is required for the audit trail.');
    const evidence = (await pool.query(`SELECT pt.id, pt.order_id, pt.classification, pt.review_status,
      pt.review_reason, pt.timing_basis, pt.provider_occurred_at, pt.received_at,
      o.order_status, pa.status AS attempt_status,
      (pt.received_at >= pa.created_at AND pt.received_at >= o.service_terms_accepted_at
       AND pt.received_at < pa.expires_at AND pt.received_at < o.payment_due_at
       AND pt.received_at < o.ipn_accept_until
       AND (pa.status <> 'SUPERSEDED' OR pt.received_at < pa.superseded_at)) AS receipt_within_window
      FROM payment_transactions pt JOIN payment_attempts pa ON pa.id=pt.payment_attempt_id
      JOIN orders o ON o.id=pt.order_id WHERE pt.id=$1`, [values.transaction])).rows[0];
    if (!evidence) throw new Error('Payment evidence not found.');
    console.log(JSON.stringify({ operation: 'sandbox-payment-reconciliation', dryRun: !values.apply, evidence }));
    if (values.apply) {
      redis = new Redis(config.REDIS_URL, { maxRetriesPerRequest: 1 });
      await redis.ping();
      const envelopes = new RedisActivationEnvelope(redis, config.ACTIVATION_ENVELOPE_KEY);
      const service = new CommerceService(new CommerceRepository(pool), new SePayPaymentGateway({
        environment: 'sandbox', merchantId: config.SEPAY_MERCHANT_ID, secretKey: config.SEPAY_SECRET_KEY,
        webAppUrl: config.WEB_APP_URL, sandboxReceiptTiming: true,
      }), envelopes, new ActivationEnvelopeRecoveryService(new ChainCommandRepository(pool), envelopes), {
        chainId: config.EVM_CHAIN_ID, contractAddress: config.EVM_CONTRACT_ADDRESS, network: config.EVM_NETWORK,
      });
      const result = await service.reconcileSandboxPayment({ role: actor.role, sessionVersion: actor.session_version, sub: actor.id }, values.transaction, values.reason);
      console.log(JSON.stringify({ operation: 'sandbox-payment-reconciled', ...result }));
    }
  }
} finally {
  if (redis) redis.disconnect();
  await pool.end();
}
