import { spawnSync } from 'node:child_process';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const check = process.argv.includes('--check');
const temporaryDirectory = check
  ? await mkdtemp(join(tmpdir(), 'emukey-backend-openapi-'))
  : undefined;
const specification = temporaryDirectory
  ? join(temporaryDirectory, 'openapi.json')
  : join(root, 'openapi', 'openapi.json');

const environment = {
  ...process.env,
  AI_ADAPTER: 'fake',
  GEMINI_TIMEOUT_MS: '15000',
  GEMINI_MAX_OUTPUT_TOKENS: '1024',
  CORS_ORIGINS: 'http://localhost:5173',
  DATABASE_URL: 'postgresql://emukey:local@127.0.0.1:5432/emukey',
  EMAIL_ADAPTER: 'fake',
  EVM_ADAPTER: 'viem',
  EVM_NETWORK: 'sepolia',
  EVM_CHAIN_ID: '11155111',
  EVM_CONFIRMATIONS: '2',
  EVM_CONTRACT_ADDRESS: '0xAf61c3712e0A5fe9d5be0b3Fe080C786076e2845',
  EVM_DEPLOYMENT_BLOCK: '11738092',
  EVM_INDEXER_BATCH_SIZE: '500',
  EVM_RPC_HTTP_URL: 'https://ethereum-sepolia-rpc.publicnode.com',
  STORAGE_ADAPTER: 'local',
  ACTIVATION_ENVELOPE_ADAPTER: 'redis',
  ACTIVATION_ENVELOPE_KEY: '00'.repeat(32),
  JWT_SECRET: 'openapi-generation-secret-at-least-32-bytes',
  LOG_LEVEL: 'fatal',
  NODE_ENV: 'test',
  OTEL_ENABLED: 'false',
  PAYMENT_ADAPTER: 'fake',
  PAYMENT_WEBHOOK_SECRET: 'openapi-payment-secret',
  SEPAY_SANDBOX_RECEIPT_TIMING: 'false',
  SEPAY_SANDBOX_CLOCK_OFFSET_SECONDS: '0',
  PORT: '3100',
  PUSH_ADAPTER: 'fake',
  FCM_TIMEOUT_MS: '10000',
  KNOWLEDGE_MAX_FILE_BYTES: '10485760',
  KNOWLEDGE_MAX_CHUNKS: '500',
  KNOWLEDGE_MAX_CHUNK_BYTES: '12000',
  KNOWLEDGE_CHUNK_OVERLAP: '200',
  KNOWLEDGE_ALLOWED_MIME_TYPES: 'application/pdf,text/plain',
  NOTIFICATION_MAX_ATTEMPTS: '5',
  NOTIFICATION_LEASE_SECONDS: '300',
  NOTIFICATION_RETRY_BASE_SECONDS: '30',
  PUBLIC_VERIFY_RATE_LIMIT_PER_MINUTE: '30',
  PUBLIC_ACTIVATION_RATE_LIMIT_PER_MINUTE: '30',
  PUBLIC_VERIFY_ID_MIN_LENGTH: '20',
  REDIS_URL: 'redis://127.0.0.1:6379',
};

const tscExecutable = join(
  root,
  'node_modules',
  '.bin',
  process.platform === 'win32' ? 'tsc.cmd' : 'tsc',
);

function run(command, args) {
  const result = spawnSync(command, args, {
    cwd: root,
    encoding: 'utf8',
    env: environment,
    shell: process.platform === 'win32',
    stdio: 'inherit',
  });
  if (result.status !== 0) {
    throw new Error(`${command} exited with status ${result.status ?? 'unknown'}`);
  }
}

try {
  run(tscExecutable, ['-p', 'tsconfig.build.json']);
  run('node', [
    join(root, 'dist', 'entrypoints', 'api', 'export-openapi.js'),
    specification,
  ]);

  if (check) {
    const expected = await readFile(
      join(root, 'openapi', 'openapi.json'),
      'utf8',
    );
    const actual = await readFile(specification, 'utf8');
    if (actual !== expected) {
      throw new Error(
        'Backend OpenAPI document is out of date; run the OpenAPI generate script',
      );
    }
  }
} finally {
  if (temporaryDirectory) {
    await rm(temporaryDirectory, { force: true, recursive: true });
  }
}
