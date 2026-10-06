import { createRequire } from 'node:module';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

import { expect, test } from '@playwright/test';
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts';

const workspace = resolve(process.cwd(), '../..');
const evidencePath = resolve(workspace, 'docs/emukey/traceability/canonical-e2e-golden-flow.json');
const requireBackend = createRequire(resolve(workspace, 'EmuKey/backend/package.json'));

// Local E2E fallback only: canonical runner may supply explicit identity via environment.
// Password never leaves process memory; evidence and logs must never include this value.
const email = process.env.E2E_CUSTOMER_EMAIL ?? 'customer@example.test';
const password = process.env.E2E_CUSTOMER_PASSWORD ?? process.env.SEED_PASSWORD;
const otherEmail = process.env.E2E_OTHER_CUSTOMER_EMAIL;
const otherPassword = process.env.E2E_OTHER_CUSTOMER_PASSWORD;
const runId = process.env.E2E_RUN_ID ?? `canonical-${new Date().toISOString().replace(/[-:.TZ]/g, '')}`;
const apiBaseUrl = process.env.E2E_API_BASE_URL
  ?? new URL('/api/v1', process.env.BASE_URL ?? 'http://localhost:5173').toString().replace(/\/$/, '');

type FailureCode =
  | 'PURCHASE_FAILED' | 'PAYMENT_CALLBACK_FAILED' | 'PAYMENT_IPN_NOT_RECEIVED' | 'PAYMENT_IPN_REJECTED'
  | 'SEPAY_PROVIDER_UI_BLOCKED' | 'ISSUE_COMMAND_MISSING' | 'SEPOLIA_TX_FAILED'
  | 'ISSUE_EVENT_NOT_INDEXED' | 'LICENSE_NOT_ACTIVE' | 'KEY_RETRIEVAL_FAILED' | 'ACTIVATION_FAILED'
  | 'ENTITLEMENT_FAILED' | 'SYNC_COMMAND_MISSING' | 'SYNC_TX_FAILED' | 'SYNC_EVENT_NOT_INDEXED'
  | 'FINAL_UI_MISMATCH' | 'BLOCKED_INFRASTRUCTURE_REDIS';

type PaymentState = {
  orderStatus: string | null;
  attemptStatus: string | null;
  transactionId: string | null;
  classification: string | null;
  providerEventId: string | null;
  providerTransactionReference: string | null;
  reviewReason: string | null;
};

type ReadOnlyPool = {
  query: (text: string, values: string[]) => Promise<{ rows: Array<Record<string, unknown>> }>;
  end: () => Promise<void>;
};

const evidence = {
  status: 'RUNNING' as 'PASS' | 'FAIL' | 'BLOCKED',
  failedPhase: null as string | null,
  failureCode: null as FailureCode | null,
  executionMode: 'REAL_SEPAY_PROVIDER_UI' as 'REAL_SEPAY_PROVIDER_UI' | 'OPERATOR_ASSISTED_EXTERNAL_PROVIDER',
  realIpn: false,
  runId,
  purchase: {} as Record<string, unknown>,
  payment: {} as Record<string, unknown>,
  license: {} as Record<string, unknown>,
  issue: {} as Record<string, unknown>,
  activation: {} as Record<string, unknown>,
  entitlement: {} as Record<string, unknown>,
  deviceSync: {} as Record<string, unknown>,
  timeline: {} as Record<string, unknown>,
};

let phase = 'purchase';
let paymentPool: ReadOnlyPool | undefined;
async function persistEvidence(): Promise<void> {
  await mkdir(dirname(evidencePath), { recursive: true });
  await writeFile(evidencePath, `${JSON.stringify(evidence, null, 2)}\n`, 'utf8');
}

async function readEnvironmentValue(name: string): Promise<string | undefined> {
  const environment = await readFile(resolve(workspace, 'EmuKey/backend/.env'), 'utf8');
  return environment.split(/\r?\n/)
    .find((line) => line.startsWith(`${name}=`))
    ?.slice(name.length + 1)
    .trim();
}

