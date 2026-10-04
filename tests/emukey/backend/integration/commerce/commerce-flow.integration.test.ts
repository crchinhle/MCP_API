import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

import { NotFoundException } from '@nestjs/common';
import {
  PostgreSqlContainer,
  type StartedPostgreSqlContainer,
} from '@testcontainers/postgresql';
import { RedisContainer, type StartedRedisContainer } from '@testcontainers/redis';
import { Redis } from 'ioredis';
import { Pool } from 'pg';

import { ActivationEnvelopeRecoveryService } from '../../../../../EmuKey/backend/src/modules/blockchain/application/activation-envelope-recovery.service.js';
import { ChainCommandRepository } from '../../../../../EmuKey/backend/src/modules/blockchain/infrastructure/chain-command.repository.js';
import { RedisActivationEnvelope } from '../../../../../EmuKey/backend/src/modules/blockchain/infrastructure/redis-activation-envelope.js';
import { CommerceService } from '../../../../../EmuKey/backend/src/modules/commerce-payment/application/commerce.service.js';
import { CommerceRepository } from '../../../../../EmuKey/backend/src/modules/commerce-payment/infrastructure/commerce.repository.js';
import { FakePaymentGateway } from '../../../../../EmuKey/backend/src/modules/commerce-payment/infrastructure/fake-payment.gateway.js';
import { SePayPaymentGateway } from '../../../../../EmuKey/backend/src/modules/commerce-payment/infrastructure/sepay-payment.gateway.js';
import { seedBaseline } from '../../../../../EmuKey/backend/src/platform/database/seed-baseline.js';

