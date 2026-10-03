import type { Server } from 'node:http';

import type { INestApplication } from '@nestjs/common';
import type { OpenAPIObject } from '@nestjs/swagger';
import request from 'supertest';

import {
  AI_GATEWAY,
  type AiGatewayPort,
} from '../../../src/modules/assistance-support/application/ports/ai-gateway.port.js';
import {
  EMAIL_DELIVERY,
  type EmailDeliveryPort,
} from '../../../src/modules/operations/application/ports/email-delivery.port.js';
import {
  PUSH_DELIVERY,
  type PushDeliveryPort,
} from '../../../src/modules/operations/application/ports/push-delivery.port.js';

const testEnvironment = {
  NODE_ENV: 'test',
  PORT: '3100',
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
};

describe('API platform contract', () => {
  let app: INestApplication;

  beforeAll(async () => {
    Object.assign(process.env, testEnvironment);
    const { createApiApplication } =
      await import('../../../src/entrypoints/api/create-api-application.js');
    app = await createApiApplication({ logger: false });
    await app.init();
  }, 30_000);

  afterAll(async () => {
    await app.close();
  });

  it('serves liveness under the versioned API prefix', async () => {
    await request(app.getHttpServer() as Server)
      .get('/api/v1/health/live')
      .expect(200)
      .expect({ status: 'ok', service: 'emukey-api' });
  });

  it('uses the canonical structured error envelope', async () => {
    const response = await request(app.getHttpServer() as Server)
      .get('/api/v1/not-a-route')
      .set('x-request-id', 'contract-test-request')
      .expect(404);

    expect(response.body as unknown).toEqual({
      error: {
        code: 'NOT_FOUND',
        message: 'Not Found',
        traceId: 'contract-test-request',
      },
    });
  });

  it('exposes the generated OpenAPI document at a stable route', async () => {
    const response = await request(app.getHttpServer() as Server)
      .get('/api/v1/openapi.json')
      .expect(200);

    const document = response.body as OpenAPIObject;
    expect(document.info).toMatchObject({
      title: 'Emukey API',
      version: '1.0.0',
    });
    expect(document.paths).toHaveProperty('/api/v1/health/live');
    expect(document.components?.schemas).toHaveProperty('ApiErrorEnvelopeDto');
  });

  it('publishes typed catalog response contracts for generated clients', async () => {
    const response = await request(app.getHttpServer() as Server)
      .get('/api/v1/openapi.json')
      .expect(200);
    const document = response.body as OpenAPIObject;

    expect(document.components?.schemas).toHaveProperty('AdminProductDto');
    expect(document.components?.schemas).toHaveProperty('AdminPlanDto');
    expect(document.components?.schemas).toHaveProperty(
      'PublicCatalogProductDto',
    );
    expect(document.components?.schemas).toHaveProperty(
      'ComparePlansResponseDto',
    );
  });

  it('publishes typed Phase 4 commerce and payment contracts', async () => {
    const response = await request(app.getHttpServer() as Server)
      .get('/api/v1/openapi.json')
      .expect(200);
    const document = response.body as OpenAPIObject;

    for (const schema of [
      'OrderDto',
      'OrderTermsDto',
      'CheckoutSessionDto',
      'PaymentIngestResultDto',
      'PaymentHistoryDto',
      'PaymentReceiptDto',
      'PaymentReviewDto',
    ]) {
      expect(document.components?.schemas).toHaveProperty(schema);
    }
    expect(document.paths).toHaveProperty('/api/v1/orders/{id}/service-terms');
    expect(document.paths).toHaveProperty('/api/v1/payments/history');
    expect(document.paths).toHaveProperty('/api/v1/payments/{id}/receipt');
  });

  it('publishes allowlisted Phase 5 License contracts for generated clients', async () => {
    const response = await request(app.getHttpServer() as Server)
      .get('/api/v1/openapi.json')
      .expect(200);
    const document = response.body as OpenAPIObject;

    for (const schema of [
      'LicenseProjectionDto',
      'ActivationKeyDto',
      'PublicLicenseVerificationDto',
    ]) {
      expect(document.components?.schemas).toHaveProperty(schema);
    }
    expect(document.paths).toHaveProperty('/api/v1/licenses');
    expect(document.paths).toHaveProperty(
      '/api/v1/licenses/{id}/activation-key/retrieve',
    );
    expect(document.paths).toHaveProperty(
      '/api/v1/public/licenses/{publicId}/verify',
    );

    const publicSchema = document.components?.schemas?.[
      'PublicLicenseVerificationDto'
    ] as { properties?: Record<string, unknown> };
    expect(Object.keys(publicSchema.properties ?? {}).sort()).toEqual([
      'blockNumber',
      'confirmationCount',
      'expiresAt',
      'finality',
      'licenseId',
      'plan',
      'productName',
      'provider',
      'state',
      'status',
      'transactionHash',
    ]);
  });

  it('wires the configured AI and notification adapters through their ports', async () => {
    const ai = app.get<AiGatewayPort>(AI_GATEWAY);
    const email = app.get<EmailDeliveryPort>(EMAIL_DELIVERY);
    const push = app.get<PushDeliveryPort>(PUSH_DELIVERY);

    await expect(
      ai.answerGrounded({ question: 'No source', sources: [] }),
    ).resolves.toMatchObject({ grounded: false });
    await expect(
      email.deliver({
        data: {},
        eventKey: 'phase2-email',
        template: 'phase2',
        to: 'customer@example.test',
      }),
    ).resolves.toEqual({ providerMessageId: 'fake-email-phase2-email' });
    await expect(
      push.deliver({
        body: 'Phase 2',
        data: {},
        eventKey: 'phase2-push',
        title: 'Phase 2',
        token: 'test-device-token',
      }),
    ).resolves.toEqual({ providerMessageId: 'fake-push-phase2-push' });
  });
});
