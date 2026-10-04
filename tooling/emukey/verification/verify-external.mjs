/* global AbortSignal, Buffer, URL, URLSearchParams, fetch */

import { randomUUID } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

import { BrevoEmailDelivery } from '../../../EmuKey/backend/dist/modules/operations/infrastructure/brevo-email-delivery.js';
import { FcmPushDelivery } from '../../../EmuKey/backend/dist/modules/operations/infrastructure/fcm-push-delivery.js';
import { GeminiAiGateway } from '../../../EmuKey/backend/dist/modules/assistance-support/infrastructure/gemini-ai.gateway.js';
import { SePayPaymentGateway } from '../../../EmuKey/backend/dist/modules/commerce-payment/infrastructure/sepay-payment.gateway.js';
import { CloudinaryPrivateStorage } from '../../../EmuKey/backend/dist/platform/storage/cloudinary-private-storage.js';

const runId = `emukey-ext-${new Date().toISOString().replace(/[-:.TZ]/g, '').slice(0, 14)}-${randomUUID().slice(0, 8)}`;
const results = { runId, generatedAt: new Date().toISOString(), providers: {} };
const requestedProvider = process.argv.find((value) => value.startsWith('--provider='))?.slice('--provider='.length)?.toUpperCase();
const enabled = (name) => process.env[`RUN_${name}_EXTERNAL`] === 'true' || requestedProvider === name;
const present = (name) => Boolean(process.env[name]?.trim());
const setResult = (provider, status, evidence = {}, blocker = null) => {
  results.providers[provider] = { status, evidence, ...(blocker ? { blocker } : {}) };
  console.log(`${provider}: ${status}${blocker ? ` (${blocker})` : ''}`);
};
const safeError = (error) => {
  const message = error instanceof Error ? error.message : 'UNKNOWN_EXTERNAL_ERROR';
  return message
    .replaceAll(/https?:\/\/[^\s]+/g, '[REDACTED_RPC_URL]')
    .replaceAll(/\b(?:sk|rk)_[A-Za-z0-9_-]+\b/g, '[REDACTED_PROVIDER_KEY]')
    .replaceAll(/\b\d{8,}\b/g, '[REDACTED_NUMBER]');
};

async function verifyGemini() {
  if (!enabled('GEMINI')) return setResult('Gemini', 'SKIPPED_BY_OPT_IN');
  if (!present('GEMINI_API_KEY') || !present('GEMINI_MODEL')) return setResult('Gemini', 'BLOCKED_EXTERNAL', {}, 'GEMINI_API_KEY_OR_MODEL_MISSING');
  const started = Date.now();
  try {
    const gateway = new GeminiAiGateway({ apiKey: process.env.GEMINI_API_KEY, model: process.env.GEMINI_MODEL, timeoutMs: Number(process.env.GEMINI_TIMEOUT_MS ?? 15000), maxOutputTokens: Number(process.env.GEMINI_MAX_OUTPUT_TOKENS ?? 1024) });
    const answer = await gateway.answerGrounded({ question: 'What is the EmuKey E2E code word?', sources: [{ id: 'e2e-source', content: 'The EmuKey E2E code word is BLUE-ORCHID-731.' }] });
    if (!answer.answer.includes('BLUE-ORCHID-731') || !answer.grounded || !answer.citedSourceIds.includes('e2e-source')) throw new Error('GEMINI_GROUNDING_ASSERTION_FAILED');
    setResult('Gemini', 'REAL_EXTERNAL_VERIFIED', { model: process.env.GEMINI_MODEL, latencyMs: Date.now() - started, grounded: answer.grounded, citedSourceIds: answer.citedSourceIds });
  } catch (error) {
    setResult('Gemini', 'FAIL', { latencyMs: Date.now() - started, error: safeError(error) });
  }
}

