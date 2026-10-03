/* global AbortSignal, Buffer, URL, URLSearchParams, fetch */

import { randomUUID } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createPublicClient, createWalletClient, defineChain, getAddress, keccak256, parseEventLogs, stringToHex } from 'viem';

import { BrevoEmailDelivery } from '../dist/modules/operations/infrastructure/brevo-email-delivery.js';
import { FcmPushDelivery } from '../dist/modules/operations/infrastructure/fcm-push-delivery.js';
import { GeminiAiGateway } from '../dist/modules/assistance-support/infrastructure/gemini-ai.gateway.js';
import { SePayPaymentGateway } from '../dist/modules/commerce-payment/infrastructure/sepay-payment.gateway.js';
import { CloudinaryPrivateStorage } from '../dist/platform/storage/cloudinary-private-storage.js';
import { createViemRpcTransport } from '../dist/platform/blockchain/viem-rpc-transport.js';

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
  if (process.env.EVM_CHAIN_ID !== '11155111' || process.env.EVM_NETWORK !== 'sepolia') return setResult('Sepolia', 'BLOCKED_EXTERNAL', {}, 'SEPOLIA_NETWORK_REQUIRED');
  if (!['EVM_RPC_HTTP_URL', 'EVM_CONTRACT_ADDRESS', 'EVM_RELAYER_PRIVATE_KEY'].every(present)) return setResult('Sepolia', 'BLOCKED_EXTERNAL', {}, 'SEPOLIA_CONFIG_MISSING');
  try {
    const chain = defineChain({ id: 11155111, name: 'sepolia', nativeCurrency: { name: 'Sepolia Ether', symbol: 'ETH', decimals: 18 }, rpcUrls: { default: { http: [process.env.EVM_RPC_HTTP_URL] } }, testnet: true });
     const client = createPublicClient({ chain, transport: createViemRpcTransport(process.env.EVM_RPC_HTTP_URL, process.env.EVM_RPC_FALLBACK_HTTP_URL) });
    const address = getAddress(process.env.EVM_CONTRACT_ADDRESS);
    const { privateKeyToAccount } = await import('viem/accounts');
    const relayer = privateKeyToAccount(process.env.EVM_RELAYER_PRIVATE_KEY);
    const [chainId, code, balance] = await Promise.all([client.getChainId(), client.getCode({ address }), client.getBalance({ address: relayer.address })]);
     if (chainId !== 11155111 || !code || code === '0x') throw new Error('SEPOLIA_READINESS_FAILED');
     const deploymentBlock = Number(process.env.EVM_DEPLOYMENT_BLOCK ?? 0);
     if (!deploymentBlock) throw new Error('SEPOLIA_DEPLOYMENT_BLOCK_REQUIRED');
     const deploymentReceipt = await client.getTransactionReceipt({ hash: process.env.SEPOLIA_DEPLOYMENT_TX ?? '0x26b27aa01bc194fe4b9505009b74e09d16794b92da870fd564d9f3ddc77db77e' });
     if (Number(deploymentReceipt.blockNumber) !== deploymentBlock || deploymentReceipt.contractAddress?.toLowerCase() !== address.toLowerCase()) throw new Error('SEPOLIA_DEPLOYMENT_RECEIPT_MISMATCH');
    const abi = [
      { type: 'function', name: 'computePlanCommitment', stateMutability: 'view', inputs: [{ name: 'provider', type: 'address' }, { name: 'productId', type: 'bytes16' }, { name: 'planId', type: 'bytes16' }, { name: 'planVersion', type: 'uint256' }, { name: 'durationMonths', type: 'uint256' }, { name: 'maxActiveDevices', type: 'uint256' }, { name: 'entitlementsHash', type: 'bytes32' }], outputs: [{ type: 'bytes32' }] },
      { type: 'function', name: 'issueLicense', stateMutability: 'nonpayable', inputs: [{ name: 'commandId', type: 'bytes16' }, { name: 'licenseId', type: 'bytes16' }, { name: 'provider', type: 'address' }, { name: 'productId', type: 'bytes16' }, { name: 'planId', type: 'bytes16' }, { name: 'planVersion', type: 'uint256' }, { name: 'planCommitment', type: 'bytes32' }, { name: 'activationCommitment', type: 'bytes32' }, { name: 'activationKeyVersion', type: 'uint256' }, { name: 'maxActiveDevices', type: 'uint256' }, { name: 'expiresAt', type: 'uint256' }], outputs: [] },
      { type: 'event', name: 'LicenseIssued', inputs: [{ indexed: true, name: 'commandId', type: 'bytes16' }, { indexed: true, name: 'licenseId', type: 'bytes16' }, { indexed: true, name: 'provider', type: 'address' }, { indexed: false, name: 'planCommitment', type: 'bytes32' }, { indexed: false, name: 'activationCommitment', type: 'bytes32' }, { indexed: false, name: 'activationKeyVersion', type: 'uint256' }, { indexed: false, name: 'expiresAt', type: 'uint256' }] },
    ];
    const productId = keccak256(stringToHex(`${runId}:product`)).slice(0, 34);
    const planId = keccak256(stringToHex(`${runId}:plan`)).slice(0, 34);
    const commandId = keccak256(stringToHex(`${runId}:command`)).slice(0, 34);
    const licenseId = keccak256(stringToHex(`${runId}:license`)).slice(0, 34);
    const entitlementsHash = keccak256(stringToHex(JSON.stringify({ e2e: runId, desktop: true })));
    const planCommitment = await client.readContract({ address, abi, functionName: 'computePlanCommitment', args: [relayer.address, productId, planId, 1n, 1n, 1n, entitlementsHash] });
    const activationCommitment = keccak256(stringToHex(`${runId}:activation`));
    const latestBlock = await client.getBlock();
    const expiresAt = latestBlock.timestamp + 30n * 24n * 60n * 60n;
     const wallet = createWalletClient({ account: relayer, chain, transport: createViemRpcTransport(process.env.EVM_RPC_HTTP_URL, process.env.EVM_RPC_FALLBACK_HTTP_URL) });
    const args = [commandId, licenseId, relayer.address, productId, planId, 1n, planCommitment, activationCommitment, 1n, 1n, expiresAt];
    const simulation = await client.simulateContract({ address, abi, functionName: 'issueLicense', account: relayer, args });
    const gas = await client.estimateContractGas({ address, abi, functionName: 'issueLicense', account: relayer, args });
    const txHash = await wallet.writeContract({ ...simulation.request, gas });
    const receipt = await client.waitForTransactionReceipt({ hash: txHash, confirmations: 1 });
    const events = parseEventLogs({ abi, eventName: 'LicenseIssued', logs: receipt.logs });
     setResult('Sepolia', 'REAL_EXTERNAL_VERIFIED', { chainId, contractAddress: address, deploymentBlock, deploymentTransactionHash: deploymentReceipt.transactionHash, bytecodeLength: code.length, planCommitmentV2: planCommitment, relayerAddress: relayer.address, relayerBalanceWeiBefore: balance.toString(), transactionHash: txHash, blockNumber: receipt.blockNumber.toString(), receiptStatus: receipt.status, gasUsed: receipt.gasUsed.toString(), eventName: events[0]?.eventName ?? null, licenseId });
  } catch (error) {
    setResult('Sepolia', 'FAIL', { error: safeError(error) });
  }
}

await verifyGemini();
await verifyCloudinary();
await verifyBrevo();
await verifyFcm();
await verifySePay();
await verifySepolia();
const reportPath = resolve(process.cwd(), '..', 'docs', 'traceability', 'external-provider-evidence.json');
const releaseEvidenceDirectory = resolve(process.cwd(), '..', 'docs', 'traceability', 'releases', runId);
await mkdir(releaseEvidenceDirectory, { recursive: true });
await writeFile(reportPath, `${JSON.stringify(results, null, 2)}\n`, 'utf8');
await writeFile(resolve(releaseEvidenceDirectory, 'external-provider-evidence.json'), `${JSON.stringify(results, null, 2)}\n`, 'utf8');
console.log(`Evidence written: ${reportPath}`);
console.log(`Run evidence written: docs/traceability/releases/${runId}/external-provider-evidence.json`);
if (Object.values(results.providers).some((result) => result.status === 'FAIL')) process.exitCode = 1;