describe('customer commerce and payment flow', () => {
  let postgres: StartedPostgreSqlContainer;
  let redisContainer: StartedRedisContainer;
  let pool: Pool;
  let redis: Redis;
  let service: CommerceService;
  const customer = { role: 'CUSTOMER' as const, sessionVersion: 1, sub: '00000000-0000-4000-8000-000000000004' };
  const otherCustomer = { ...customer, sub: '00000000-0000-4000-8000-000000000099' };
  const planId = '00000000-0000-4000-8000-000000000301';
  const webhookSecret = 'commerce-integration-secret';
  const admin = { role: 'SYSTEM_ADMIN' as const, sessionVersion: 1, sub: '00000000-0000-4000-8000-000000000001' };
  function sandboxService(receiptTiming: boolean) {
    const envelopes = new RedisActivationEnvelope(redis, '00'.repeat(32));
    return new CommerceService(new CommerceRepository(pool), new SePayPaymentGateway({ environment: 'sandbox', merchantId: 'test', secretKey: webhookSecret, webAppUrl: 'https://demo.test', sandboxReceiptTiming: receiptTiming }), envelopes, new ActivationEnvelopeRecoveryService(new ChainCommandRepository(pool), envelopes), { chainId: 11155111, contractAddress: '0x5FbDB2315678afecb367f032d93F642f64180aa3', network: 'sepolia' });
  }
  function sandboxPayload(reference: string, amount: number, eventId: string) {
    return { notification_type: 'ORDER_PAID', order: { order_amount: String(amount), order_currency: 'VND', order_invoice_number: reference, order_status: 'CAPTURED' }, transaction: { id: eventId, transaction_amount: String(amount), transaction_currency: 'VND', transaction_id: `bank-${eventId}`, transaction_status: 'APPROVED', transaction_type: 'PAYMENT', transaction_date: '2025-09-01 00:00:15' } };
  }

  async function acceptTerms(orderId: string) {
    const terms = await service.getServiceTerms(customer, orderId);
    return service.acceptServiceTerms(customer, orderId, {
      accepted: true, hash: terms.hash, version: terms.version,
    });
  }

  beforeAll(async () => {
    [postgres, redisContainer] = await Promise.all([
      new PostgreSqlContainer('pgvector/pgvector:pg15')
        .withDatabase('emukey_commerce_test')
        .withUsername('emukey')
        .withPassword('test-password')
        .start(),
      new RedisContainer('redis:8.2-alpine').start(),
    ]);
    pool = new Pool({ connectionString: postgres.getConnectionUri() });
    const schema = await readFile(resolve(process.cwd(), 'database/schema.sql'), 'utf8');
    // Exercise upgrading the pre-policy schema, not only fresh installations.
    const legacySchema = schema
      .replace(/\x20{4}service_terms_version_snapshot VARCHAR\(40\),\r?\n\x20{4}service_terms_hash_snapshot CHAR\(64\),\r?\n\x20{4}service_terms_content_snapshot TEXT,\r?\n/, '')
      .replace(/\x20{4}CONSTRAINT ck_orders_terms_snapshot CHECK \([\s\S]*?\r?\n\x20{4}\),\r?\n\x20{4}CONSTRAINT ck_orders_payment_gate/, '    CONSTRAINT ck_orders_payment_gate')
      .replace(/\x20{11}NEW\.created_at,\r?\n\x20{11}NEW\.service_terms_version_snapshot, NEW\.service_terms_hash_snapshot,\r?\n\x20{11}NEW\.service_terms_content_snapshot\)\r?\n\x20{7}IS DISTINCT FROM\r?\n\x20{7}ROW\(([^]*?)\x20{11}OLD\.created_at,\r?\n\x20{11}OLD\.service_terms_version_snapshot, OLD\.service_terms_hash_snapshot,\r?\n\x20{11}OLD\.service_terms_content_snapshot\) THEN/, '           NEW.created_at)\n       IS DISTINCT FROM\n       ROW($1           OLD.created_at) THEN')
      .replace(/\x20{4}timing_basis VARCHAR\(30\)[\s\S]*?CHECK \(timing_basis IN \('PROVIDER', 'SANDBOX_RECEIPT'\)\),\r?\n/, '')
      .replace(/-- Sandbox receipt timing[\s\S]*?(?=-- Callers supply provider_occurred_at)/, '')
      .replaceAll('payment_effective_time(pt)', 'pt.provider_occurred_at')
      .replaceAll('payment_effective_time(NEW)', 'NEW.provider_occurred_at');
    await pool.query(legacySchema);
    await pool.query(await readFile(resolve(process.cwd(), 'database/migrations/20260928-sandbox-payment-timing.sql'), 'utf8'));
    await pool.query(await readFile(resolve(process.cwd(), 'database/migrations/20260929-order-auto-cancellation.sql'), 'utf8'));
    await pool.query(await readFile(resolve(process.cwd(), 'database/migrations/20260930-order-service-terms-snapshot.sql'), 'utf8'));
    await seedBaseline(pool, 'Commerce-test@123');
    redis = new Redis(redisContainer.getConnectionUrl());
    const envelopes = new RedisActivationEnvelope(redis, '00'.repeat(32));
    service = new CommerceService(
      new CommerceRepository(pool),
      new FakePaymentGateway(webhookSecret),
      envelopes,
      new ActivationEnvelopeRecoveryService(new ChainCommandRepository(pool), envelopes),
      {
        chainId: 11_155_111,
        contractAddress: '0x5FbDB2315678afecb367f032d93F642f64180aa3',
        network: 'sepolia',
      },
    );
  }, 120_000);

  afterAll(async () => {
    if (redis) await redis.quit();
    if (pool) await pool.end();
    await Promise.all([postgres?.stop(), redisContainer?.stop()]);
  });

  it('uses a customer-scoped idempotency key and enforces ownership', async () => {
    const idempotencyKey = '00000000-0000-4000-8000-000000000701';
    const first = await service.createOrder(customer, idempotencyKey, undefined, { planId });
    const repeated = await service.createOrder(customer, idempotencyKey, undefined, { planId });
    expect(repeated.id).toBe(first.id);
    expect(first.customerUserId).toBe(customer.sub);

    await expect(service.findOrder(otherCustomer, first.id)).rejects.toBeInstanceOf(
      NotFoundException,
    );
    const stored = await pool.query<{
      customer_user_id: string;
      idempotency_key: string;
      ipn_delivery_grace_seconds: number;
    }>(
      `SELECT customer_user_id, idempotency_key,
              extract(epoch FROM ipn_accept_until - payment_due_at)::integer
                AS ipn_delivery_grace_seconds
       FROM orders WHERE id=$1`,
      [first.id],
    );
    expect(stored.rows[0]).toEqual({
      customer_user_id: customer.sub,
      idempotency_key: idempotencyKey,
      ipn_delivery_grace_seconds: 86_400,
    });
  });

  it('auto-cancels overdue unpaid orders once and accepts only an on-time delayed payment', async () => {
    const repo = new CommerceRepository(pool);
    const original = await service.createOrder(customer, '00000000-0000-4000-8000-000000000710', undefined, { planId });
    expect(original.paymentDueAt.getTime() - original.createdAt.getTime()).toBe(30 * 60_000);
    const overdueId = '00000000-0000-4000-8000-000000000711';
    const termsPendingId = '00000000-0000-4000-8000-000000000715';
    for (const fixtureId of [overdueId, termsPendingId]) await pool.query(`INSERT INTO orders (id, order_number, idempotency_key, customer_user_id, provider_user_id,
      product_id, plan_id, order_type, provider_name_snapshot, product_name_snapshot, plan_name_snapshot,
      plan_version_snapshot, price_vnd_snapshot, billing_cycle_snapshot, duration_months_snapshot,
      max_active_devices_snapshot, entitlements_snapshot, plan_commitment_snapshot,
      service_terms_version_snapshot, service_terms_hash_snapshot, service_terms_content_snapshot,
      payment_due_at, ipn_accept_until)
      SELECT $2::uuid, 'TIMEOUT-' || $2::text, $2::uuid, customer_user_id, provider_user_id, product_id, plan_id, order_type,
      provider_name_snapshot, product_name_snapshot, plan_name_snapshot, plan_version_snapshot, price_vnd_snapshot,
      billing_cycle_snapshot, duration_months_snapshot, max_active_devices_snapshot, entitlements_snapshot,
      plan_commitment_snapshot, service_terms_version_snapshot, service_terms_hash_snapshot, service_terms_content_snapshot,
      statement_timestamp()+interval '2 seconds', statement_timestamp()+interval '60 seconds'
      FROM orders WHERE id=$1`, [original.id, fixtureId]);
    await acceptTerms(overdueId);
    const checkout = await service.checkout(customer, overdueId);
    const occurredAt = (await pool.query<{ at: Date }>('SELECT statement_timestamp() AS at')).rows[0]!.at;
    await pool.query('SELECT pg_sleep(2.1)');
    await Promise.all([repo.cancelOverdueOrders(), repo.cancelOverdueOrders()]);
    expect((await repo.findOrder(customer.sub, overdueId))?.orderStatus).toBe('CANCELLED');
    expect((await repo.findOrder(customer.sub, termsPendingId))?.orderStatus).toBe('CANCELLED');
    expect((await repo.findOrder(customer.sub, original.id))?.orderStatus).toBe('WAITING_SERVICE_TERMS_ACCEPTANCE');
    expect((await pool.query<{ n: number }>("SELECT count(*)::int AS n FROM audit_logs WHERE action='ORDER_AUTO_CANCELLED' AND target_id=$1", [overdueId])).rows[0]!.n).toBe(1);
    const payment = { amountVnd: original.priceVndSnapshot, protocolVersion: 1 as const, eventId: 'late-timeout', occurredAt, providerReference: checkout.checkoutReference };
    const issuance = { activationCommitment: `0x${'77'.repeat(32)}` as const, commandId: '00000000-0000-4000-8000-000000000712', licenseId: '00000000-0000-4000-8000-000000000713', payload: {}, payloadHash: `0x${'88'.repeat(32)}` as const };
    const chain = { chainId: 11155111, contractAddress: '0x5FbDB2315678afecb367f032d93F642f64180aa3', network: 'sepolia' };
    const tooLate = (await pool.query<{ at: Date }>('SELECT statement_timestamp() AS at')).rows[0]!.at;
    expect((await repo.ingestPayment({ ...payment, eventId: 'paid-after-deadline', occurredAt: tooLate }, {}, issuance, chain)).classification).toBe('UNMATCHED');
    const manual = await service.createOrder(customer, '00000000-0000-4000-8000-000000000714', undefined, { planId });
    await acceptTerms(manual.id);
    const manualCheckout = await service.checkout(customer, manual.id);
    await service.cancelOrder(customer, manual.id);
    expect((await repo.ingestPayment({ ...payment, eventId: 'manual-cancelled', providerReference: manualCheckout.checkoutReference, occurredAt: (await pool.query<{ at: Date }>('SELECT statement_timestamp() AS at')).rows[0]!.at }, {}, issuance, chain)).classification).toBe('UNMATCHED');
    const result = await repo.ingestPayment(payment, {}, issuance, chain);
    expect(result.classification).toBe('MATCHED');
    expect((await repo.ingestPayment(payment, {}, issuance, chain)).classification).toBe('DUPLICATE');
    await repo.cancelOverdueOrders();
    expect((await repo.findOrder(customer.sub, overdueId))?.orderStatus).toBe('PAYMENT_ACCEPTED');
  });

  it('accepts payment and creates a license owned by the customer account', async () => {
    const order = await service.createOrder(customer, '00000000-0000-4000-8000-000000000702', undefined, { planId });
    await acceptTerms(order.id);
    const checkout = await service.checkout(customer, order.id);
    const providerClock = await pool.query<{ occurred_at: Date }>(
      "SELECT statement_timestamp() + interval '1 second' AS occurred_at",
    );
    const payment = await service.ingestIpn(
      {
        amountVnd: order.priceVndSnapshot,
        eventId: 'customer-payment-event-1',
        occurredAt: providerClock.rows[0]!.occurred_at.toISOString(),
        providerReference: checkout.checkoutReference,
      },
      webhookSecret,
    );
    expect(payment).toMatchObject({ activationRequired: true, classification: 'MATCHED' });
    const license = await pool.query<{ customer_user_id: string }>(
      'SELECT customer_user_id FROM licenses WHERE origin_order_id=$1',
      [order.id],
    );
    expect(license.rows[0]?.customer_user_id).toBe(customer.sub);
  });

  it('uses database receipt for sandbox without rewriting provider time and rejects wrong amounts', async () => {
    const sandbox = sandboxService(true);
    const order = await service.createOrder(customer, '00000000-0000-4000-8000-000000000703', undefined, { planId });
    await acceptTerms(order.id);
    const checkout = await service.checkout(customer, order.id);
    const payload = sandboxPayload(checkout.checkoutReference, order.priceVndSnapshot, 'sandbox-clock-drift');
    await expect(sandbox.ingestIpn(payload, 'wrong')).rejects.toThrow();
    const wrong = await sandbox.ingestIpn(sandboxPayload(checkout.checkoutReference, 1, 'sandbox-wrong-amount'), webhookSecret);
    expect(wrong.classification).toBe('AMOUNT_MISMATCH');
    const results = await Promise.all([sandbox.ingestIpn(payload, webhookSecret), sandbox.ingestIpn(payload, webhookSecret)]);
    expect(results.map(r => r.classification).sort()).toEqual(['DUPLICATE', 'MATCHED']);
    const evidence = await pool.query(`SELECT pt.*, l.period_start = pt.received_at AS exact_period FROM payment_transactions pt JOIN licenses l ON l.origin_order_id = pt.order_id WHERE pt.provider_event_id = $1`, ['sandbox-clock-drift']);
    expect(evidence.rows[0]).toMatchObject({ timing_basis: 'SANDBOX_RECEIPT', provider_occurred_at: new Date('2025-08-31T17:00:15Z'), exact_period: true });
  });

  it('reconciles stored clock-drift evidence once with administrator audit and preserves source evidence', async () => {
    const order = await service.createOrder(customer, '00000000-0000-4000-8000-000000000704', undefined, { planId });
    await acceptTerms(order.id);
    const checkout = await service.checkout(customer, order.id);
    const payload = sandboxPayload(checkout.checkoutReference, order.priceVndSnapshot, 'sandbox-legacy');
    const rejected = await sandboxService(false).ingestIpn(payload, webhookSecret);
    expect(rejected.classification).toBe('UNMATCHED');
    const before = (await pool.query<Record<string, unknown>>('SELECT * FROM payment_transactions WHERE id=$1', [rejected.transactionId])).rows[0]!;
    await expect(pool.query("UPDATE payment_transactions SET timing_basis='SANDBOX_RECEIPT' WHERE id=$1", [rejected.transactionId])).rejects.toThrow('Payment timing basis is immutable');
    await expect(sandboxService(true).reconcileSandboxPayment(customer, rejected.transactionId, 'sandbox clock repair')).rejects.toThrow();
    await expect(sandboxService(false).reconcileSandboxPayment(admin, rejected.transactionId, 'sandbox clock repair')).rejects.toThrow();
    const results = await Promise.all([sandboxService(true).reconcileSandboxPayment(admin, rejected.transactionId, 'sandbox clock repair'), sandboxService(true).reconcileSandboxPayment(admin, rejected.transactionId, 'sandbox clock repair')]);
    expect(results.map(r => r.classification).sort()).toEqual(['DUPLICATE', 'MATCHED']);
    const after = (await pool.query<Record<string, unknown>>('SELECT * FROM payment_transactions WHERE id=$1', [rejected.transactionId])).rows[0];
    expect(after).toMatchObject({ classification: 'UNMATCHED', review_status: 'RESOLVED', review_resolution: 'ACCEPT_AND_FULFILL', timing_basis: 'SANDBOX_RECEIPT', received_at: before.received_at, provider_occurred_at: before.provider_occurred_at, raw_payload: before.raw_payload });
    expect((await service.findOrder(customer, order.id)).orderStatus).toBe('PAYMENT_ACCEPTED');
    expect(await service.getPaymentReceipt(customer, rejected.transactionId)).toMatchObject({ orderId: order.id });
    expect((await pool.query<{ count: number }>('SELECT count(*)::int AS count FROM licenses WHERE origin_order_id=$1', [order.id])).rows[0]!.count).toBe(1);
    expect((await pool.query<{ count: number }>('SELECT count(*)::int AS count FROM chain_commands WHERE order_id=$1', [order.id])).rows[0]!.count).toBe(1);
    expect((await pool.query<{ count: number }>("SELECT count(*)::int AS count FROM audit_logs WHERE target_id=$1 AND action='SANDBOX_PAYMENT_RECONCILED'", [rejected.transactionId])).rows[0]!.count).toBe(1);
    await expect(pool.query("UPDATE payment_transactions SET timing_basis='PROVIDER' WHERE id=$1", [rejected.transactionId])).rejects.toThrow();
  });

  it('does not accept sandbox callbacks received after attempt expiry or revive a cancelled order', async () => {
    const order = await service.createOrder(customer, '00000000-0000-4000-8000-000000000705', undefined, { planId });
    await acceptTerms(order.id);
    const attemptId = '00000000-0000-4000-8000-000000000805';
    await pool.query("INSERT INTO payment_attempts (id, order_id, attempt_no, provider_reference, amount_vnd, expires_at) VALUES ($1::uuid,$2,1,$1::text,$3,statement_timestamp()+interval '1 second')", [attemptId, order.id, order.priceVndSnapshot]);
    await pool.query('SELECT pg_sleep(1.1)');
    const expired = await sandboxService(true).ingestIpn(sandboxPayload(attemptId, order.priceVndSnapshot, 'sandbox-expired'), webhookSecret);
    expect(expired.classification).toBe('UNMATCHED');
    await expect(sandboxService(true).reconcileSandboxPayment(admin, expired.transactionId, 'cannot rescue expired receipt')).rejects.toThrow('SANDBOX_PAYMENT_OUTSIDE_ACCEPTED_WINDOW');
    await pool.query("UPDATE payment_attempts SET status='EXPIRED' WHERE id=$1", [attemptId]);
    await service.cancelOrder(customer, order.id);
    const cancelled = await sandboxService(true).ingestIpn(sandboxPayload(attemptId, order.priceVndSnapshot, 'sandbox-cancelled'), webhookSecret);
    expect(cancelled.classification).toBe('UNMATCHED');
    expect((await pool.query<{ count: number }>('SELECT count(*)::int AS count FROM licenses WHERE origin_order_id=$1', [order.id])).rows[0]!.count).toBe(0);
  });

  it('recovers a pre-signing failure using its reserved nonce, but rejects recovery after signing', async () => {
    const order = await service.createOrder(customer, '00000000-0000-4000-8000-000000000706', undefined, { planId });
    await acceptTerms(order.id);
    const checkout = await service.checkout(customer, order.id);
    const payment = await sandboxService(true).ingestIpn(sandboxPayload(checkout.checkoutReference, order.priceVndSnapshot, 'reserved-nonce-recovery'), webhookSecret);
    const commands = new ChainCommandRepository(pool);
    const relayer = '0x0000000000000000000000000000000000001337';
    await commands.reserveNonce(payment.commandId!, relayer, 27);
    await commands.markFailure(payment.commandId!, 5, 'Invalid UUID');
    const recovered = await commands.recoverDeadLetter(payment.commandId!, 'REQUEUE_NO_SUBMISSION', 'Fixed catalog UUID encoding', undefined, { userId: admin.sub, role: admin.role });
    expect(recovered).toMatchObject({ status: 'PENDING', nonce: 27, relayerAddress: relayer, signedTransaction: null, transactionHash: null });
    await commands.markPrepared(payment.commandId!, { network: 'sepolia', nonce: 27, relayerAddress: relayer, rawTransaction: '0x02aabb', transactionHash: `0x${'aa'.repeat(32)}` });
    await commands.markFailure(payment.commandId!, 5, 'Broadcast failed');
    await expect(commands.recoverDeadLetter(payment.commandId!, 'REQUEUE_NO_SUBMISSION', 'Must reconcile same raw')).rejects.toThrow('DEAD_LETTER_SUBMISSION_EVIDENCE_EXISTS');
  });
});