async function verifyCloudinary() {
  if (!enabled('CLOUDINARY')) return setResult('Cloudinary', 'SKIPPED_BY_OPT_IN');
  const names = ['CLOUDINARY_CLOUD_NAME', 'CLOUDINARY_API_KEY', 'CLOUDINARY_API_SECRET', 'CLOUDINARY_FOLDER'];
  if (names.some((name) => !present(name))) return setResult('Cloudinary', 'BLOCKED_EXTERNAL', {}, 'CLOUDINARY_CREDENTIAL_MISSING');
  const key = `e2e/${runId}/probe-txt`;
  const storage = new CloudinaryPrivateStorage({ cloudName: process.env.CLOUDINARY_CLOUD_NAME, apiKey: process.env.CLOUDINARY_API_KEY, apiSecret: process.env.CLOUDINARY_API_SECRET, folder: process.env.CLOUDINARY_FOLDER });
  try {
    for (const staleKey of (process.env.CLOUDINARY_CLEANUP_KEYS ?? '').split(',').map((value) => value.trim()).filter(Boolean)) await storage.delete(staleKey);
    const body = Buffer.from(`EmuKey external verification ${runId}\n`, 'utf8');
    await storage.put(key, body);
    const downloaded = await storage.get(key);
    if (!downloaded?.equals(body)) throw new Error(`CLOUDINARY_RETRIEVAL_MISMATCH:${downloaded?.length ?? 0}:${body.length}`);
    await storage.delete(key);
    setResult('Cloudinary', 'REAL_EXTERNAL_VERIFIED', { key, uploaded: true, retrieved: true, cleanedUp: true });
  } catch (error) {
    setResult('Cloudinary', 'FAIL', { key, error: safeError(error) });
  }
}

async function verifyBrevo() {
  if (!enabled('BREVO')) return setResult('Brevo', 'SKIPPED_BY_OPT_IN');
  if (!present('BREVO_API_KEY') || !present('BREVO_SENDER_EMAIL') || !present('BREVO_SENDER_NAME')) return setResult('Brevo', 'BLOCKED_EXTERNAL', {}, 'BREVO_CREDENTIAL_MISSING');
  if (!present('E2E_TEST_EMAIL_RECIPIENT')) return setResult('Brevo', 'BLOCKED_EXTERNAL', {}, 'BLOCKED_EXTERNAL_SAFE_RECIPIENT');
  try {
    const { BrevoClient } = await import('@getbrevo/brevo');
    const client = new BrevoClient({ apiKey: process.env.BREVO_API_KEY, maxRetries: 1, timeoutInSeconds: 30 });
    const delivery = new BrevoEmailDelivery({ publicWebUrl: process.env.WEB_APP_URL ?? 'http://localhost:5173', sender: { email: process.env.BREVO_SENDER_EMAIL, name: process.env.BREVO_SENDER_NAME } }, client);
    const receipt = await delivery.deliver({ data: { token: runId, testRunId: runId }, eventKey: `external:${runId}`, template: 'identity-email-verification-v1', to: process.env.E2E_TEST_EMAIL_RECIPIENT });
    setResult('Brevo', 'PROVIDER_ACCEPTED_VERIFIED', { providerMessageId: receipt.providerMessageId, recipient: 'E2E_TEST_EMAIL_RECIPIENT', inboxReceiptVerified: false });
  } catch (error) {
    setResult('Brevo', 'FAIL', { error: safeError(error) });
  }
}

async function verifyFcm() {
  if (!enabled('FCM')) return setResult('FCM', 'SKIPPED_BY_OPT_IN');
  if (!['FCM_PROJECT_ID', 'FCM_CLIENT_EMAIL', 'FCM_PRIVATE_KEY'].every(present)) return setResult('FCM', 'BLOCKED_EXTERNAL', {}, 'FCM_CREDENTIAL_MISSING');
  try {
    const delivery = new FcmPushDelivery({ projectId: process.env.FCM_PROJECT_ID, clientEmail: process.env.FCM_CLIENT_EMAIL, privateKey: process.env.FCM_PRIVATE_KEY.replaceAll('\\n', '\n'), timeoutMs: Number(process.env.FCM_TIMEOUT_MS ?? 10000) });
    if (!present('E2E_TEST_FCM_TOKEN')) {
      await delivery.verifyProvider();
      return setResult('FCM', 'PROVIDER_ACCEPTED_VERIFIED', { providerAuthentication: true, deviceReceiptVerified: false }, 'BLOCKED_EXTERNAL_DEVICE_TOKEN');
    }
    const receipt = await delivery.deliver({ body: `EmuKey external verification ${runId}`, data: { runId }, eventKey: `external:${runId}`, title: 'EmuKey external verification', token: process.env.E2E_TEST_FCM_TOKEN });
    setResult('FCM', 'REAL_EXTERNAL_VERIFIED', { providerMessageId: receipt.providerMessageId, deviceReceiptVerified: false });
  } catch (error) {
    setResult('FCM', 'FAIL', { error: safeError(error) });
  }
}

