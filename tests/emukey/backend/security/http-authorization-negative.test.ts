import type { Server } from 'node:http';

import type { INestApplication } from '@nestjs/common';
import request from 'supertest';

describe('Phase 8 HTTP authorization negative matrix', () => {
  let app: INestApplication;

  beforeAll(async () => {
    Object.assign(process.env, {
      NODE_ENV: 'test',
      PORT: '3101',
      DATABASE_URL: 'postgresql://emukey:password@127.0.0.1:1/emukey',
      REDIS_URL: 'redis://127.0.0.1:1',
      CORS_ORIGINS: 'http://localhost:5173',
      LOG_LEVEL: 'fatal',
      OTEL_ENABLED: 'false',
      PAYMENT_ADAPTER: 'fake',
      SEPAY_SANDBOX_RECEIPT_TIMING: 'false',
      PAYMENT_WEBHOOK_SECRET: 'test-payment-secret',
      AI_ADAPTER: 'fake',
      EMAIL_ADAPTER: 'fake',
      PUSH_ADAPTER: 'fake',
      EVM_ADAPTER: 'viem',
      EVM_NETWORK: 'hardhat',
      EVM_CHAIN_ID: '31337',
      EVM_CONFIRMATIONS: '2',
      EVM_CONTRACT_ADDRESS: '0x5FbDB2315678afecb367f032d93F642f64180aa3',
      EVM_DEPLOYMENT_BLOCK: '1',
      EVM_INDEXER_BATCH_SIZE: '500',
      EVM_RPC_HTTP_URL: 'http://127.0.0.1:1',
      EVM_RELAYER_PRIVATE_KEY: `0x${'11'.repeat(32)}`,
      STORAGE_ADAPTER: 'local',
      ACTIVATION_ENVELOPE_ADAPTER: 'redis',
      ACTIVATION_ENVELOPE_KEY: '00'.repeat(32),
      JWT_SECRET: 'test-jwt-secret-32-characters-minimum',
    });
    const { createApiApplication } = await import('../../../../EmuKey/backend/src/entrypoints/api/create-api-application.js');
    app = await createApiApplication({ logger: false });
    await app.init();
  }, 120_000);

  afterAll(async () => {
    await app.close();
  });

  it.each([
    ['GET', '/api/v1/orders'],
    ['POST', '/api/v1/orders'],
    ['GET', '/api/v1/orders/renewal-preview/00000000-0000-4000-8000-000000000401'],
    ['GET', '/api/v1/operations/audit-logs'],
    ['GET', '/api/v1/licenses'],
    ['GET', '/api/v1/payments/history'],
    ['GET', '/api/v1/payments/review'],
    ['POST', '/api/v1/operations/blockchain/reconcile'],
  ])('rejects unauthenticated %s %s', async (method, path) => {
    const response = await request(app.getHttpServer() as Server)[method.toLowerCase() as 'get' | 'post'](path);
    expect(response.status).toBe(401);
    expect((response.body as { error?: unknown }).error).toMatchObject({ code: 'UNAUTHORIZED' });
  });
});
