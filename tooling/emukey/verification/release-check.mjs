import { access, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '../../../EmuKey');
const requiredFiles = [
  'backend/database/schema.sql',
  'backend/src/modules/blockchain/infrastructure/generated/license-registry.abi.json',
  'backend/src/modules/blockchain/infrastructure/license-registry-contract.ts',
  'backend/contracts/deployments/sepolia-v3.json',
  'frontend/openapi/openapi.json',
  'mobile/openapi/openapi.json',
  '../docs/emukey/traceability/phase-8-traceability.md',
  '../docs/emukey/runbooks/phase-8-release.md',
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

const environment = await readFile(resolve(root, 'backend/.env'), 'utf8').catch(() => '');
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
if (!structuralOnly && (chainId !== '11155111' || network !== 'sepolia')) {
  failures.push('Blockchain runtime must use Sepolia (EVM_NETWORK=sepolia, EVM_CHAIN_ID=11155111)');
}

const contractAddress = value('EVM_CONTRACT_ADDRESS');
try {
  const deployment = JSON.parse(await readFile(resolve(root, 'backend/contracts/deployments/sepolia-v3.json'), 'utf8'));
  if (deployment.chainId !== 11155111 || deployment.network !== 'sepolia' || deployment.deploymentVersion !== 3) {
    failures.push('Sepolia v3 metadata is invalid');
  }
  if (!structuralOnly && (contractAddress?.toLowerCase() !== deployment.contractAddress.toLowerCase() ||
      Number(value('EVM_DEPLOYMENT_BLOCK')) !== deployment.deploymentBlock)) {
    failures.push('Runtime contract address/block must match Sepolia v3 metadata');
  }
} catch {
  failures.push('Sepolia v3 deployment metadata is missing or unreadable');
}
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