async function verifySePay() {
  if (!enabled('SEPAY')) return setResult('SePay', 'SKIPPED_BY_OPT_IN');
  if (!['SEPAY_ENV', 'SEPAY_MERCHANT_ID', 'SEPAY_SECRET_KEY'].every(present)) return setResult('SePay', 'BLOCKED_EXTERNAL', {}, 'SEPAY_SANDBOX_CREDENTIAL_MISSING');
  if (process.env.SEPAY_ENV !== 'sandbox') return setResult('SePay', 'BLOCKED_EXTERNAL', {}, 'SEPAY_SANDBOX_REQUIRED');
  try {
    const gateway = new SePayPaymentGateway({ environment: 'sandbox', merchantId: process.env.SEPAY_MERCHANT_ID, secretKey: process.env.SEPAY_SECRET_KEY, webAppUrl: process.env.WEB_APP_URL ?? 'http://localhost:5173' });
    const checkout = await gateway.createCheckout({ amountVnd: 1000, checkoutReference: `E2E-${runId}`, orderId: runId });
    const providerResponse = await fetch(checkout.checkoutUrl, { method: checkout.checkoutMethod, body: new URLSearchParams(checkout.checkoutFields), headers: { 'content-type': 'application/x-www-form-urlencoded' }, redirect: 'manual', signal: AbortSignal.timeout(15_000) });
    setResult('SePay', 'BLOCKED_EXTERNAL', { checkoutGenerated: true, checkoutUrlHost: new URL(checkout.checkoutUrl).host, providerHttpStatus: providerResponse.status, sandbox: true, requiredCallbackPath: '/api/v1/payments/ipn' }, 'BLOCKED_EXTERNAL_PUBLIC_CALLBACK:configure public HTTPS tunnel or staging URL for /api/v1/payments/ipn');
  } catch (error) {
    setResult('SePay', 'FAIL', { error: safeError(error) });
  }
}

async function verifySepolia() {
  if (!enabled('SEPOLIA')) return setResult('Sepolia', 'SKIPPED_BY_OPT_IN');
  const required = ['EVM_RPC_HTTP_URL', 'EVM_RELAYER_PRIVATE_KEY', 'EVM_CONTRACT_ADDRESS', 'EVM_DEPLOYMENT_BLOCK'];
  if (!required.every(present)) return setResult('Sepolia', 'BLOCKED_EXTERNAL', {}, 'SEPOLIA_CONFIGURATION_MISSING');
  const result = spawnSync(process.execPath, [resolve(import.meta.dirname, 'verify-sepolia.mjs')], {
    env: process.env, cwd: process.cwd(), encoding: 'utf8', windowsHide: true,
  });
  const evidence = JSON.parse(await readFile(resolve(import.meta.dirname, '../../../docs/emukey/traceability/sepolia-lifecycle-evidence.json'), 'utf8'));
  setResult('Sepolia', result.status === 0 ? evidence.status : 'BLOCKED_EXTERNAL', evidence, evidence.blocker);
}

await verifyGemini();
await verifyCloudinary();
await verifyBrevo();
await verifyFcm();
await verifySePay();
await verifySepolia();
const reportPath = resolve(import.meta.dirname, '../../../docs/emukey/traceability', 'external-provider-evidence.json');
const releaseEvidenceDirectory = resolve(import.meta.dirname, '../../../docs/emukey/traceability', 'releases', runId);
await mkdir(releaseEvidenceDirectory, { recursive: true });
await writeFile(reportPath, `${JSON.stringify(results, null, 2)}\n`, 'utf8');
await writeFile(resolve(releaseEvidenceDirectory, 'external-provider-evidence.json'), `${JSON.stringify(results, null, 2)}\n`, 'utf8');
console.log(`Evidence written: ${reportPath}`);
console.log(`Run evidence written: docs/emukey/traceability/releases/${runId}/external-provider-evidence.json`);
if (Object.values(results.providers).some((result) => ['FAIL', 'BLOCKED_EXTERNAL'].includes(result.status))) process.exitCode = 1;