async function readCurrentPaymentState(
  pool: ReadOnlyPool,
  orderId: string,
  attemptId: string,
): Promise<PaymentState> {
  const result = await pool.query(
    `SELECT o.order_status, pa.status AS attempt_status,
            pt.id AS transaction_id, pt.classification, pt.provider_event_id,
            pt.provider_transaction_ref, pt.review_reason
       FROM orders o
       LEFT JOIN payment_attempts pa ON pa.id = $2 AND pa.order_id = o.id
       LEFT JOIN payment_transactions pt
         ON (pt.order_id = o.id AND pt.payment_attempt_id = pa.id)
         OR pt.raw_payload->'payload'->'order'->>'order_invoice_number' = pa.provider_reference
      WHERE o.id = $1
      ORDER BY (pt.classification = 'MATCHED') DESC, pt.received_at DESC NULLS LAST
      LIMIT 1`,
    [orderId, attemptId],
  );
  const row = result.rows[0];
  return {
    attemptStatus: typeof row?.attempt_status === 'string' ? row.attempt_status : null,
    classification: typeof row?.classification === 'string' ? row.classification : null,
    orderStatus: typeof row?.order_status === 'string' ? row.order_status : null,
    providerEventId: typeof row?.provider_event_id === 'string' ? row.provider_event_id : null,
    providerTransactionReference:
      typeof row?.provider_transaction_ref === 'string' ? row.provider_transaction_ref : null,
    reviewReason: typeof row?.review_reason === 'string' ? row.review_reason : null,
    transactionId: typeof row?.transaction_id === 'string' ? row.transaction_id : null,
  };
}

function isProviderBlocked(value: string): boolean {
  return /cloudflare|sorry, you have been blocked|unable to access sepay\\.vn|access denied|just a moment|attention required/i.test(value);
}

async function waitForExternalPayment(
  pool: ReadOnlyPool,
  page: { waitForTimeout: (timeout: number) => Promise<void> },
  orderId: string,
  attemptId: string,
): Promise<PaymentState> {
  const deadline = Date.now() + 10 * 60_000;
  let current: PaymentState = {
    attemptStatus: null,
    classification: null,
    orderStatus: null,
    providerEventId: null,
    providerTransactionReference: null,
    reviewReason: null,
    transactionId: null,
  };
  while (Date.now() < deadline) {
    current = await readCurrentPaymentState(pool, orderId, attemptId);
    evidence.payment = {
      ...(evidence.payment as Record<string, unknown> | undefined),
      orderId,
      paymentAttemptId: attemptId,
      orderStatus: current.orderStatus,
      paymentAttemptStatus: current.attemptStatus,
      paymentTransactionId: current.transactionId,
      paymentClassification: current.classification,
      providerEventId: current.providerEventId,
      providerTransactionReference: current.providerTransactionReference,
      paymentMatched: current.classification === 'MATCHED',
    };
    if (current.classification && current.classification !== 'MATCHED') {
      throw new Error(
        `PAYMENT_IPN_REJECTED:${current.classification}:${current.reviewReason ?? 'NO_REVIEW_REASON'}`,
      );
    }
    if (current.orderStatus === 'PAYMENT_ACCEPTED' && current.attemptStatus === 'SUCCEEDED' && !current.classification) {
      throw new Error('PAYMENT_IPN_REJECTED:PAYMENT_ACCEPTED_WITHOUT_MATCHED_TRANSACTION');
    }
    if (
      current.orderStatus === 'PAYMENT_ACCEPTED'
      && current.attemptStatus === 'SUCCEEDED'
      && current.classification === 'MATCHED'
    ) {
      return current;
    }
    await page.waitForTimeout(5_000);
  }
  throw new Error(
    `PAYMENT_IPN_NOT_RECEIVED:orderStatus=${current.orderStatus ?? 'UNKNOWN'},attemptStatus=${current.attemptStatus ?? 'UNKNOWN'}`,
  );
}

