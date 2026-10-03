import { access, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const root = resolve(process.cwd(), '..');
const requiredFiles = [
  'backend/database/schema.sql',
  'backend/src/modules/blockchain/infrastructure/generated/license-registry.abi.json',
  'backend/src/modules/blockchain/infrastructure/license-registry-contract.ts',
  'backend/contracts/deployments/sepolia-v2.json',
  'frontend/openapi/openapi.json',
  'mobile/openapi/openapi.json',
  'docs/traceability/phase-8-traceability.md',
  'docs/runbooks/phase-8-release.md',
];
const requiredEnvKeys = [
  'NODE_ENV',
  'DATABASE_URL',
  'REDIS_URL',
  'CORS_ORIGINS',
  'PAYMENT_ADAPTER',
  'AI_ADAPTER',
  'EMAIL_ADAPTER',
  'PUSH_ADAPTER',
  'EVM_ADAPTER',
  'EVM_NETWORK',
  'EVM_CHAIN_ID',
  'EVM_CONTRACT_ADDRESS',
  'EVM_RPC_HTTP_URL',
  'EVM_DEPLOYMENT_BLOCK',
  'EVM_INDEXER_BATCH_SIZE',
  'EVM_RELAYER_PRIVATE_KEY',
  'STORAGE_ADAPTER',
  'ACTIVATION_ENVELOPE_ADAPTER',
  'ACTIVATION_ENVELOPE_KEY',
  'JWT_SECRET',
];

const failures = [];
const structuralOnly = process.env.RELEASE_CHECK_STRUCTURAL_ONLY === 'true';
for (const relativePath of requiredFiles) {
  try {
    await access(resolve(root, relativePath));
  } catch {
    failures.push(`missing file: ${relativePath}`);
  }
}

const environment = await readFile(resolve(process.cwd(), '.env'), 'utf8').catch(() => '');
const defined = new Set(
  environment
    .split(/\r?\n/)
    .map((line) => line.match(/^\s*([A-Z][A-Z0-9_]*)\s*=/)?.[1])
    .filter(Boolean),
);
if (!structuralOnly) {
  for (const key of requiredEnvKeys) {
    if (!defined.has(key) && !process.env[key]) failures.push(`missing config presence: ${key}`);
  }
}

const value = (key) => process.env[key] ?? environment.match(new RegExp(`^${key}=(.*)$`, 'm'))?.[1]?.trim();
const chainId = value('EVM_CHAIN_ID');
const network = value('EVM_NETWORK');
if (chainId === '11155111' && network !== 'sepolia') {
  failures.push('EVM_NETWORK must be sepolia when EVM_CHAIN_ID is 11155111');
}
if (chainId === '31337' && network !== 'hardhat') {
  failures.push('EVM_NETWORK must be hardhat when EVM_CHAIN_ID is 31337');
}

const contractAddress = value('EVM_CONTRACT_ADDRESS');
if (contractAddress && !/^0x[0-9a-fA-F]{40}$/.test(contractAddress)) {
  failures.push('EVM_CONTRACT_ADDRESS is not a 20-byte hex address');
}

const nodeEnv = value('NODE_ENV');
if (nodeEnv === 'production') {
  const forbidden = ['fake', 'local', 'hardhat'];
  const values = [
    value('PAYMENT_ADAPTER'),
    value('AI_ADAPTER'),
    value('EMAIL_ADAPTER'),
    value('PUSH_ADAPTER'),
    value('STORAGE_ADAPTER'),
    value('EVM_NETWORK'),
  ];
  if (values.some((value) => value && forbidden.includes(value))) {
    failures.push('production configuration contains a local/fake/hardhat runtime');
  }
  if ((value('CORS_ORIGINS') ?? '').includes('*')) {
    failures.push('production CORS_ORIGINS cannot contain wildcard');
  }
}

if (failures.length > 0) {
  console.error(JSON.stringify({ status: 'FAIL', failures }, null, 2));
  process.exitCode = 1;
} else {
  console.log(JSON.stringify({ status: 'PASS', checkedFiles: requiredFiles.length, checkedConfigKeys: requiredEnvKeys.length }, null, 2));
}