test('canonical license golden flow: purchase → Sepolia → activation → entitlement → device sync', async ({ page, request }) => {
  test.setTimeout(1_200_000);
  test.skip(!password, 'BLOCKED_EXTERNAL_TEST_IDENTITY');
  try {
    phase = 'purchase';
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'Bản quyền phần mềm được xác lập on-chain' })).toBeVisible();
    await page.goto('/products');
    await page.getByLabel('Tìm sản phẩm').fill('Emukey Desktop');
    await page.getByRole('link', { name: 'Xem gói & chi tiết' }).first().click();
    await expect(page.getByRole('heading', { name: /Emukey Desktop|Sản phẩm/ })).toBeVisible();
    await page.getByRole('button', { name: 'Mua ngay' }).click();
    await page.waitForURL(/\/auth(?:\?|$)/);
    const checkoutPath = new URL(page.url()).searchParams.get('redirect');
    expect(checkoutPath).toMatch(/^\/buyer\/checkout\?/);
    await page.getByLabel('Email').fill(email);
    await page.getByLabel('Mật khẩu').fill(password!);
    await page.getByRole('button', { name: 'Đăng nhập' }).click();
    await page.waitForURL('**/');
    await page.goto(checkoutPath!);
    await expect(page).toHaveURL(/\/buyer\/checkout\?/);
    await expect(page.getByRole('heading', { name: 'Hoàn tất mua bản quyền' })).toBeVisible();
    await page.getByRole('button', { name: 'Tạo đơn hàng' }).click();
    await expect(page.getByRole('heading', { name: 'Điều khoản cấp phép' })).toBeVisible({ timeout: 20_000 });
    const acceptButton = page.getByRole('button', { name: 'Đồng ý và tiếp tục thanh toán' });
    await expect(acceptButton).toBeDisabled();
    await page.getByText('Tôi đã đọc và đồng ý với điều khoản cấp phép').click();
    await acceptButton.click();
    await page.waitForURL('**/buyer/orders/**/payment', { timeout: 30_000 });
    const orderId = (/\/buyer\/orders\/([^/]+)\/payment/.exec(page.url()) ?? [])[1]!;
    evidence.timeline.orderAccepted = new Date().toISOString();
    evidence.purchase.orderId = orderId;

    // ---------- Phase 2: SePay sandbox payment through the real provider UI ----------
    phase = 'payment';
    await page.getByRole('button', { name: 'Tạo yêu cầu thanh toán' }).click();
    const providerForm = page.getByTestId('sepay-checkout-form');
    await expect(providerForm).toBeVisible({ timeout: 30_000 });
    const paymentDatabaseUrl = await readEnvironmentValue('DATABASE_URL');
    expect(paymentDatabaseUrl).toBeTruthy();
    const { Pool: PaymentPool } = requireBackend('pg');
    paymentPool = new PaymentPool({ connectionString: paymentDatabaseUrl }) as ReadOnlyPool;
    const attemptRow = await paymentPool.query(
      `SELECT id, provider_reference
         FROM payment_attempts
        WHERE order_id = $1
        ORDER BY attempt_no DESC
        LIMIT 1`,
      [orderId],
    );
    const paymentAttemptId = typeof attemptRow.rows[0]?.id === 'string' ? attemptRow.rows[0].id : null;
    const paymentReference = typeof attemptRow.rows[0]?.provider_reference === 'string'
      ? attemptRow.rows[0].provider_reference
      : null;
    expect(paymentAttemptId, 'PAYMENT_ATTEMPT_ID_MISSING').toBeTruthy();
    expect(paymentReference, 'PAYMENT_REFERENCE_MISSING').toBeTruthy();
    evidence.purchase.paymentAttemptId = paymentAttemptId;
    evidence.payment = {
      provider: 'SePay Sandbox',
      checkoutReached: false,
      paymentAttemptId,
      paymentReference,
      paymentMatched: false,
    };

    let providerNavigationError: unknown;
    try {
      await Promise.all([
        page.waitForURL(/sepay/i, { timeout: 30_000 }),
        providerForm.locator('button[type="submit"]').click(),
      ]);
      const providerPageText = await page.locator('body').innerText({ timeout: 5_000 }).catch(() => '');
      const providerBlocked = isProviderBlocked(`${page.url()} ${providerPageText}`);
      evidence.payment = {
        ...(evidence.payment as Record<string, unknown>),
        checkoutReached: true,
        ...(providerBlocked ? {
          providerCheckoutBlocked: true,
          providerBlockReason: 'Cloudflare access-block page',
        } : {}),
      };
      if (providerBlocked) providerNavigationError = new Error('SEPAY_PROVIDER_UI_BLOCKED');
    } catch (error) {
      let providerPageText = '';
      try {
        providerPageText = await page.locator('body').innerText({ timeout: 1_000 });
      } catch {
        // The provider document may be unavailable after a blocked navigation.
      }
      const providerDetails = `${page.url()} ${providerPageText} ${error instanceof Error ? error.message : String(error)}`;
      if (!isProviderBlocked(providerDetails)) throw error;
      providerNavigationError = error;
      evidence.payment = {
        ...(evidence.payment as Record<string, unknown>),
        providerCheckoutBlocked: true,
        providerBlockReason: 'Cloudflare access-block page',
      };
    }

    if (providerNavigationError || evidence.payment.providerCheckoutBlocked) {
      evidence.executionMode = 'OPERATOR_ASSISTED_EXTERNAL_PROVIDER';
      // The provider UI was blocked before a payment event could be created, so a
      // poll timeout would be misreported as a missing IPN. Fail as an external
      // provider block instead of waiting for an event that cannot exist.
      throw new Error('SEPAY_PROVIDER_UI_BLOCKED:providerCheckoutBlocked');
    }

    // Keep polling while the operator uses a normal browser. The durable IPN
    // state, not the provider return navigation, is the payment boundary.
    const currentPaymentPool = paymentPool;
    expect(currentPaymentPool, 'PAYMENT_POLL_POOL_MISSING').toBeTruthy();
    const paymentState = await waitForExternalPayment(currentPaymentPool!, page, orderId, paymentAttemptId!);
    evidence.executionMode = evidence.executionMode === 'OPERATOR_ASSISTED_EXTERNAL_PROVIDER'
      ? evidence.executionMode
      : 'REAL_SEPAY_PROVIDER_UI';
    evidence.realIpn = true;
    evidence.payment = {
      ...(evidence.payment as Record<string, unknown>),
      paymentAttemptId,
      paymentReference,
      paymentMatched: true,
      realIpn: true,
      orderStatus: paymentState.orderStatus,
      paymentAttemptStatus: paymentState.attemptStatus,
      paymentTransactionId: paymentState.transactionId,
      paymentClassification: paymentState.classification,
      providerEventId: paymentState.providerEventId,
      providerTransactionReference: paymentState.providerTransactionReference,
      paymentAccepted: true,
    };
    evidence.purchase.orderStatus = paymentState.orderStatus;
    evidence.timeline.paymentAccepted = new Date().toISOString();
    await persistEvidence();
    await paymentPool.end();
    paymentPool = undefined;
    await page.goto(`/buyer/orders/${orderId}/payment`);
    await expect(page).toHaveURL(new RegExp(`/buyer/orders/${orderId}/payment`));

    // ---------- Phase 3: ISSUE_LICENSE confirmed on Sepolia and license ACTIVE ----------
    phase = 'issue';
    await expect(page.getByRole('heading', { name: 'Bản quyền đã sẵn sàng' })).toBeVisible({ timeout: 240_000 });
    const orderResponse = await request.get(`${apiBaseUrl}/orders/${orderId}`);
    expect(orderResponse.ok()).toBeTruthy();
    const order = await orderResponse.json() as { licenseId?: string | null };
    const licenseId = order.licenseId;
    expect(licenseId).toBeTruthy();
    evidence.license.licenseId = licenseId;

    const licenseResponse = await request.get(`${apiBaseUrl}/licenses/${licenseId}`);
    expect(licenseResponse.ok()).toBeTruthy();
    const projection = await licenseResponse.json() as {
      status: string; activationKeyTrustStatus: string; blockNumber?: number | null;
      confirmationCount: number; transactionHash?: string | null; publicLicenseId: string;
    };
    expect(projection.status).toBe('ACTIVE');
    expect(projection.activationKeyTrustStatus).toBe('TRUSTED');
    evidence.license.status = projection.status;
    evidence.license.activationKeyTrustStatus = projection.activationKeyTrustStatus;
    evidence.license.blockNumber = projection.blockNumber ?? null;
    evidence.license.confirmationCount = projection.confirmationCount;
    evidence.license.publicLicenseId = projection.publicLicenseId;
    evidence.issue.issueTxHash = projection.transactionHash ?? null;
    evidence.issue.confirmations = projection.confirmationCount;
    evidence.timeline.licenseActive = new Date().toISOString();

    // ---------- Phase 4: one-time key retrieved through the real UI into memory ----------
    phase = 'key';
    await page.getByRole('button', { name: 'Nhận mã bản quyền' }).click();
    const keyInput = page.getByLabel('Mã bản quyền');
    await expect(keyInput).toBeVisible({ timeout: 20_000 });
    // Raw key lives only in this local variable for the rest of the run.
    const activationKey = await keyInput.inputValue();
    expect(activationKey.length > 0 && /^0x[0-9a-fA-F]{64}$/.test(activationKey)).toBe(true);
    evidence.activation.activationKeyRetrieved = true;
    evidence.timeline.keyRetrieved = new Date().toISOString();

    // ---------- Phase 5: anonymous activation through the public API ----------
    phase = 'activation';
    const device = privateKeyToAccount(generatePrivateKey());
    const deviceRef = `canonical-${runId}`;
    const challengeResponse = await request.post(`${apiBaseUrl}/activations/challenge`, {
      data: { activationKey, deviceRef, purpose: 'ACTIVATE_DEVICE' },
    });
    expect(challengeResponse.ok()).toBeTruthy();
    const challenge = await challengeResponse.json() as { challenge: string };
    const activationResponse = await request.post(`${apiBaseUrl}/activations`, {
      data: {
        activationKey, challenge: challenge.challenge, devicePublicKey: device.address, deviceRef,
        proof: await device.signMessage({ message: challenge.challenge }),
      },
    });
    expect(activationResponse.ok()).toBeTruthy();
    const activated = await activationResponse.json() as { id: string; licenseId: string; status: string };
    expect(activated.status).toBe('ACTIVE');
    expect(activated.licenseId).toBe(licenseId);
    evidence.activation.deviceId = activated.id;
    evidence.activation.deviceStatus = activated.status;
    evidence.activation.purchaserSessionUsed = false;
    evidence.timeline.deviceActivated = new Date().toISOString();

    // ---------- Phase 6: entitlement issue + verify without purchaser session ----------
    phase = 'entitlement';
    const entitlementChallengeResponse = await request.post(`${apiBaseUrl}/activations/challenge`, {
      data: { deviceId: activated.id, licenseId, deviceRef, purpose: 'ISSUE_ENTITLEMENT' },
    });
    expect(entitlementChallengeResponse.ok()).toBeTruthy();
    const entitlementChallenge = await entitlementChallengeResponse.json() as { challenge: string };
    const entitlementResponse = await request.post(`${apiBaseUrl}/entitlements/issue`, {
      data: {
        challenge: entitlementChallenge.challenge, deviceId: activated.id, licenseId,
        proof: await device.signMessage({ message: entitlementChallenge.challenge }),
      },
    });
    expect(entitlementResponse.ok()).toBeTruthy();
    const entitlement = await entitlementResponse.json() as { token: string; entitlementVersion: number };
    const verifyResponse = await request.post(`${apiBaseUrl}/entitlements/verify`, { data: { token: entitlement.token } });
    expect(verifyResponse.ok()).toBeTruthy();
    const verified = await verifyResponse.json() as { valid: boolean; deviceId: string };
    expect(verified.valid).toBe(true);
    expect(verified.deviceId).toBe(activated.id);
    evidence.entitlement.issued = true;
    evidence.entitlement.verified = true;
    evidence.entitlement.entitlementVersion = entitlement.entitlementVersion;
    evidence.entitlement.purchaserSessionUsed = false;

    // ---------- Phase 7: device state in PostgreSQL and SYNC_DEVICE_COUNT on Sepolia ----------
    phase = 'device-sync';
    const databaseUrl = await readEnvironmentValue('DATABASE_URL');
    expect(databaseUrl).toBeTruthy();
    const { Pool } = requireBackend('pg');
    const pool = new Pool({ connectionString: databaseUrl });
    try {
      const deviceRow = await pool.query(
        'SELECT status, device_public_key FROM license_devices WHERE id=$1', [activated.id],
      );
      expect(deviceRow.rows[0]?.status).toBe('ACTIVE');
      expect(deviceRow.rows[0]?.device_public_key).toBe(device.address.toLowerCase());
      evidence.activation.databaseDeviceStatus = deviceRow.rows[0].status;

      const syncDeadline = Date.now() + 240_000;
      let sync: { id: string; status: string; transaction_hash: string | null } | undefined;
      while (Date.now() < syncDeadline) {
        const syncRow = await pool.query(
          "SELECT id, status, transaction_hash FROM chain_commands WHERE license_id=$1 AND command_type='SYNC_DEVICE_COUNT' ORDER BY created_at DESC LIMIT 1",
          [licenseId],
        );
        sync = syncRow.rows[0];
        if (sync?.status === 'CONFIRMED') break;
        await page.waitForTimeout(5_000);
      }
      expect(sync, 'SYNC_COMMAND_MISSING').toBeTruthy();
      expect(sync!.status).toBe('CONFIRMED');
      evidence.deviceSync.syncCommandId = sync!.id;
      evidence.deviceSync.syncTxHash = sync!.transaction_hash;

      const eventRow = await pool.query(
        'SELECT event_type, block_number, confirmation_count, finality_status, transaction_hash FROM chain_events WHERE chain_command_id=$1 AND finality_status=$2 LIMIT 1',
        [sync!.id, 'CONFIRMED'],
      );
      const event = eventRow.rows[0];
      expect(event, 'SYNC_EVENT_NOT_INDEXED').toBeTruthy();
      expect(event.transaction_hash).toBe(sync!.transaction_hash);
      evidence.deviceSync.syncBlock = event.block_number;
      evidence.deviceSync.syncEventType = event.event_type;
      evidence.deviceSync.syncConfirmations = event.confirmation_count;
      evidence.deviceSync.indexed = true;

      const aggregate = await pool.query(
        'SELECT active_device_count, device_state_version FROM licenses WHERE id=$1', [licenseId],
      );
      expect(aggregate.rows[0].active_device_count).toBe(1);
      evidence.deviceSync.activeDeviceCount = aggregate.rows[0].active_device_count;
      evidence.deviceSync.deviceStateVersion = Number(aggregate.rows[0].device_state_version);

      const issueRow = await pool.query(
        "SELECT id, status, transaction_hash FROM chain_commands WHERE license_id=$1 AND command_type='ISSUE_LICENSE' ORDER BY created_at LIMIT 1",
        [licenseId],
      );
      expect(issueRow.rows[0], 'ISSUE_COMMAND_MISSING').toBeTruthy();
      evidence.issue.issueCommandId = issueRow.rows[0].id;
      evidence.issue.issueCommandStatus = issueRow.rows[0].status;
      evidence.issue.issueTxHash = issueRow.rows[0].transaction_hash;
      const issueEvent = await pool.query(
        "SELECT event_type, block_number, confirmation_count, finality_status, transaction_hash FROM chain_events WHERE chain_command_id=$1 AND finality_status='CONFIRMED' LIMIT 1",
        [issueRow.rows[0].id],
      );
      expect(issueEvent.rows[0], 'ISSUE_EVENT_NOT_INDEXED').toBeTruthy();
      evidence.issue.issueBlock = issueEvent.rows[0].block_number;
      evidence.issue.issueConfirmations = issueEvent.rows[0].confirmation_count;
      evidence.issue.issueEventIndexed = true;
      evidence.timeline.deviceSyncConfirmed = new Date().toISOString();
    } finally {
      await pool.end();
    }

    // ---------- Phase 8: ownership isolation and OptionalAuthGuard behavior ----------
    if (otherEmail && otherPassword) {
      phase = 'ownership';
      const otherLogin = await request.post(`${apiBaseUrl}/auth/login`, {
        data: { email: otherEmail, password: otherPassword },
      });
      expect(otherLogin.ok()).toBeTruthy();
      const otherSession = await otherLogin.json() as { accessToken: string };
      const otherHeaders = { authorization: `Bearer ${otherSession.accessToken}` };
      const forbidden = await request.get(`${apiBaseUrl}/licenses/${licenseId}`, { headers: otherHeaders });
      const forbiddenRetrieve = await request.post(`${apiBaseUrl}/licenses/${licenseId}/activation-key/retrieve`, { headers: otherHeaders });
      expect([403, 404]).toContain(forbidden.status());
      expect([403, 404]).toContain(forbiddenRetrieve.status());
      evidence.license.ownershipIsolated = true;
      evidence.license.otherCustomerLicenseStatus = forbidden.status();
      evidence.license.otherCustomerRetrieveStatus = forbiddenRetrieve.status();

      const otherDevice = privateKeyToAccount(generatePrivateKey());
      const otherDeviceRef = `canonical-other-${runId}`;
      const otherChallenge = await request.post(`${apiBaseUrl}/activations/challenge`, {
        data: { activationKey, deviceRef: otherDeviceRef, purpose: 'ACTIVATE_DEVICE' },
        headers: otherHeaders,
      });
      expect(otherChallenge.ok()).toBeTruthy();
      const otherChallengeBody = await otherChallenge.json() as { challenge: string };
      const otherActivation = await request.post(`${apiBaseUrl}/activations`, {
        data: {
          activationKey, challenge: otherChallengeBody.challenge, devicePublicKey: otherDevice.address,
          deviceRef: otherDeviceRef, proof: await otherDevice.signMessage({ message: otherChallengeBody.challenge }),
        },
        headers: otherHeaders,
      });
      expect(otherActivation.status()).toBe(201);
      evidence.activation.otherCustomerActivated = true;
    } else {
      evidence.license.ownershipIsolation = 'NOT_RUN_NO_OTHER_CUSTOMER_CREDENTIALS';
    }

    // ---------- Phase 9: final customer management UI ----------
    phase = 'final-ui';
    await page.goto(`/buyer/licenses?licenseId=${encodeURIComponent(licenseId)}`);
    await expect(page.getByText(projection.publicLicenseId)).toBeVisible({ timeout: 30_000 });
    await page.getByRole('button', { name: 'Thiết bị' }).click();
    await expect(page.getByText(/Hoạt động/)).toBeVisible({ timeout: 30_000 });
    evidence.timeline.completed = new Date().toISOString();
    evidence.status = 'PASS';
    await persistEvidence();
    console.log(JSON.stringify({
      runId, status: 'PASS', orderId, licenseId,
      issueCommandId: evidence.issue.issueCommandId, issueTxHash: evidence.issue.issueTxHash,
      syncCommandId: evidence.deviceSync.syncCommandId, syncTxHash: evidence.deviceSync.syncTxHash,
    }, null, 2));
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const paymentIpnRejected = errorMessage.startsWith('PAYMENT_IPN_REJECTED:');
    const paymentIpnNotReceived = errorMessage.startsWith('PAYMENT_IPN_NOT_RECEIVED:');
    let providerPageText = '';
    if (phase === 'payment' && !paymentIpnRejected && !paymentIpnNotReceived) {
      try {
        providerPageText = await page.locator('body').innerText({ timeout: 1_000 });
      } catch {
        // The provider document may be unavailable while Playwright is unwinding a navigation timeout.
      }
    }
    const providerBlock = phase === 'payment'
      && !paymentIpnRejected
      && !paymentIpnNotReceived
      && (
        Boolean((evidence.payment as Record<string, unknown> | undefined)?.providerCheckoutBlocked)
        || isProviderBlocked(`${page.url()} ${providerPageText} ${errorMessage}`)
      );
    evidence.status = providerBlock ? 'BLOCKED' : 'FAIL';
    evidence.failedPhase = providerBlock ? 'payment-provider' : phase;
    evidence.failureCode = providerBlock
      ? 'SEPAY_PROVIDER_UI_BLOCKED'
      : paymentIpnRejected
        ? 'PAYMENT_IPN_REJECTED'
        : paymentIpnNotReceived
          ? 'PAYMENT_IPN_NOT_RECEIVED'
          : ({
            purchase: 'PURCHASE_FAILED', payment: 'PAYMENT_CALLBACK_FAILED', issue: 'ISSUE_EVENT_NOT_INDEXED',
            key: 'KEY_RETRIEVAL_FAILED', activation: 'ACTIVATION_FAILED', entitlement: 'ENTITLEMENT_FAILED',
            'device-sync': 'SYNC_COMMAND_MISSING', ownership: 'ACTIVATION_FAILED', 'final-ui': 'FINAL_UI_MISMATCH',
          } as Record<string, FailureCode>)[phase] ?? 'PURCHASE_FAILED';
    if (providerBlock) {
      evidence.payment = {
        ...(evidence.payment as Record<string, unknown> | undefined),
        providerCheckoutBlocked: true,
        providerBlockReason: 'Cloudflare access-block page',
        ipnReachedBackend: false,
        paymentTransactionPersisted: false,
        paymentAccepted: false,
      };
    }
    if (paymentIpnRejected) {
      evidence.payment = {
        ...(evidence.payment as Record<string, unknown> | undefined),
        paymentAccepted: false,
        paymentRejectedReason: errorMessage.slice('PAYMENT_IPN_REJECTED:'.length),
      };
    }
    if (paymentIpnNotReceived) {
      evidence.payment = {
        ...(evidence.payment as Record<string, unknown> | undefined),
        paymentAccepted: false,
        paymentIpnNotReceived: true,
        paymentIpnWaitResult: errorMessage,
      };
    }
    if (paymentPool) {
      await paymentPool.end();
      paymentPool = undefined;
    }
    await persistEvidence();
    throw error;
  }
});